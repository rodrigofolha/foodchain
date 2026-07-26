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
    
    function random(bytes32 blockHash, address sender, uint256 id, uint256 salt) external pure returns (uint256) {
      return uint256(keccak256(abi.encodePacked(blockHash, sender, id, salt))) % 1000000;
    }
    
    function whoCancel(address _caller, Order.OrderStep _step, address client, address restaurant, address[] memory deliverymen, uint256 now_time, uint256 timestamp) external pure returns (Order.OrderStep) {
        if (Order.OrderStep.ORDERED == _step && _caller == client) return Order.OrderStep.CANCELEDBYCLIENT;
        else if (Order.OrderStep.ORDERED == _step && _caller == restaurant) return Order.OrderStep.CANCELEDBYRESTAURANT;
        else if (Order.OrderStep.PREPARATION == _step && now_time > timestamp+3600) return Order.OrderStep.CANCELEDBYRESTAURANT;
        else if (Order.OrderStep.PREPARATION == _step && _caller == client) return Order.OrderStep.CANCELEDBYCLIENT;
        else if (Order.OrderStep.PREPARATION == _step && _caller == restaurant) return Order.OrderStep.CANCELEDBYRESTAURANT;
        else if (Order.OrderStep.WAITING == _step && now_time > timestamp+3600 ) return Order.OrderStep.CANCELEDBYRESTAURANT;
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
    function addRatingTicket(address deliveryWorker, uint256 raterCommitment) external;
    function getWorkerStats(address worker) external view returns (uint256 avgScore, uint256 totalRatings, uint256 completedOrders);
    function submitRating(address worker, uint256 score, uint256 nullifierHash, uint256 root, uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c) external;
    function depositPayment(uint256 commitment) external payable;
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
    string private itemsClient;
    
    uint256 private clientCode;
    uint256[2] private deliverymenCode;
    
    IGlobalReputation public reputationContract;
    uint256 private clientRatingCommitment;
    uint256 private restaurantRatingCommitment;
    uint256 private restaurantPaymentCommitment; // poseidon(nullifier, trapdoor) for ZK payment note
    uint256 private minReputation; // 0 = no minimum; uses ×10 scale (e.g. 35 = 3.5 stars)
    uint256 private minOrders;     // 0 = no minimum; minimum completed orders required
    
    /// @dev Function cannot be called at this time.
    string private FunctionInvalidAtThisStep = "Function cannot be called at this step";
        
    
    /// @dev Sender not authorized for this
    /// operation.
    string private Unauthorized = "This caller is unauthorized";
    
    modifier clientRestricted {
        require(client == msg.sender);
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

    
    constructor (uint256 _id, address _client, address _restaurant, uint256 _deliveryPrice, uint256 _total, string memory _items, string memory _items_client,
    uint256 _clientCommitment, address _reputationContract) payable {
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
        
        bytes32 prevHash = blockhash(block.number - 1);
        clientCode = Util.random(prevHash, msg.sender, _id, 1);
        deliverymenCode[0] = Util.random(prevHash, msg.sender, _id, 2);
        deliverymenCode[1] = Util.random(prevHash, msg.sender, _id, 3);
        emit OrderActors (_client, address(0), address(0), address(this));
        clientRatingCommitment = _clientCommitment;
        reputationContract = IGlobalReputation(_reputationContract);
    }
    
    
    function getPayment () public view  returns (uint256, uint256, uint256, uint256){
        uint256 d1 = deliverymen.length >= 1 ? payment[deliverymen[0]] : 0;
        uint256 d2 = deliverymen.length >= 2 ? payment[deliverymen[1]] : 0;
        return (payment[client], payment[restaurant], d1, d2);
    }
    
    function acceptOrder (address _restaurant, uint256 _restaurantCommitment, uint256 _paymentCommitment, uint256 _minReputation, uint256 _minOrders) onlyBy(_restaurant, restaurant) atStep(OrderStep.ORDERED) external payable returns (bool) {
        require(msg.value >= deliveryPrice, "Insuficient funds to complete a order.");
        payment[_restaurant] += msg.value;
        step = OrderStep.PREPARATION;
        timestamp[OrderStep.PREPARATION] = block.timestamp;
        restaurantRatingCommitment = _restaurantCommitment;
        restaurantPaymentCommitment = _paymentCommitment;
        minReputation = _minReputation;
        minOrders = _minOrders;
        emit OrderActors (client, _restaurant, address(0), address(this));
        return true;
    }    
    
    function confirmIntention (address _deliveryman) atStep(OrderStep.PREPARATION)  external payable returns (bool) {
        //require(msg.value >= total);
        if (minReputation > 0 || minOrders > 0) {
            (uint256 avgScore, uint256 totalRatings, uint256 completedOrders) = reputationContract.getWorkerStats(_deliveryman);
            if (minReputation > 0) {
                require(totalRatings > 0, "Deliveryman has no ratings yet");
                require(avgScore >= minReputation, "Deliveryman reputation below minimum required");
            }
            if (minOrders > 0) {
                require(completedOrders >= minOrders, "Deliveryman does not have enough completed orders");
            }
        }
        deliverymen.push(_deliveryman);
        payment[_deliveryman] += msg.value;
        step = OrderStep.WAITING;
        timestamp[OrderStep.WAITING] = block.timestamp;
        emit OrderActors (client, restaurant, _deliveryman, address(this));
        return true;
    }    
    
    
    function callSecondDeliveryman (address _restaurant) onlyBy(_restaurant, restaurant) atStep(OrderStep.WAITING)  external returns (bool) {
        step = OrderStep.PREPARATION;
        timestamp[OrderStep.PREPARATION] = block.timestamp;
        return true;
    }    
  
    
    function pickupOrder (address _restaurant, uint256 _code) onlyBy(_restaurant, restaurant) atStep(OrderStep.WAITING)  external returns (bool) {
        if (deliverymen.length == 1 ) require(_code == deliverymenCode[0], "Invalid code!");
        else require(_code == deliverymenCode[1], "Invalid code!");
        step = OrderStep.DISPATCHED;
        timestamp[OrderStep.DISPATCHED] = block.timestamp;
        return true;
    }    
    
    
    function deliveryOrder (address _deliveryman, uint256 _code) atStep(OrderStep.DISPATCHED)  external returns (bool) {
        if (deliverymen.length == 1) {
             require(_deliveryman == deliverymen[0] && _code == clientCode, Unauthorized);
        } else {
            require(_deliveryman == deliverymen[1] && _code == clientCode, Unauthorized);
        }
        step = OrderStep.CONCLUDED;
        timestamp[OrderStep.CONCLUDED] = block.timestamp;

        // Register the anonymous tickets in the Global Reputation contract.
        reputationContract.addRatingTicket(_deliveryman, clientRatingCommitment);
        reputationContract.addRatingTicket(_deliveryman, restaurantRatingCommitment);
        _distributePayments();
        return true;
    }    
    
    function contestOrder (address _restaurant, bool aval) onlyBy(_restaurant, restaurant) atStep(OrderStep.DISPATCHED)  external returns (bool) {
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
        _distributePayments();
        return true;
    }   
    
    
    function cancelOrder (address _caller) onlyByMembers(_caller)  external returns (bool) {
        OrderStep _step = Util.whoCancel(_caller, step, client, restaurant, deliverymen, block.timestamp, timestamp[step]);
        if (step!=_step) {
            timestamp[_step] = block.timestamp;
            step = _step;
            _distributePayments();
            return true;
        }
        else
            return true;
    }
    
    
    function getItems(address _caller) external view returns (uint256, string memory, uint256, string memory, address, uint256, uint256, uint256, address, uint256, uint256){
        address address_deliveryman = address(0);
        if (_caller == client && deliverymen.length == 1) {
            address_deliveryman = deliverymen[0];
        } else if (_caller == client && deliverymen.length == 2) {
            address_deliveryman = deliverymen[1];
        }
        if (_caller==client){
            return (id, itemsClient, deliveryPrice, Util.getOrderStepValue(step), restaurant, clientCode, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman, minReputation, minOrders);
        } else if (_caller == restaurant) {
            // Reveal deliveryman address to restaurant so they can submit ZK rating after conclusion
            address restaurant_deliveryman = deliverymen.length > 0 ? deliverymen[deliverymen.length - 1] : address(0);
            return (id,items, deliveryPrice, Util.getOrderStepValue(step), address(0), 0, timestamp[OrderStep.ORDERED], timestamp[step], restaurant_deliveryman, minReputation, minOrders);
        } else if (deliverymen.length == 1 && _caller == deliverymen[0]) {
            return (id,string(""), deliveryPrice, Util.getOrderStepValue(step), restaurant, deliverymenCode[0], timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman, minReputation, minOrders);
        } else if (deliverymen.length == 2 && _caller == deliverymen[1]) {
            return (id,string(""), deliveryPrice, Util.getOrderStepValue(step), restaurant, deliverymenCode[1], timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman, minReputation, minOrders);
        } else if (step == OrderStep.PREPARATION) {
            return (id, string(""), deliveryPrice, Util.getOrderStepValue(step), restaurant, total, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman, minReputation, minOrders);
        } else {
            return (id, string(""), 0,string(""), address(0), 0, 0, 0, address_deliveryman, 0, 0);
        }

    }
    
    function relatedTo(address _caller) external view returns (bool) {
        return Util.onlyByMembers(_caller, client, restaurant, deliverymen);
    }
    
    function toBeTaken() external view returns (bool) {
        return step == OrderStep.PREPARATION;
    }
    
    function _distributePayments() internal {
        (uint256 _client, uint256 _restaurant, uint256 _deliveryman_1, uint256 _deliveryman_2) =
            Util.payment(step, total, deliveryPrice, deliverymen.length, payment[restaurant]);

        if (_client > 0) {
            payment[client] = 0;
            (bool s1, ) = payable(client).call{value: _client}("");
            require(s1, "Client payment failed");
        }
        if (_restaurant > 0) {
            payment[restaurant] = 0;
            // For CONCLUDED orders with a payment commitment: deposit into ZK payment pool
            // For cancellations or orders without commitment: direct transfer (fallback)
            if (step == OrderStep.CONCLUDED && restaurantPaymentCommitment != 0) {
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
    
  //send tips
  
  //rate actors
   
}