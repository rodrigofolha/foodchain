// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import './Order.sol';
import './Chain.sol';
struct Type {
    uint256 id;
    string items;
    uint256  deliveryPrice;
    string step;
    address restaurant;
    uint256 code;
    uint256 timestamp_creation;
    uint256 timestamp_last_step;
    address deliveryman;
}

/**
 * @title Chain
 * @dev Make, accept, reject orders
 */
contract View {
    
    function getOrder(address orderAddress) public view returns (uint256, string memory, uint256, string memory, address, uint256, uint256, uint256, address){
        return Order(orderAddress).getItems(msg.sender);
    }
    
    function relatedTo(address chainAddress) public view returns (Type[] memory) {
        uint256 lastOrder = Chain(chainAddress).getIndex();
        address orderAddress;
        uint256 j = 0;
        Type[] memory result = new Type[](10);
        for (uint256 i = 1; i <= lastOrder; i++){
            orderAddress = Chain(chainAddress).findAddress(i);
            if (Order(orderAddress).relatedTo(msg.sender)) {
                Type memory order;
                (order.id, order.items, order.deliveryPrice, order.step, order.restaurant, order.code, order.timestamp_creation, order.timestamp_last_step, ) = getOrder(orderAddress);
                (, , , , , , , ,order.deliveryman) = getOrder(orderAddress);
                result[j%10] = order;
                j++;
            }
        }
        return result;
    }
    
    function toBeTaken(address chainAddress) public view returns (uint256, string memory, uint256, string memory, address, uint256, uint256, uint256, address) {
        uint256 lastOrder = Chain(chainAddress).getIndex();
        address orderAddress;
        string memory null_string;
        for (uint256 i = 1; i <= lastOrder; i++){
            orderAddress = Chain(chainAddress).findAddress(i);
            if (Order(orderAddress).toBeTaken()) {
                return getOrder(orderAddress);
            }
        }
        return (0, null_string, 0, null_string, address(0), 0, 0, 0, address(0));
    }
    
}