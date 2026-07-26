// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import './Order.sol';
import './Storage.sol';

/**
 * @title Chain
 * @dev Make, accept, reject orders
 */
contract Chain {
    mapping(uint => Order) private orders;
    uint256 private lastOrder = 0;

    event OrderZone(address indexed orderAddress, string zone);

    function makeOrder(
        address _restaurant, uint256 _deliveryPrice, uint256 _total,
        string memory _items, string memory _items_client,
        uint256 _clientCommitment, address _reputationContract,
        address _stealthAddress, uint256 _gasStipend,
        string memory _zone
    ) public payable returns (uint256) {
        // If stealth address provided, use it as the restaurant address for the Order
        address effectiveRestaurant = _stealthAddress != address(0) ? _stealthAddress : _restaurant;

        // Gas stipend is deducted from total (restaurant pays from revenue)
        uint256 effectiveTotal = _total;
        if (_gasStipend > 0 && _stealthAddress != address(0)) {
            require(_gasStipend <= _total, "Gas stipend exceeds total");
            effectiveTotal = _total - _gasStipend;
            // Send gas stipend to stealth address so it can sign transactions
            (bool sent, ) = payable(_stealthAddress).call{value: _gasStipend}("");
            require(sent, "Gas stipend transfer failed");
        }

        lastOrder++;
        orders[lastOrder] = new Order{value: msg.value - _gasStipend}(
            lastOrder, msg.sender, effectiveRestaurant, _deliveryPrice, effectiveTotal,
            _items, _items_client, _clientCommitment, _reputationContract
        );

        // Emit zone as event (cheaper than storage, no stack-too-deep)
        if (bytes(_zone).length > 0) {
            emit OrderZone(address(orders[lastOrder]), _zone);
        }

        return lastOrder;
    }

    function prepareOrder(address orderAddress, uint256 _restaurantCommitment, uint256 _paymentCommitment, uint256 _minReputation, uint256 _minOrders) public payable returns (bool) {
      return Order(orderAddress).acceptOrder{value: msg.value}(msg.sender, _restaurantCommitment, _paymentCommitment, _minReputation, _minOrders);
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
    
    function getOrder(address orderAddress) public view returns (uint256, string memory, uint256, string memory, address, uint256, uint256, uint256, address, uint256, uint256){
        return Order(orderAddress).getItems(msg.sender);
    }

    function findAddress(uint256 orderAddress) public view returns (address) {
        return address(orders[orderAddress]);
    }

    function getIndex() public view returns (uint256) {
        return lastOrder;
    }

    function getWorkerReputation(address reputationContract, address worker) public view returns (uint256, uint256, uint256) {
        return IGlobalReputation(reputationContract).getWorkerStats(worker);
    }

    function submitRating(address reputationContract, address worker, uint256 score, uint256 nullifierHash, uint256 root,
        uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c) public {
        IGlobalReputation(reputationContract).submitRating(worker, score, nullifierHash, root, a, b, c);
    }

}