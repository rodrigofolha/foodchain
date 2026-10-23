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
    mapping(address => bool) public isOrder; // Order contracts created here (read by GlobalReputation and Storage)
    uint256 private lastOrder = 0;

    // The reputation and storage contracts every order of this Chain uses. They are fixed
    // at deployment: an order's ratings, reputation thresholds and revenue deposit
    // go to `reputation`, and the committed worker's key goes to `storageContract`.
    address public immutable reputation;
    address public immutable storageContract;

    // The code of every order, deployed once by the constructor. makeOrder creates an EIP-1167
    // minimal proxy (45 bytes) that delegates to it; the proxy is the order: its address, its
    // balance and its storage are its own.
    address public immutable orderImplementation;

    event OrderZone(address indexed orderAddress, string zone);

    constructor(address _reputation, address _storage) {
        require(_reputation != address(0) && _storage != address(0), "Invalid address");
        reputation = _reputation;
        storageContract = _storage;
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

    function makeOrder(
        address _restaurant, uint256 _deliveryPrice, uint256 _total,
        string memory _items, string memory _items_client,
        address _reputationContract,
        address _stealthAddress, uint256 _gasStipend,
        string memory _zone
    ) public payable returns (uint256) {
        require(_reputationContract == reputation, "Unknown reputation contract");

        // If stealth address provided, use it as the restaurant address for the Order.
        // (_restaurant and _total are reused as the effective values instead of two more locals:
        // the external initialize call needs the stack slots.)
        if (_stealthAddress != address(0)) {
            _restaurant = _stealthAddress;
        }

        // Gas stipend is deducted from total (restaurant pays from revenue)
        if (_gasStipend > 0 && _stealthAddress != address(0)) {
            require(_gasStipend <= _total, "Gas stipend exceeds total");
            _total = _total - _gasStipend;
            // Send gas stipend to stealth address so it can sign transactions
            (bool sent, ) = payable(_stealthAddress).call{value: _gasStipend}("");
            require(sent, "Gas stipend transfer failed");
        }

        lastOrder++;
        // The proxy is created and initialized in this one transaction, by this contract only
        orders[lastOrder] = Order(_clone(orderImplementation));
        orders[lastOrder].initialize{value: msg.value - _gasStipend}(
            lastOrder, msg.sender, _restaurant, _deliveryPrice, _total,
            _items, _items_client, _reputationContract
        );
        isOrder[address(orders[lastOrder])] = true;

        // Emit zone as event (cheaper than storage, no stack-too-deep)
        if (bytes(_zone).length > 0) {
            emit OrderZone(address(orders[lastOrder]), _zone);
        }

        return lastOrder;
    }

    function prepareOrder(address orderAddress, uint256 _paymentCommitment, uint256 _minReputation, uint256 _minOrders) public payable returns (bool) {
      return Order(orderAddress).acceptOrder{value: msg.value}(msg.sender, _paymentCommitment, _minReputation, _minOrders);
    }
    
    // Not payable: the worker makes no deposit, and no payout rule would return one.
    function confirmIntention(address orderAddress, uint256 index, address storage_address, bytes32  firstHalf, bytes32 secondHalf) public {
      require(address(orders[index]) == orderAddress, "Index does not match order");
      require(storage_address == storageContract, "Unknown storage contract");
      Order(orderAddress).confirmIntention(msg.sender);
      Storage(storage_address).addDeliveryman(index, firstHalf, secondHalf);
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

    // The order's customer or its establishment rates a worker of that order (score 1 to 5):
    // the worker who delivered, or a worker who left the order.
    function rateOrder(address orderAddress, address worker, uint256 score) public returns (bool) {
        return Order(orderAddress).rateOrder(msg.sender, worker, score);
    }

}