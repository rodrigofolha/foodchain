// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import './No_Order.sol';

/**
 * @title No_Chain
 * @dev Make, accept, reject orders
 */
contract No_Chain {
    mapping(uint => Order) private orders;
    uint256 private lastOrder = 0;

    // Ratings in the clear, as in Chain and GlobalReputation, for a concluded order only: its
    // customer and its establishment rate the worker who delivered it. The rules for workers
    // who leave an order (rating after leaving, reopening) are not part of this baseline.
    struct WorkerStats {
        uint64 totalScore;
        uint48 totalRatings;
    }
    mapping(address => WorkerStats) public workers;

    // The scores given on an order (0 = not rated yet)
    struct OrderRatings {
        uint8 byClient;
        uint8 byEstablishment;
    }
    mapping(address => OrderRatings) public orderRatings;

    event OrderRated(address indexed worker, address indexed order, bool byClient, uint256 score);

    // The code of every order, deployed once by the constructor, as in Chain. makeOrder creates an
    // EIP-1167 minimal proxy (45 bytes) that delegates to it; the proxy is the order: its address,
    // its balance and its storage are its own.
    address public immutable orderImplementation;

    constructor() {
        // Deployed here so that the implementation's immutable `chain` is this contract
        orderImplementation = address(new Order());
    }

    // EIP-1167 minimal proxy to `_implementation` (the creation code of OpenZeppelin's Clones.clone):
    // runtime code 363d3d373d3d3d363d73 <implementation> 5af43d82803e903d91602b57fd5bf3
    function _clone(address _implementation) private returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, _implementation))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        require(instance != address(0), "Clone failed");
    }

    function makeOrder(address _restaurant, uint256 _deliveryPrice, uint256 _total, string memory _items) public payable returns (uint256){
        lastOrder++;
        // The proxy is created and initialized in this one transaction, by this contract only
        orders[lastOrder] = Order(_clone(orderImplementation));
        orders[lastOrder].initialize{value: msg.value}(lastOrder, msg.sender, _restaurant, _deliveryPrice, _total, _items);
        return lastOrder;
    }

    function prepareOrder(address orderAddress) public payable returns (bool) {
      return Order(orderAddress).acceptOrder{value: msg.value}(msg.sender);
    }
    
    // Not payable: the worker makes no deposit, and no payout rule would return one.
    function confirmIntention(address orderAddress, uint256 index, address storage_address, bytes32  firstHalf, bytes32 secondHalf) public {
      Order(orderAddress).confirmIntention(msg.sender);
    }
    
    function callSecondDeliveryman (address orderAddress) public returns (bool) {
        return Order(orderAddress).callSecondDeliveryman(msg.sender);
    }
    
    
    // The establishment submits the worker's pickup confirmation (signature).
    function pickupOrder(address orderAddress, bytes calldata workerSignature) public returns (bool) {
        return Order(orderAddress).pickupOrder(msg.sender, workerSignature);
    }
    
    // The worker submits the customer's delivery confirmation (signature).
    function deliveryOrder(address orderAddress, bytes calldata clientSignature) public  {
        Order(orderAddress).deliveryOrder(msg.sender, clientSignature);
    }

    // Digest to sign for a handover: action 1 = pickup (signed by the worker),
    // action 2 = delivery (signed by the customer).
    function handoverDigest(address orderAddress, uint8 action, address worker) public view returns (bytes32) {
        return Order(orderAddress).handoverDigest(action, worker);
    }
    
    function contestOrder (address orderAddress, bool aval) public  {
        Order(orderAddress).contestOrder(msg.sender, aval);
    }

    
    function cancelOrder(address orderAddress) public  {
        Order(orderAddress).cancelOrder(msg.sender);
    }
    
    // The order's customer or its establishment rates the worker who delivered it (score 1 to 5),
    // once each. An account that is both rates as the customer.
    function rateOrder(address orderAddress, address worker, uint256 score) public returns (bool) {
        (uint256 index, bool delivered, bool byClient, bool byEstablishment) = Order(orderAddress).ratingInfo(msg.sender, worker);
        // Only an order created here adds to a worker's record
        require(address(orders[index]) == orderAddress, "Unknown order");
        require(byClient || byEstablishment, "This caller is unauthorized");
        require(score >= 1 && score <= 5, "Score must be between 1 and 5");
        require(delivered, "This worker cannot be rated on this order");

        OrderRatings storage given = orderRatings[orderAddress];
        if (byClient) {
            require(given.byClient == 0, "Already rated");
            given.byClient = uint8(score);
        } else {
            require(given.byEstablishment == 0, "Already rated");
            given.byEstablishment = uint8(score);
        }

        workers[worker].totalScore += uint64(score);
        workers[worker].totalRatings += 1;
        emit OrderRated(worker, orderAddress, byClient, score);
        return true;
    }

    // There is no withdraw: an order pays its parties in the transaction that ends it
    // (deliveryOrder, contestOrder, cancelOrder), as the privacy contracts do.

    function getOrder(address orderAddress) public view returns (uint256, string memory, uint256, string memory, address, uint256, uint256, uint256, address){
        return Order(orderAddress).getItems(msg.sender);
    }          
    
    function findAddress(uint256 orderAddress) public view returns (address) {
        return address(orders[orderAddress]);
    }
    
    function getIndex() public view returns (uint256) {
        return lastOrder;
    }
    
}