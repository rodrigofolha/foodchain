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
    
    function random(uint256 timestamp, uint256 difficulty) external pure returns (uint256) {
      return uint8(uint256(keccak256(abi.encodePacked(timestamp, difficulty)))%10000);
    }
    
    function whoCancel(address _caller, Order.OrderStep _step, address client, address restaurant, address[] memory deliverymen, uint256 now_time, uint256 timestamp) external pure returns (Order.OrderStep) {
        if (Order.OrderStep.ORDERED == _step && _caller == client) return Order.OrderStep.CANCELEDBYRESTAURANT;
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
    
    function payment(Order.OrderStep step, address order, uint256 total, uint256 deliveryPrice, uint256 deliverymen ) external view returns (uint256, uint256, uint256, uint256) {
        uint256 client;
        uint256 restaurant;
        uint256 deliveryman_1;
        uint256 deliveryman_2;
        (client, restaurant, deliveryman_1, deliveryman_2) = Order(order).getPayment();
        if (step == Order.OrderStep.CONCLUDED || step == Order.OrderStep.CANCELEDBYCLIENT){
            if (deliverymen == 1) return (client-total-deliveryPrice, restaurant+total, deliveryman_1+deliveryPrice, 0);
            else if (deliverymen == 2) return (client-total-deliveryPrice, restaurant+total, deliveryman_1, deliveryman_2+deliveryPrice);
            else return (client-total, restaurant+total, 0, 0);
        }
        else if (step == Order.OrderStep.CANCELEDBYRESTAURANT){
            if (deliverymen == 1) return (client, restaurant-deliveryPrice, deliveryman_1+deliveryPrice, 0);
            else if (deliverymen == 2) return (client, restaurant-deliveryPrice, deliveryman_1, deliveryman_2+deliveryPrice);
            else return (client, restaurant, 0, 0);
        } else if (step == Order.OrderStep.CANCELEDBYFIRSTDELIVERYMAN){
            if (deliverymen == 1) return (client, restaurant+total, deliveryman_1-total, 0);
            else  return (client, restaurant+total, deliveryman_1-total, deliveryman_2);
        } else if (step == Order.OrderStep.CANCELEDBYSECONDDELIVERYMAN){
            return (client, restaurant+total, deliveryman_1, deliveryman_2-total);
        } else return (0,0,0,0);
    }
} 




contract Order {
    enum OrderStep {ORDERED, PREPARATION, WAITING, DISPATCHED, CONCLUDED, CANCELEDBYCLIENT, CANCELEDBYRESTAURANT, CANCELEDBYFIRSTDELIVERYMAN, CANCELEDBYSECONDDELIVERYMAN}

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

    
    constructor (uint256 _id, address _client, address _restaurant, uint256 _deliveryPrice, uint256 _total, string memory _items, string memory _items_client) payable {
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
        
        clientCode = Util.random(block.timestamp+1000, block.difficulty);
        deliverymenCode[0] = Util.random(block.timestamp, block.difficulty);
        deliverymenCode[1] = Util.random(block.timestamp-33949, block.difficulty);
    }
    
    
    function getPayment () public view  returns (uint256, uint256, uint256, uint256){
        return (payment[client], payment[restaurant], payment[deliverymen[0]], payment[deliverymen[1]]);
    }
    
    function acceptOrder (address _restaurant) onlyBy(_restaurant, restaurant) atStep(OrderStep.ORDERED) external payable returns (bool) {
        require(msg.value >= deliveryPrice, "Insuficient funds to complete a order.");
        payment[_restaurant] += msg.value;
        step = OrderStep.PREPARATION;
        timestamp[OrderStep.PREPARATION] = block.timestamp;
        return true;
    }    
    
    function confirmIntention (address _deliveryman) atStep(OrderStep.PREPARATION)  external payable returns (bool) {
        require(msg.value >= total);
        deliverymen.push(_deliveryman);
        payment[_deliveryman] += msg.value;
        step = OrderStep.WAITING;
        timestamp[OrderStep.WAITING] = block.timestamp;
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
            
        } else return false;
        return true;
    }   
    
    
    function cancelOrder (address _caller) onlyByMembers(_caller)  external returns (bool) {
        OrderStep _step = Util.whoCancel(_caller, step, client, restaurant, deliverymen, block.timestamp, timestamp[step]);
        if (step!=_step) {
            timestamp[_step] = block.timestamp;
            step = _step;
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
            return (id, itemsClient, deliveryPrice, Util.getOrderStepValue(step), restaurant, clientCode, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman);    
        } else if (_caller == restaurant) {
            return (id,items, deliveryPrice, Util.getOrderStepValue(step), address(0), 0, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman);   
        } else if (deliverymen.length == 1 && _caller == deliverymen[0]) {
            return (id,string(""), deliveryPrice, Util.getOrderStepValue(step), restaurant, deliverymenCode[0], timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman);   
        } else if (deliverymen.length == 2 && _caller == deliverymen[1]) {
            return (id,string(""), deliveryPrice, Util.getOrderStepValue(step), restaurant, deliverymenCode[1], timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman);   
        } else if (step == OrderStep.PREPARATION) {
            return (id, string(""), deliveryPrice, Util.getOrderStepValue(step), restaurant, total, timestamp[OrderStep.ORDERED], timestamp[step], address_deliveryman);    
        } else {
            return (id, string(""), 0,string(""), address(0), 0, 0, 0, address_deliveryman);
        }
        
    }
    
    function relatedTo(address _caller) external view returns (bool) {
        return Util.onlyByMembers(_caller, client, restaurant, deliverymen);
    }
    
    function toBeTaken() external view returns (bool) {
        return step == OrderStep.PREPARATION;
    }
    
    function withdraw(address _caller) external payable{
        uint256 _client;
        uint256 _restaurant;
        uint256 _deliveryman_1;
        uint256 _deliveryman_2;
        (_client, _restaurant, _deliveryman_1, _deliveryman_2) = Util.payment(step, address(this), total, deliveryPrice, deliverymen.length);
        if (_caller == client && _client>0) {
            payable(client).transfer(_client);
            payment[client]=0;
         
        } else if (_caller == restaurant && _restaurant>0) {
            payable(client).transfer(_restaurant);
            payment[restaurant]=0;
            
        } else if (_caller == deliverymen[0] && _deliveryman_1>0) {
            payable(client).transfer(_deliveryman_1);
            payment[deliverymen[0]]=0;
        } 
        // else if (_caller == deliverymen[1] && _deliveryman_2>0) {
        //     payable(client).transfer(_deliveryman_2);
        //     payment[deliverymen[1]]=0;
        // }
    }
    
  //send tips
  
  //rate actors
   
}