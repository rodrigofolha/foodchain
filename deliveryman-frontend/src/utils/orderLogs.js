// Reading orders and the customer's delivery details from event logs.
// Every function gets the web3 objects it needs. The queries go through getLogsChunked,
// which splits a long range of blocks into the windows that public endpoints accept.

import { getLogsChunked } from './chainLogs';

// keccak256('OrderActors(address,address,address,address)'), emitted by each order
export const ORDER_ACTORS_TOPIC = '0x3aab3448479337ae16f6a4a2ab87a664e7aad6b0c280f483bf1be0c16f888643';
// keccak256('Information(uint256,uint256,string,string)'), emitted by Storage
export const INFORMATION_TOPIC = '0x1638e5d26692d53da8420f0d8b42154ae401d14d0c39f96eedcb31d394eb9034';

const ZERO_TOPIC = '0x' + '0'.repeat(64);

function sameText(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}

function byPosition(a, b) {
  return (Number(a.blockNumber) - Number(b.blockNumber)) || (Number(a.logIndex) - Number(b.logIndex));
}

// The 32-byte topic of an address
export function addressTopic(address) {
  return '0x' + '0'.repeat(24) + String(address).slice(2).toLowerCase();
}

// True for an OrderActors log whose emitter is the order it names: four topics, and
// one address as data, the emitter's own. An order always names itself; a log of
// another contract that names an order says nothing about that order.
function isOwnActorsLog(log) {
  if (!log || typeof log.address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(log.address)) return false;
  if (!Array.isArray(log.topics) || log.topics.length !== 4 || !sameText(log.topics[0], ORDER_ACTORS_TOPIC)) return false;
  if (typeof log.data !== 'string' || !/^0x0{24}[0-9a-fA-F]{40}$/.test(log.data)) return false;
  return sameText(log.data.slice(-40), log.address.slice(2));
}

// The emitters of the OrderActors logs of a query, each one once. They are candidates
// only: any contract can emit such a log about itself (see keepChainOrders).
export function orderAddressesFromLogs(logs) {
  const addresses = [];
  (logs || []).forEach((log) => {
    if (!isOwnActorsLog(log)) return;
    const address = '0x' + log.data.slice(-40);
    if (!addresses.some((known) => sameText(known, address))) addresses.push(address);
  });
  return addresses;
}

// Keeps only the addresses that are orders of this Chain. An event named OrderActors
// can be emitted by any contract, so an address from a log is not trusted before this.
// An address whose check fails is dropped.
export async function keepChainOrders(chain, addresses) {
  const kept = [];
  for (let b = 0; b < addresses.length; b += 5) {
    const batch = addresses.slice(b, b + 5);
    const answers = await Promise.all(batch.map((address) =>
      chain.methods.isOrder(address).call().then((answer) => answer === true, () => false)));
    batch.forEach((address, i) => { if (answers[i]) kept.push(address); });
  }
  return kept;
}

// The commitments of one order, oldest first, from that order's OrderActors logs:
// [{ worker, blockNumber }]. The first entry is the order's first worker, the second
// (if any) its second worker.
export function commitmentsFromLogs(logs) {
  return (logs || [])
    .filter((log) => log && Array.isArray(log.topics) && log.topics.length === 4 &&
      sameText(log.topics[0], ORDER_ACTORS_TOPIC) && !sameText(log.topics[3], ZERO_TOPIC))
    .slice()
    .sort(byPosition)
    .map((log) => ({ worker: '0x' + log.topics[3].slice(-40).toLowerCase(), blockNumber: Number(log.blockNumber) }));
}

// The account's own commitment to the order: { position: 1 or 2, blockNumber }, or
// null if they never committed. An account that was both workers gets the later one.
export function workerCommitment(commitments, account) {
  for (let i = commitments.length - 1; i >= 0; i--) {
    if (sameText(commitments[i].worker, account)) {
      return { position: i + 1, blockNumber: commitments[i].blockNumber };
    }
  }
  return null;
}

export async function findWorkerCommitment({ logWeb3, orderAddress, account, deployBlock }) {
  const logs = await getLogsChunked(logWeb3, {
    address: orderAddress,
    fromBlock: deployBlock || 0,
    toBlock: 'latest',
    topics: [ORDER_ACTORS_TOPIC],
  });
  // only logs of the order itself
  return workerCommitment(commitmentsFromLogs(logs.filter((log) => sameText(log.address, orderAddress))), account);
}

// What the customer sent to this worker: the last Information log of Storage for the
// order's index and the worker's own position, from the block of their commitment.
// Returns { commitment, information }: commitment is null if the account never
// committed to the order; information is [encryptedAddress, encryptedItems], or
// ['', ''] while the customer has sent nothing for this worker.
export async function readWorkerInformation({ logWeb3, storageAddress, orderAddress, orderIndex, account, deployBlock }) {
  const commitment = await findWorkerCommitment({ logWeb3, orderAddress, account, deployBlock });
  if (!commitment) return { commitment: null, information: ['', ''] };

  const toTopic = (number) => logWeb3.utils.padLeft(logWeb3.utils.numberToHex(number), 64);
  const logs = await getLogsChunked(logWeb3, {
    address: storageAddress,
    fromBlock: Math.max(commitment.blockNumber, deployBlock || 0),
    toBlock: 'latest',
    topics: [INFORMATION_TOPIC, toTopic(orderIndex), toTopic(commitment.position)],
  });
  const own = logs
    .filter((log) => sameText(log.address, storageAddress) && Array.isArray(log.topics) &&
      sameText(log.topics[0], INFORMATION_TOPIC) &&
      sameText(log.topics[1], toTopic(orderIndex)) &&
      sameText(log.topics[2], toTopic(commitment.position)))
    .sort(byPosition);
  if (own.length === 0) return { commitment, information: ['', ''] };

  const decoded = logWeb3.eth.abi.decodeParameters(['string', 'string'], own[own.length - 1].data);
  return { commitment, information: [decoded[0], decoded[1]] };
}
