// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

library Util {
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
        if (Order.OrderStep.ORDERED == _step && _caller == client) return Order.OrderStep.CANCELEDBYCLIENT;
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
        // Exception: when the first worker withdraws before the timeout, the order is
        // not canceled. The result is PREPARATION, and Order offers it to a second worker.
        else if (deliverymen.length == 1 && Order.OrderStep.WAITING == _step && now_time > timestamp+3600) return Order.OrderStep.CANCELEDBYFIRSTDELIVERYMAN;
        else if (deliverymen.length == 2 && Order.OrderStep.WAITING == _step && now_time > timestamp+3600) return Order.OrderStep.CANCELEDBYSECONDDELIVERYMAN;
        else if (deliverymen.length == 1 && Order.OrderStep.WAITING == _step && _caller == deliverymen[0]) return Order.OrderStep.PREPARATION;
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


interface IGlobalReputation {
    function addCompletedOrder(address deliveryWorker) external;
    function addLeaving(address deliveryWorker, bool afterPickup) external;
    function addRating(address deliveryWorker, uint256 score, bool byClient, bool byEstablishment) external;
    function requireQualified(address worker, uint256 minReputation, uint256 minOrders) external view;
    function getWorkerStats(address worker) external view returns (uint256 avgScore, uint256 totalRatings, uint256 completedOrders);
    function depositPayment(uint256 commitment) external payable;
    function noteNextIndex() external view returns (uint32);
    function NOTE_TREE_DEPTH() external view returns (uint8);
    function MAX_AMOUNT() external view returns (uint256);
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
    bool private reoffered; // true while the order is back in PREPARATION after its first worker left (shares the slot of `step`)
    mapping(OrderStep=>uint256) private timestamp ;
    mapping(address => uint256) private payment;
    string private items;
    string private itemsClient;
    
    // Handover confirmations are signatures, not stored codes: anything stored in
    // contract storage is public, and a short code can be guessed from its hash.
    // Pickup: the committed worker signs; the establishment submits it.
    // Delivery: the customer signs; the worker submits it.
    uint8 public constant HANDOVER_PICKUP = 1;
    uint8 public constant HANDOVER_DELIVERY = 2;
    
    IGlobalReputation public reputationContract;
    // This code is deployed once, by Chain in its constructor (the implementation). Every order is
    // an EIP-1167 minimal proxy that runs it by DELEGATECALL in its own storage, with its own
    // address and balance. Immutables and constants are part of the code, so every order reads
    // the same `chain` and `self`; everything else is the order's own storage, written by initialize().
    address private immutable chain; // the Chain that deployed this code and creates the orders; the only allowed caller
    address private immutable self;  // the address of the implementation itself, which is never an order
    uint256 private restaurantPaymentCommitment; // poseidon(nullifier, trapdoor) for ZK payment note
    uint256 private revenueNoteAmount;           // amount of the note the order deposited for the establishment when it ended (0 before, and 0 if it paid directly)
    uint256 private minReputation; // 0 = no minimum; uses ×10 scale (e.g. 35 = 3.5 stars)
    uint256 private minOrders;     // 0 = no minimum; minimum completed orders required
    
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
    // Only Chain may call them, because Chain always passes its own msg.sender.
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
    
    // The customer, the establishment and the worker committed now (not a worker that left).
    modifier onlyByMembers (address _caller) {
        if (!relatedTo(_caller))
            revert(Unauthorized);
        _;
    }
    
    modifier atStep(OrderStep _step) {
        if (step != _step)
            revert(FunctionInvalidAtThisStep);
        _;
    }

    
    // Runs once, when Chain deploys the implementation. It writes no storage: a proxy shares the
    // code, not the storage, so anything set here would be invisible to the orders.
    constructor () {
        chain = msg.sender;
        self = address(this);
    }

    // The former constructor. Chain calls it once, in the transaction that creates the proxy
    // (Chain.makeOrder). Same storage writes as the constructor made.
    function initialize (uint256 _id, address _client, address _restaurant, uint256 _deliveryPrice, uint256 _total, string calldata _items, string calldata _items_client,
    address _reputationContract) external payable onlyChain {
        require(timestamp[OrderStep.ORDERED] == 0, "Already initialized");
        id = _id;
        client = _client;
        restaurant = _restaurant;
        step = OrderStep.ORDERED;
        deliveryPrice = _deliveryPrice;
        total = _total;
        timestamp[OrderStep.ORDERED] = block.timestamp;
        items = _items;
        itemsClient = _items_client;
        require(msg.value >= total + deliveryPrice);
        payment[_client] += msg.value;
        
        emit OrderActors (_client, address(0), address(0), address(this));
        reputationContract = IGlobalReputation(_reputationContract);
    }
    
    
    function isClient(address _account) external view returns (bool) {
        return _account == client;
    }

    function getPayment () public view  returns (uint256, uint256, uint256, uint256){
        uint256 d1 = deliverymen.length >= 1 ? payment[deliverymen[0]] : 0;
        uint256 d2 = deliverymen.length >= 2 ? payment[deliverymen[1]] : 0;
        return (payment[client], payment[restaurant], d1, d2);
    }
    
    function acceptOrder (address _restaurant, uint256 _paymentCommitment, uint256 _minReputation, uint256 _minOrders) onlyChain onlyBy(_restaurant, restaurant) atStep(OrderStep.ORDERED) external payable returns (bool) {
        require(msg.value >= deliveryPrice, "Insuficient funds to complete a order.");
        payment[_restaurant] += msg.value;
        step = OrderStep.PREPARATION;
        timestamp[OrderStep.PREPARATION] = block.timestamp;
        restaurantPaymentCommitment = _paymentCommitment;
        minReputation = _minReputation;
        minOrders = _minOrders;
        emit OrderActors (client, _restaurant, address(0), address(this));
        return true;
    }    
    
    // Not payable: the worker makes no deposit, and no payout rule would return one.
    function confirmIntention (address _deliveryman) onlyChain atStep(OrderStep.PREPARATION)  external returns (bool) {
        // The reputation contract reverts if the worker is below the establishment's minimums
        if (minReputation > 0 || minOrders > 0)
            reputationContract.requireQualified(_deliveryman, minReputation, minOrders);
        deliverymen.push(_deliveryman);
        reoffered = false;
        step = OrderStep.WAITING;
        timestamp[OrderStep.WAITING] = block.timestamp;
        emit OrderActors (client, restaurant, _deliveryman, address(this));
        return true;
    }    
    
    
    // The establishment may replace the committed worker at any time in WAITING, once per order.
    // The replaced worker is reported as having left before pickup, so the establishment can rate
    // them at once: this is trust placed in the establishment.
    function callSecondDeliveryman (address _restaurant) onlyChain onlyBy(_restaurant, restaurant) atStep(OrderStep.WAITING)  external returns (bool) {
        // The payout and cancellation rules of Util cover one or two workers only.
        require(deliverymen.length < 2, "Second worker already called");
        _reoffer();
        return true;
    }    

    // Tells the reputation contract that a worker left this order: it counts the leaving and
    // lets the worker be rated on this order. One function, so that Order holds the call once.
    function _workerLeft(address _worker, bool _afterPickup) internal {
        reputationContract.addLeaving(_worker, _afterPickup);
    }

    // The first worker left before pickup (their own withdrawal, or the establishment's
    // replacement): the order goes back to PREPARATION for a second worker. Nobody is paid,
    // the customer's payment and the establishment's collateral stay in the order.
    function _reoffer() internal {
        step = OrderStep.PREPARATION;
        reoffered = true;
        timestamp[OrderStep.PREPARATION] = block.timestamp;
        _workerLeft(deliverymen[0], false);
    }
  
    
    /// @notice Digest a party signs (EIP-191 personal_sign) to confirm a handover.
    ///         Bound to this chain, this order, the action, the committed worker and the
    ///         commitment (first or second): a confirmation signed in a worker's first
    ///         commitment is not valid if the same worker commits again.
    function handoverDigest(uint8 _action, address _worker) public view returns (bytes32) {
        return keccak256(abi.encodePacked("DeliveryChain handover", block.chainid, address(this), _action, _worker, deliverymen.length));
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

    // The worker committed now. address(0) if there is none: before the first commitment,
    // or after the first worker left and before a second one commits.
    function _currentWorker() internal view returns (address) {
        if (reoffered || deliverymen.length == 0) return address(0);
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

        // Count the concluded delivery in the Global Reputation contract.
        reputationContract.addCompletedOrder(_deliveryman);
        _distributePayments();
        return true;
    }    
    
    /// @notice Rates, in the clear, a worker of this order. Only the customer and the establishment
    ///         (the order's one-time address) may rate. This order says which of the two the caller
    ///         is; the reputation contract refuses a caller who is neither and checks the rest:
    ///         that this order reported the worker as having delivered or left, that this rater
    ///         may rate in that case, the score (1 to 5), and once per rater and worker.
    function rateOrder (address _caller, address _worker, uint256 _score) onlyChain  external returns (bool) {
        reputationContract.addRating(_worker, _score, _caller == client, _caller == restaurant);
        return true;
    }

    // The establishment decides a contested delivery at any time in DISPATCHED, also right after
    // pickup and against the customer: after pickup the establishment is the arbiter.
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
        } else {
            return false;
        }
        if (!aval) _workerLeft(_currentWorker(), true);
        _distributePayments();
        return true;
    }   
    
    
    function cancelOrder (address _caller) onlyChain onlyByMembers(_caller)  external returns (bool) {
        OrderStep _step = Util.whoCancel(_caller, step, client, restaurant, deliverymen, block.timestamp, timestamp[step]);
        if (step == _step)
            return true;
        if (_step == OrderStep.PREPARATION) {
            // The first worker withdrew in WAITING: the order is offered again
            _reoffer();
            return true;
        }
        // A cancellation charged to the worker: the reputation contract counts it and lets the worker be rated
        if (_step == OrderStep.CANCELEDBYFIRSTDELIVERYMAN || _step == OrderStep.CANCELEDBYSECONDDELIVERYMAN)
            _workerLeft(_currentWorker(), step == OrderStep.DISPATCHED);
        timestamp[_step] = block.timestamp;
        step = _step;
        _distributePayments();
        return true;
    }
    
    
    function getItems(address _caller) external view returns (uint256, string memory, uint256, string memory, address, uint256, uint256, uint256, address, uint256, uint256){
        address address_deliveryman = address(0);
        if (_caller == client) {
            address_deliveryman = _currentWorker();
        }
        if (_caller==client){
            return (id, itemsClient, deliveryPrice, Util.getOrderStepValue(step), restaurant, 0, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman, minReputation, minOrders);
        } else if (_caller == restaurant) {
            // Reveal deliveryman address to restaurant so they can rate after conclusion
            address restaurant_deliveryman = _currentWorker();
            // Field [5] carries the amount of the establishment's note once the order ended (concluded
            // or not), so the establishment can rebuild the note leaf poseidon(commitment, amount) and spend it.
            return (id,items, deliveryPrice, Util.getOrderStepValue(step), address(0), revenueNoteAmount, timestamp[OrderStep.ORDERED], timestamp[step], restaurant_deliveryman, minReputation, minOrders);
        } else if (relatedTo(_caller)) {
            return (id,string(""), deliveryPrice, Util.getOrderStepValue(step), restaurant, 0, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman, minReputation, minOrders);
        } else if (step == OrderStep.PREPARATION) {
            return (id, string(""), deliveryPrice, Util.getOrderStepValue(step), restaurant, total, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman, minReputation, minOrders);
        } else {
            return (id, string(""), 0,string(""), address(0), 0, 0, 0, address_deliveryman, 0, 0);
        }

    }
    
    function relatedTo(address _caller) public view returns (bool) {
        return _caller == client || _caller == restaurant || (_caller != address(0) && _caller == _currentWorker());
    }
    
    function toBeTaken() external view returns (bool) {
        return step == OrderStep.PREPARATION;
    }
    
    function _distributePayments() internal {
        (uint256 _client, uint256 _restaurant, uint256 _deliveryman_1, uint256 _deliveryman_2) =
            Util.payment(step, total, deliveryPrice, reoffered ? 0 : deliverymen.length, payment[restaurant]);

        if (_client > 0) {
            payment[client] = 0;
            (bool s1, ) = payable(client).call{value: _client}("");
            require(s1, "Client payment failed");
        }
        if (_restaurant > 0) {
            payment[restaurant] = 0;
            // With a payment commitment the establishment is paid by a note in the payment pool,
            // in every ending: the revenue of a concluded order, and what a cancellation, a timeout
            // or a contested decision pays or returns to it. Nothing goes to its one-time address.
            // Without a commitment, or if the pool cannot take the note: direct transfer.
            if (restaurantPaymentCommitment != 0 && _poolTakes(_restaurant)) {
                revenueNoteAmount = _restaurant;
                reputationContract.depositPayment{value: _restaurant}(restaurantPaymentCommitment);
            } else {
                (bool s2, ) = payable(restaurant).call{value: _restaurant}("");
                require(s2, "Restaurant payment failed");
            }
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
    
    // The conditions of GlobalReputation.depositPayment for a non-zero amount, read from the pool
    // before the deposit: the amount is below the pool's maximum and the note tree is not full.
    // The deposit itself is not caught: if it fails for any other reason (out of gas included)
    // the whole ending reverts, so the sender cannot choose the direct transfer.
    function _poolTakes(uint256 _amount) internal view returns (bool) {
        return _amount < reputationContract.MAX_AMOUNT()
            && reputationContract.noteNextIndex() < uint256(1) << reputationContract.NOTE_TREE_DEPTH();
    }

  //send tips
  
  //rate actors
   
}