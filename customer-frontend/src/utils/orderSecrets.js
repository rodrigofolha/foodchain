// What the customer's browser keeps for each order in the store 'orderSecrets'
// (the pickup secret and the order contract it belongs to) and in the store
// 'orderRestaurantInfo', and how an order placed at checkout is matched to its id
// on-chain. The stores are kept per deployment (see deploymentStorage.js).
// Records written while ratings needed a proof also hold two rating secrets
// (nullifier, trapdoor): they still load, and nothing reads those two fields.
// Between the sending of makeOrder and that match, the same data waits in
// the store 'pendingOrders', under the stealth address of the order.
import { readDeploymentStore, writeDeploymentStore } from './deploymentStorage';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// keccak256('OrderActors(address,address,address,address)'): the order contract
// emits it when it is created, with the customer as the first indexed address.
export const ORDER_ACTORS_TOPIC = '0x3aab3448479337ae16f6a4a2ab87a664e7aad6b0c280f483bf1be0c16f888643';

const ORDER_CLIENT_ABI = [{
  inputs: [{ internalType: 'address', name: '_account', type: 'address' }],
  name: 'isClient',
  outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
  stateMutability: 'view',
  type: 'function',
}];

function isAddress(text) {
  return typeof text === 'string' && /^0x[0-9a-fA-F]{40}$/.test(text);
}

export function sameAddress(a, b) {
  return isAddress(a) && isAddress(b) && a.toLowerCase() === b.toLowerCase();
}

function isOrderContract(address) {
  return isAddress(address) && address !== ZERO_ADDRESS;
}

// The order contract created by a makeOrder transaction: the emitter of the
// OrderActors log that names this customer. Null if the receipt has no such log.
export function orderAddressFromReceipt(receipt, account) {
  if (!receipt || !isAddress(account)) return null;
  // web3 gives the logs of a contract call under `events` (topics and data under
  // `raw`); a plain receipt has them under `logs`.
  let logs = Array.isArray(receipt.logs) ? receipt.logs.slice() : [];
  if (receipt.events && typeof receipt.events === 'object') {
    Object.keys(receipt.events).forEach(function (name) {
      logs = logs.concat(receipt.events[name]);
    });
  }
  const clientTopic = '0x' + '0'.repeat(24) + account.slice(2).toLowerCase();
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (!log || !isOrderContract(log.address)) continue;
    const topics = log.topics || (log.raw && log.raw.topics);
    const data = log.data || (log.raw && log.raw.data);
    if (!Array.isArray(topics) || topics.length < 2 || typeof data !== 'string') continue;
    if (String(topics[0]).toLowerCase() !== ORDER_ACTORS_TOPIC) continue;
    if (String(topics[1]).toLowerCase() !== clientTopic) continue;
    // the event carries the order's own address: it must be the emitter
    if (data.slice(-40).toLowerCase() !== log.address.slice(2).toLowerCase()) continue;
    return log.address;
  }
  return null;
}

// Finds the id of the order a makeOrder transaction created. `previousIndex` is
// Chain.getIndex() read before the transaction. Other orders can be mined in
// between, so the id is not always previousIndex + 1.
// - With the receipt: the id whose order contract is the one the receipt names.
// - Without it: the first new id whose order contract says this account is its
//   customer and that `hasSecrets(id, orderAddress)` does not know yet.
// Returns { orderId, orderAddress }, or null if no order can be resolved.
export async function resolvePlacedOrder(web3, chain, account, previousIndex, receipt, hasSecrets) {
  try {
    const first = parseInt(previousIndex, 10) + 1;
    const last = parseInt(await chain.methods.getIndex().call(), 10);
    if (isNaN(first) || isNaN(last)) return null;
    const created = orderAddressFromReceipt(receipt, account);
    for (let i = first; i <= last; i++) {
      const orderAddress = await chain.methods.findAddress(i).call();
      if (!isOrderContract(orderAddress)) continue;
      if (created) {
        if (sameAddress(orderAddress, created)) return { orderId: i, orderAddress: orderAddress };
        continue;
      }
      if (hasSecrets && hasSecrets(i, orderAddress)) continue;
      const order = new web3.eth.Contract(ORDER_CLIENT_ABI, orderAddress);
      if (await order.methods.isClient(account).call()) return { orderId: i, orderAddress: orderAddress };
    }
  } catch (_) {
    // The chain could not be read: the order is not resolved.
  }
  return null;
}

function readStore(name) {
  return readDeploymentStore(name || 'orderSecrets');
}

// Keeps the secrets of an order. `orderAddress` is the order contract they belong
// to; it is left out when the order could not be resolved on-chain. Returns false
// when nothing was written (no deployment is set).
export function saveOrderSecrets(orderId, secrets, orderAddress) {
  const store = readStore();
  const record = Object.assign({}, secrets);
  if (isOrderContract(orderAddress)) record.orderAddress = orderAddress;
  store[orderId] = record;
  return writeDeploymentStore('orderSecrets', store);
}

// The secrets kept for this order id, to be used for the order contract that has
// this id on-chain now. A record that names another order contract is not used:
// the id was guessed wrong at checkout, or the contracts were deployed again and
// the ids started again. Records without an order contract (older orders) are
// used as they are. Returns null when there is nothing to use.
export function orderSecretsFor(orderId, orderAddress) {
  const record = readStore()[orderId];
  if (!record || typeof record !== 'object') return null;
  if (record.orderAddress && !sameAddress(record.orderAddress, orderAddress)) return null;
  return record;
}

// For resolvePlacedOrder: true if this id already has secrets of this order contract.
export function hasOrderSecrets(orderId, orderAddress) {
  return orderSecretsFor(orderId, orderAddress) !== null;
}

// Keeps what the worker's payload and the orders page need about the establishment
// of an order ({ id, name, address }), with the order contract it belongs to.
export function saveOrderRestaurantInfo(orderId, info, orderAddress) {
  const store = readStore('orderRestaurantInfo');
  const record = Object.assign({}, info);
  if (isOrderContract(orderAddress)) record.orderAddress = orderAddress;
  store[orderId] = record;
  return writeDeploymentStore('orderRestaurantInfo', store);
}

// The establishment kept for this order id, with the same rule as orderSecretsFor:
// a record that names another order contract is not used.
export function orderRestaurantInfoFor(orderId, orderAddress) {
  const record = readStore('orderRestaurantInfo')[orderId];
  if (!record || typeof record !== 'object') return null;
  if (record.orderAddress && !sameAddress(record.orderAddress, orderAddress)) return null;
  return record;
}

// Pending orders: written before makeOrder is sent, so that the secrets survive a
// tab closed during the wait for the receipt, or an order mined late. The stealth
// address is the establishment address of the order on-chain and is used by one
// order only, so it tells later which order the record belongs to.

function pendingKey(stealthAddress) {
  return isAddress(stealthAddress) ? stealthAddress.toLowerCase() : null;
}

export function savePendingOrder(stealthAddress, secrets, restaurantInfo) {
  const key = pendingKey(stealthAddress);
  if (!key) return false;
  const store = readStore('pendingOrders');
  store[key] = {
    stealthAddress: stealthAddress,
    secrets: Object.assign({}, secrets),
    restaurantInfo: Object.assign({}, restaurantInfo),
    createdAt: Date.now(),
  };
  return writeDeploymentStore('pendingOrders', store);
}

export function pendingOrderFor(stealthAddress) {
  const key = pendingKey(stealthAddress);
  const record = key ? readStore('pendingOrders')[key] : null;
  if (!record || typeof record !== 'object' || !record.secrets || typeof record.secrets !== 'object') return null;
  return record;
}

export function removePendingOrder(stealthAddress) {
  const key = pendingKey(stealthAddress);
  if (!key) return;
  const store = readStore('pendingOrders');
  if (!(key in store)) return;
  delete store[key];
  writeDeploymentStore('pendingOrders', store);
}

// For the orders page: gives an order the pending record written at checkout, when
// checkout could not do it (tab closed, order mined late). `stealthAddress` is
// field 4 of Chain.getOrder as the customer sees it. Nothing happens when the
// order already has secrets stored for its own contract, or when no pending record
// has this stealth address. A record without an order contract under this id is
// replaced: the pending record is known to be of this order.
// Returns true if the pending record was adopted.
export function adoptPendingOrder(orderId, orderAddress, stealthAddress) {
  try {
    if (!isOrderContract(orderAddress)) return false;
    const pending = pendingOrderFor(stealthAddress);
    if (!pending) return false;
    const stored = readStore()[orderId];
    const alreadyStored = !!stored && typeof stored === 'object' && sameAddress(stored.orderAddress, orderAddress);
    if (!alreadyStored) {
      // not written (no deployment set): the pending record stays for the next try
      if (!saveOrderSecrets(orderId, pending.secrets, orderAddress)) return false;
      if (pending.restaurantInfo && typeof pending.restaurantInfo === 'object') {
        saveOrderRestaurantInfo(orderId, pending.restaurantInfo, orderAddress);
      }
    }
    // either way the order has its records now
    removePendingOrder(stealthAddress);
    return !alreadyStored;
  } catch (_) {
    // localStorage could not be written: the pending record stays for the next try
    return false;
  }
}
