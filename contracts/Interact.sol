// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import './Order.sol';
import './Storage.sol';

contract Interact {
    function prepareOrder(address orderAddress) public payable returns (bool) {
      return Order(orderAddress).acceptOrder{value: msg.value}(msg.sender);
    }
    
    function confirmIntention(address orderAddress, uint256 index, address storage_address, bytes32  firstHalf, bytes32 secondHalf) public payable {
      Order(orderAddress).confirmIntention{value: msg.value}(msg.sender);
      Storage(storage_address).addDeliveryman(index, firstHalf, secondHalf);
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
    
    
    
    
}