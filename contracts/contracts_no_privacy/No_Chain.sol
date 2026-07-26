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
    

    function makeOrder(address _restaurant, uint256 _deliveryPrice, uint256 _total, string memory _items) public payable returns (uint256){
        lastOrder++;
        orders[lastOrder] = new Order{value: msg.value}(lastOrder, msg.sender, _restaurant, _deliveryPrice, _total, _items);
        return lastOrder;
    }

    function prepareOrder(address orderAddress) public payable returns (bool) {
      return Order(orderAddress).acceptOrder{value: msg.value}(msg.sender);
    }
    
    function confirmIntention(address orderAddress, uint256 index, address storage_address, bytes32  firstHalf, bytes32 secondHalf) public payable {
      Order(orderAddress).confirmIntention{value: msg.value}(msg.sender);
    }
    
    function callSecondDeliveryman (address orderAddress) public returns (bool) {
        return Order(orderAddress).callSecondDeliveryman(msg.sender);
    }
    
    
    function pickupOrder(address orderAddress, uint256 code) public returns (bool) {
        return Order(orderAddress).pickupOrder(msg.sender, code);
    }
    
    function deliveryOrder(address orderAddress, uint256 code) public  {
        Order(orderAddress).deliveryOrder(msg.sender, code);
    }
    
    function contestOrder (address orderAddress, bool aval) public  {
        Order(orderAddress).contestOrder(msg.sender, aval);
    }

    
    function cancelOrder(address orderAddress) public  {
        Order(orderAddress).cancelOrder(msg.sender);
    }
    
    function withdraw(address orderAddress) public payable {
        Order(orderAddress).withdraw(msg.sender);
    }

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