// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import './Order.sol';
import './Chain.sol';
struct EncAddress {
    bytes32[] firstHalf;
    bytes32[] secondHalf;
    string encryptedAddress_delivery1;
    string encryptedAddress_delivery2;
    string encryptedItems_delivery1;
    string encryptedItems_delivery2;
    uint256 timestamp;
}


contract Storage {
    
    mapping  (uint256=>EncAddress) private encryptedBook;
    
    function addInformation(uint256 _index, string memory encrypted_address, string memory encrypted_items) public  {
        if (encryptedBook[_index].firstHalf.length == 1) {
            encryptedBook[_index].encryptedAddress_delivery1 = encrypted_address;
            encryptedBook[_index].encryptedItems_delivery1 = encrypted_items;
            
        } else if (encryptedBook[_index].firstHalf.length == 2) {
            encryptedBook[_index].encryptedAddress_delivery2 = encrypted_address;
            encryptedBook[_index].encryptedItems_delivery2 = encrypted_items;
        } 
    }
    
    function readInformation(uint256 _index) public view returns (string memory, string memory) {
        if (encryptedBook[_index].firstHalf.length == 1 ) {
            return (encryptedBook[_index].encryptedAddress_delivery1, encryptedBook[_index].encryptedItems_delivery1);
        } else  {
            return (encryptedBook[_index].encryptedAddress_delivery2, encryptedBook[_index].encryptedItems_delivery2);
        } 
    }
    
    function addDeliveryman(uint256 _index, bytes32 _firstHalf, bytes32 _secondHalf) external  {
        if (encryptedBook[_index].firstHalf.length == 0) {
            encryptedBook[_index].timestamp = block.timestamp;
            encryptedBook[_index].firstHalf.push(_firstHalf);
            encryptedBook[_index].secondHalf.push(_secondHalf);
        } else if (encryptedBook[_index].firstHalf.length == 1) {
            encryptedBook[_index].firstHalf.push(_firstHalf);
            encryptedBook[_index].secondHalf.push(_secondHalf);
        }
            
    }
    
    function getDeliveryman(uint256 _index) public view returns (bytes32, bytes32) {
        if (encryptedBook[_index].firstHalf.length == 1) {
            return (encryptedBook[_index].firstHalf[0], encryptedBook[_index].secondHalf[0]);
        } else if (encryptedBook[_index].firstHalf.length == 2) {
             return (encryptedBook[_index].firstHalf[1], encryptedBook[_index].secondHalf[1]);
        } else 
            return (bytes32(0), bytes32(0));
        
    }
    

    
}