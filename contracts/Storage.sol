// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import './Order.sol';
import './Chain.sol';
struct EncAddress {
    bytes32[] firstHalf;
    bytes32[] secondHalf;
    uint256 timestamp;
}


interface IChainOrders {
    function findAddress(uint256 orderIndex) external view returns (address);
}

interface IOrderClient {
    function isClient(address account) external view returns (bool);
}

contract Storage {
    
    mapping  (uint256=>EncAddress) private encryptedBook;

    // The ciphertexts for the committed worker of order `index` (the index Chain gave the order):
    // `deliveryman` is 1 for the order's first worker and 2 for its second. They are not kept in
    // storage: the worker reads them from this log (address = this contract, topics = index and
    // deliveryman; the last one counts if the customer posted more than once).
    event Information(uint256 indexed index, uint256 indexed deliveryman, string encryptedAddress, string encryptedItems);

    address public immutable owner;
    address public chain; // set once, after Chain is deployed

    constructor() {
        owner = msg.sender;
    }

    /// @notice Links this contract to the Chain that creates orders. Callable once, by the deployer.
    function setChain(address _chain) external {
        require(msg.sender == owner, "Only owner");
        require(chain == address(0), "Chain already set");
        require(_chain != address(0), "Invalid chain");
        chain = _chain;
    }
    
    /// @notice Publishes the ciphertexts for the committed worker, as an event. Only the order's customer can.
    ///         Nothing is emitted while no worker has committed (as nothing was stored then).
    function addInformation(uint256 _index, string calldata encrypted_address, string calldata encrypted_items) external  {
        address order = IChainOrders(chain).findAddress(_index);
        require(order != address(0) && IOrderClient(order).isClient(msg.sender), "Only the order's customer");
        uint256 deliveryman = encryptedBook[_index].firstHalf.length;
        if (deliveryman == 1 || deliveryman == 2) {
            emit Information(_index, deliveryman, encrypted_address, encrypted_items);
        }
    }
    
    /// @notice Registers the committed worker's encryption key. Only Chain can call it, from confirmIntention.
    function addDeliveryman(uint256 _index, bytes32 _firstHalf, bytes32 _secondHalf) external  {
        require(msg.sender == chain, "Only Chain");
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