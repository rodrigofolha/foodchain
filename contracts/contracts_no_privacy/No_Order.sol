// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

library No_Util {
    struct Item {
        string name;
        uint quantity;
        uint256 price;
    }
    
    function getOrderStepValue(Order.OrderStep _step) external pure returns (string memory) {
        // Loop through possible options
        if (Order.OrderStep.ORDERED == _step) return "ORDERED";
        else if (Order.OrderStep.PREPARATION == _step) return "PREPARATION";
        else if (Order.OrderStep.WAITING == _step) return "WAITING";
        else if (Order.OrderStep.DISPATCHED == _step) return "DISPATCHED";
        else if (Order.OrderStep.CONCLUDED == _step) return "CONCLUDED";
        else if (Order.OrderStep.CANCELEDBYCLIENT == _step) return "CANCELED BY CLIENT";
        else if (Order.OrderStep.CANCELEDBYRESTAURANT == _step) return "CANCELED BY RESTAURANT";
        else if (Order.OrderStep.CANCELEDBYFIRSTDELIVERYMAN == _step) return "CANCELED BY FIRST DELIVERYMAN";
        else if (Order.OrderStep.CANCELEDBYSECONDDELIVERYMAN == _step) return "CANCELED BY SECOND DELIVERYMAN";
        else return "UNKOWN";
    }
    
    function onlyByMembers (address _caller, address client, address restaurant, address[] memory deliverymen) external pure returns (bool) {
        if (deliverymen.length == 0 && _caller != client && _caller != restaurant)
            return false;
        else if (deliverymen.length == 1 && _caller != client && _caller != restaurant && _caller != deliverymen[0])
            return false;
        else if (deliverymen.length == 2 && _caller != client && _caller != restaurant && _caller != deliverymen[1])
            return false;
        else
            return true;
    }
    
    function whoCancel(address _caller, Order.OrderStep _step, address client, address restaurant, address[] memory deliverymen, uint256 now_time, uint256 timestamp) external pure returns (Order.OrderStep) {
        if (Order.OrderStep.ORDERED == _step && _caller == client) return Order.OrderStep.CANCELEDBYRESTAURANT;
        else if (Order.OrderStep.ORDERED == _step && _caller == restaurant) return Order.OrderStep.CANCELEDBYRESTAURANT;
        else if (Order.OrderStep.PREPARATION == _step && now_time > timestamp+3600) return Order.OrderStep.CANCELEDBYRESTAURANT;
        else if (Order.OrderStep.PREPARATION == _step && _caller == client) return Order.OrderStep.CANCELEDBYCLIENT;
        else if (Order.OrderStep.PREPARATION == _step && _caller == restaurant) return Order.OrderStep.CANCELEDBYRESTAURANT;
        // A worker that committed but never collected is the party in default,
        // so both the WAITING timeout and an explicit withdrawal are charged to
        // that worker, who forfeits the fee. Attributing them to the establishment
        // (as CANCELEDBYRESTAURANT does) would instead pay the full fee to a worker
        // that never picked the order up and burn the establishment's collateral.
        // This mirrors the DISPATCHED rules below.
        else if (deliverymen.length == 1 && Order.OrderStep.WAITING == _step && now_time > timestamp+3600) return Order.OrderStep.CANCELEDBYFIRSTDELIVERYMAN;
        else if (deliverymen.length == 2 && Order.OrderStep.WAITING == _step && now_time > timestamp+3600) return Order.OrderStep.CANCELEDBYSECONDDELIVERYMAN;
        else if (deliverymen.length == 1 && Order.OrderStep.WAITING == _step && _caller == deliverymen[0]) return Order.OrderStep.CANCELEDBYFIRSTDELIVERYMAN;
        else if (deliverymen.length == 2 && Order.OrderStep.WAITING == _step && _caller == deliverymen[1]) return Order.OrderStep.CANCELEDBYSECONDDELIVERYMAN;
        else if (Order.OrderStep.WAITING == _step && _caller == client ) return Order.OrderStep.CANCELEDBYCLIENT;
        else if (Order.OrderStep.WAITING == _step && _caller == restaurant ) return Order.OrderStep.CANCELEDBYRESTAURANT;
        else if (deliverymen.length == 1 && Order.OrderStep.DISPATCHED == _step && now_time > timestamp+3600) return Order.OrderStep.CANCELEDBYFIRSTDELIVERYMAN;
        else if (deliverymen.length == 2 && Order.OrderStep.DISPATCHED == _step && now_time > timestamp+3600) return Order.OrderStep.CANCELEDBYSECONDDELIVERYMAN;
        else if (Order.OrderStep.DISPATCHED == _step && _caller == client ) return Order.OrderStep.CANCELEDBYCLIENT;
        else if (Order.OrderStep.DISPATCHED == _step && _caller == restaurant ) return Order.OrderStep.CANCELEDBYRESTAURANT;
        else if (deliverymen.length == 1 && Order.OrderStep.DISPATCHED == _step && _caller == deliverymen[0]) return Order.OrderStep.CANCELEDBYFIRSTDELIVERYMAN;
        else if (deliverymen.length == 2 && Order.OrderStep.DISPATCHED == _step && _caller == deliverymen[1]) return Order.OrderStep.CANCELEDBYSECONDDELIVERYMAN;
        else return _step;
    }
    
    // The payout table of the privacy contracts (Util.payment in contracts/Order.sol), unchanged:
    // what each party is paid when the order ends at `step`.
    // `deliverymen` is the position of the worker committed now: 1 (first), 2 (second),
    // or 0 when no worker is committed (also after the first one left and before a second commits).
    function payment(Order.OrderStep step, uint256 total, uint256 deliveryPrice, uint256 deliverymen, uint256 restaurantDeposit) external pure returns (uint256, uint256, uint256, uint256) {
        // CONCLUDED: client paid, restaurant gets food+collateral, active deliveryman gets fee
        if (step == Order.OrderStep.CONCLUDED) {
            if (deliverymen == 2) return (0, total + deliveryPrice, 0, deliveryPrice);
            else if (deliverymen == 1) return (0, total + deliveryPrice, deliveryPrice, 0);
            else return (0, total, 0, 0);
        }
        // CANCELED BY CLIENT: penalty depends on the stage (inferred from state)
        else if (step == Order.OrderStep.CANCELEDBYCLIENT) {
            if (deliverymen == 0 && restaurantDeposit == 0) {
                // Was at ORDERED: full refund
                return (total + deliveryPrice, 0, 0, 0);
            } else if (deliverymen == 0) {
                // Was at PREPARATION: client loses food cost, gets deliveryPrice back
                return (deliveryPrice, total + deliveryPrice, 0, 0);
            } else if (deliverymen == 2) {
                // Was at WAITING/DISPATCHED with 2nd deliveryman: client fully penalized
                return (0, total + deliveryPrice, 0, deliveryPrice);
            } else {
                // Was at WAITING/DISPATCHED with 1st deliveryman: client fully penalized
                return (0, total + deliveryPrice, deliveryPrice, 0);
            }
        }
        // CANCELED BY RESTAURANT: client full refund, restaurant loses collateral to pay active deliveryman
        else if (step == Order.OrderStep.CANCELEDBYRESTAURANT) {
            if (deliverymen == 2) return (total + deliveryPrice, 0, 0, deliveryPrice);
            else if (deliverymen == 1) return (total + deliveryPrice, 0, deliveryPrice, 0);
            // No worker: the collateral goes back, if one was deposited (none yet at ORDERED)
            else if (restaurantDeposit == 0) return (total + deliveryPrice, 0, 0, 0);
            else return (total + deliveryPrice, deliveryPrice, 0, 0);
        }
        // CANCELED BY DELIVERYMAN: client full refund, restaurant gets collateral back, deliveryman gets nothing
        else if (step == Order.OrderStep.CANCELEDBYFIRSTDELIVERYMAN || step == Order.OrderStep.CANCELEDBYSECONDDELIVERYMAN) {
            return (total + deliveryPrice, deliveryPrice, 0, 0);
        }
        else return (0, 0, 0, 0);
    }
} 




contract Order {
    enum OrderStep {ORDERED, PREPARATION, WAITING, DISPATCHED, CONCLUDED, CANCELEDBYCLIENT, CANCELEDBYRESTAURANT, CANCELEDBYFIRSTDELIVERYMAN, CANCELEDBYSECONDDELIVERYMAN}
    event OrderActors(address indexed client, address indexed establishment, address indexed deliveryworker, address orderAddress);
    uint256 private id;
    address  private client;
    address  private restaurant;
    address  [] private  deliverymen;
    uint256 private deliveryPrice;
    uint256 private total;
    OrderStep private step;
    mapping(OrderStep=>uint256) private timestamp ;
    mapping(address => uint256) private payment;
    string private items;
    
    // Handover confirmations are signatures, not stored codes: anything stored in
    // contract storage is public, and a short code can be guessed from its hash.
    // Pickup: the committed worker signs; the establishment submits it.
    // Delivery: the customer signs; the worker submits it.
    uint8 public constant HANDOVER_PICKUP = 1;
    uint8 public constant HANDOVER_DELIVERY = 2;
    
    // As in the privacy contracts: this code is deployed once, by No_Chain in its constructor (the
    // implementation), and every order is an EIP-1167 minimal proxy that runs it by DELEGATECALL in
    // its own storage, with its own address and balance. Immutables and constants are part of the
    // code; everything else is the order's own storage, written by initialize().
    address private immutable chain; // the No_Chain that deployed this code and creates the orders; the only allowed caller
    address private immutable self;  // the address of the implementation itself, which is never an order
    
    /// @dev Function cannot be called at this time.
    string private constant FunctionInvalidAtThisStep = "Function cannot be called at this step";
        
    
    /// @dev Sender not authorized for this
    /// operation.
    string private constant Unauthorized = "This caller is unauthorized";
    
    modifier clientRestricted {
        require(client == msg.sender);
        _;
    }
    
    // Every state-changing function receives the acting account as a parameter.
    // Only No_Chain may call them, because No_Chain always passes its own msg.sender.
    // The implementation refuses them all: it is never initialized and never an order.
    modifier onlyChain {
        if (msg.sender != chain || address(this) == self)
            revert(Unauthorized);
        _;
    }

    modifier onlyBy (address _externalAccount, address _account) {
        if (_externalAccount != _account)
            revert(Unauthorized);
        _;
    }
    
    modifier onlyByTwo (address _account, address _account2) {
        if (msg.sender != _account && msg.sender != _account2 )
            revert(Unauthorized);
        _;
    }
    
    modifier onlyByMembers (address _caller) {
        if (deliverymen.length == 0 && _caller != client && _caller != restaurant)
            revert(Unauthorized);
        else if (deliverymen.length == 1 && _caller != client && _caller != restaurant && _caller != deliverymen[0])
            revert(Unauthorized);
        else if (deliverymen.length == 2 && _caller != client && _caller != restaurant && _caller != deliverymen[1])
            revert(Unauthorized);            
        _;
    }
    
    modifier atStep(OrderStep _step) {
        if (step != _step)
            revert(FunctionInvalidAtThisStep);
        _;
    }

    
    // Runs once, when No_Chain deploys the implementation. It writes no storage: a proxy shares the
    // code, not the storage.
    constructor () {
        chain = msg.sender;
        self = address(this);
    }

    // The former constructor. No_Chain calls it once, in the transaction that creates the proxy
    // (No_Chain.makeOrder). Same storage writes as the constructor made, apart from the two
    // message strings, which are constants now.
    function initialize (uint256 _id, address _client, address _restaurant, uint256 _deliveryPrice, uint256 _total, string calldata _items) external payable onlyChain {
        require(timestamp[OrderStep.ORDERED] == 0, "Already initialized");
        id = _id;
        client = _client;
        restaurant = _restaurant;
        step = OrderStep.ORDERED;
        deliveryPrice = _deliveryPrice;
        total = _total;
        timestamp[OrderStep.ORDERED] = block.timestamp;
        items = _items;
        require(msg.value >= total + deliveryPrice);
        payment[_client] += msg.value;
        
        emit OrderActors (_client, address(0), address(0), address(this));
    }
    
    
    function getPayment () public view  returns (uint256, uint256, uint256, uint256){
        uint256 d1 = deliverymen.length >= 1 ? payment[deliverymen[0]] : 0;
        uint256 d2 = deliverymen.length >= 2 ? payment[deliverymen[1]] : 0;
        return (payment[client], payment[restaurant], d1, d2);
    }
    
    function acceptOrder (address _restaurant) onlyChain onlyBy(_restaurant, restaurant) atStep(OrderStep.ORDERED) external payable returns (bool) {
        require(msg.value >= deliveryPrice, "Insuficient funds to complete a order.");
        payment[_restaurant] += msg.value;
        step = OrderStep.PREPARATION;
        timestamp[OrderStep.PREPARATION] = block.timestamp;
        emit OrderActors (client, _restaurant, address(0), address(this));
        return true;
    }    
    
    // Not payable, as in the privacy contracts: the worker makes no deposit, and no payout rule would return one.
    function confirmIntention (address _deliveryman) onlyChain atStep(OrderStep.PREPARATION)  external returns (bool) {
        deliverymen.push(_deliveryman);
        step = OrderStep.WAITING;
        timestamp[OrderStep.WAITING] = block.timestamp;
        emit OrderActors (client, restaurant, _deliveryman, address(this));
        return true;
    }    
    
    
    function callSecondDeliveryman (address _restaurant) onlyChain onlyBy(_restaurant, restaurant) atStep(OrderStep.WAITING)  external returns (bool) {
        // The payout and cancellation rules of No_Util cover one or two workers only.
        require(deliverymen.length < 2, "Second worker already called");
        step = OrderStep.PREPARATION;
        timestamp[OrderStep.PREPARATION] = block.timestamp;
        return true;
    }    
  
    
    /// @notice Digest a party signs (EIP-191 personal_sign) to confirm a handover.
    ///         Bound to this chain, this order, the action and the committed worker.
    function handoverDigest(uint8 _action, address _worker) public view returns (bytes32) {
        return keccak256(abi.encodePacked("DeliveryChain handover", block.chainid, address(this), _action, _worker));
    }

    function _signerOf(bytes32 _digest, bytes memory _sig) internal pure returns (address) {
        require(_sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(_sig, 32))
            s := mload(add(_sig, 64))
            v := byte(0, mload(add(_sig, 96)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid signature v");
        // Reject the malleable upper half of s
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "Invalid signature s");
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _digest));
        address signer = ecrecover(ethSigned, v, r, s);
        require(signer != address(0), "Invalid signature");
        return signer;
    }

    function _currentWorker() internal view returns (address) {
        return deliverymen[deliverymen.length - 1];
    }

    function pickupOrder (address _restaurant, bytes calldata _workerSig) onlyChain onlyBy(_restaurant, restaurant) atStep(OrderStep.WAITING)  external returns (bool) {
        address worker = _currentWorker();
        require(_signerOf(handoverDigest(HANDOVER_PICKUP, worker), _workerSig) == worker, "Invalid pickup confirmation");
        step = OrderStep.DISPATCHED;
        timestamp[OrderStep.DISPATCHED] = block.timestamp;
        return true;
    }    
    
    
    function deliveryOrder (address _deliveryman, bytes calldata _clientSig) onlyChain atStep(OrderStep.DISPATCHED)  external returns (bool) {
        require(_deliveryman == _currentWorker(), Unauthorized);
        require(_signerOf(handoverDigest(HANDOVER_DELIVERY, _deliveryman), _clientSig) == client, "Invalid delivery confirmation");
        step = OrderStep.CONCLUDED;
        timestamp[OrderStep.CONCLUDED] = block.timestamp;
        _distributePayments(deliverymen.length);
        return true;
    }    
    
    // What No_Chain needs to record a rating of `_worker` by `_caller` on this order: the order's
    // id, whether the order is concluded with `_worker` as the worker who delivered it, and
    // whether the caller is its customer or its establishment. The ratings are kept by No_Chain.
    function ratingInfo (address _caller, address _worker) external view returns (uint256, bool, bool, bool) {
        return (id, step == OrderStep.CONCLUDED && _worker == _currentWorker(), _caller == client, _caller == restaurant);
    }

    function contestOrder (address _restaurant, bool aval) onlyChain onlyBy(_restaurant, restaurant) atStep(OrderStep.DISPATCHED)  external returns (bool) {
        if (aval) {
            step = OrderStep.CANCELEDBYCLIENT;
            timestamp[OrderStep.CANCELEDBYCLIENT] = block.timestamp;
        } else if (deliverymen.length == 1) {
            step = OrderStep.CANCELEDBYFIRSTDELIVERYMAN;
            timestamp[OrderStep.CANCELEDBYFIRSTDELIVERYMAN] = block.timestamp;
        } else if (deliverymen.length == 2) {
            step = OrderStep.CANCELEDBYSECONDDELIVERYMAN;
            timestamp[OrderStep.CANCELEDBYSECONDDELIVERYMAN] = block.timestamp;
            
        } else return false;
        _distributePayments(deliverymen.length);
        return true;
    }   
    
    
    function cancelOrder (address _caller) onlyChain onlyByMembers(_caller)  external returns (bool) {
        OrderStep _step = No_Util.whoCancel(_caller, step, client, restaurant, deliverymen, block.timestamp, timestamp[step]);
        if (step!=_step) {
            // A worker is committed in WAITING and DISPATCHED only (not after a replacement, before a second one commits)
            uint256 committed = (step == OrderStep.WAITING || step == OrderStep.DISPATCHED) ? deliverymen.length : 0;
            timestamp[_step] = block.timestamp;
            step = _step;
            _distributePayments(committed);
            return true;
        }
        else
            return true;
    }
    
    
    function getItems(address _caller) external view returns (uint256, string memory, uint256, string memory, address, uint256, uint256, uint256, address){
        address address_deliveryman = address(0);
        if (_caller == client && deliverymen.length == 1) {
            address_deliveryman = deliverymen[0];
        } else if (_caller == client && deliverymen.length == 2) {
            address_deliveryman = deliverymen[1];
        }
        if (_caller==client){
            return (id, items, deliveryPrice, No_Util.getOrderStepValue(step), restaurant, 0, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman);    
        } else if (_caller == restaurant || _caller==client) {
            return (id,items, deliveryPrice, No_Util.getOrderStepValue(step), address(0), 0, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman);   
        } else if (deliverymen.length == 1 && _caller == deliverymen[0]) {
            return (id,items, deliveryPrice, No_Util.getOrderStepValue(step), restaurant, 0, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman);   
        } else if (deliverymen.length == 2 && _caller == deliverymen[1]) {
            return (id,items, deliveryPrice, No_Util.getOrderStepValue(step), restaurant, 0, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman);   
        } else if (step == OrderStep.PREPARATION) {
            return (id, items, deliveryPrice, No_Util.getOrderStepValue(step), restaurant, total, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman);    
        } else {
            return (id, string(""), 0,string(""), address(0), 0, 0, 0, address_deliveryman);
        }
        
    }
    
    function relatedTo(address _caller) external view returns (bool) {
        return No_Util.onlyByMembers(_caller, client, restaurant, deliverymen);
    }
    
    function toBeTaken() external view returns (bool) {
        return step == OrderStep.PREPARATION;
    }
    
    // Pays every party in the transaction that ends the order, by direct transfers, as
    // Order._distributePayments of the privacy contracts does for an order without a payment
    // commitment. The step is final before anything is paid, so nothing is paid twice.
    // `_committed` is the position of the worker committed when the order ended (0 = none).
    function _distributePayments(uint256 _committed) internal {
        (uint256 _client, uint256 _restaurant, uint256 _deliveryman_1, uint256 _deliveryman_2) =
            No_Util.payment(step, total, deliveryPrice, _committed, payment[restaurant]);

        if (_client > 0) {
            payment[client] = 0;
            (bool s1, ) = payable(client).call{value: _client}("");
            require(s1, "Client payment failed");
        }
        if (_restaurant > 0) {
            payment[restaurant] = 0;
            (bool s2, ) = payable(restaurant).call{value: _restaurant}("");
            require(s2, "Restaurant payment failed");
        }
        if (_deliveryman_1 > 0 && deliverymen.length >= 1) {
            payment[deliverymen[0]] = 0;
            (bool s3, ) = payable(deliverymen[0]).call{value: _deliveryman_1}("");
            require(s3, "Deliveryman 1 payment failed");
        }
        if (_deliveryman_2 > 0 && deliverymen.length >= 2) {
            payment[deliverymen[1]] = 0;
            (bool s4, ) = payable(deliverymen[1]).call{value: _deliveryman_2}("");
            require(s4, "Deliveryman 2 payment failed");
        }
    }
    
  //send tips
  
  //rate actors
   
}