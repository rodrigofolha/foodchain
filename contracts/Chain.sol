// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import './Order.sol';

/**
 * @title Chain
 * @dev Make, accept, reject orders
 */
contract Chain {
    mapping(uint => Order) private orders;
    uint256 private lastOrder = 0;
    

    function makeOrder(address _restaurant, uint256 _deliveryPrice, uint256 _total, string memory _items, string memory _items_client) public payable returns (uint256){
        lastOrder++;
        orders[lastOrder] = new Order{value: msg.value}(lastOrder, msg.sender, _restaurant, _deliveryPrice, _total, _items, _items_client);
        return lastOrder;
    }
    
    
    function findAddress(uint256 orderAddress) public view returns (address) {
        return address(orders[orderAddress]);
    }
    
    function getIndex() public view returns (uint256) {
        return lastOrder;
    }
    
}