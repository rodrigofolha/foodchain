/* global BigInt */
// The workers of an order, as the customer's pages need them: which order addresses
// of a log query are real, who committed to an order and in which position, what
// the customer may rate, and whether the delivery details were sent to a worker.

// OrderActors is emitted by each order: at creation, at acceptance and at every
// commitment of a worker.
import { ethers } from 'ethers';
import { ORDER_ACTORS_TOPIC, sameAddress as same } from './orderSecrets';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// keccak256('Information(uint256,uint256,string,string)'), emitted by Storage when
// the customer sends the delivery details: indexed order id, indexed position of
// the worker they are for (1 = first worker of the order, 2 = second).
export const INFORMATION_TOPIC = '0x1638e5d26692d53da8420f0d8b42154ae401d14d0c39f96eedcb31d394eb9034';

// GlobalReputation.orderRatings(order, worker).outcome
export const OUTCOME_NONE = 0;
export const OUTCOME_LEFT_BEFORE_PICKUP = 1;
export const OUTCOME_LEFT_AFTER_PICKUP = 2;
export const OUTCOME_DELIVERED = 3;

function isAddress(text) {
  return typeof text === 'string' && /^0x[0-9a-fA-F]{40}$/.test(text);
}

function isWorker(address) {
  return isAddress(address) && address.toLowerCase() !== ZERO_ADDRESS;
}

// The address in a 32-byte topic, written as the contracts' views return it, or null.
function topicAddress(topic) {
  if (typeof topic !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(topic)) return null;
  return ethers.utils.getAddress('0x' + topic.slice(-40));
}

// An unsigned number as a 32-byte topic.
export function uintTopic(value) {
  return '0x' + BigInt(value).toString(16).padStart(64, '0');
}

// True for an OrderActors log whose emitter is the order it names. An order always
// names itself; a log that names another contract proves nothing about that contract.
function isOwnActorsLog(log) {
  if (!log || !isWorker(log.address)) return false;
  if (!Array.isArray(log.topics) || log.topics.length < 4 || typeof log.data !== 'string') return false;
  if (String(log.topics[0]).toLowerCase() !== ORDER_ACTORS_TOPIC) return false;
  return log.data.slice(-40).toLowerCase() === log.address.slice(2).toLowerCase();
}

// The emitters of the OrderActors logs of a query, each once. They are candidates
// only: any contract can emit an event with this name (see keepChainOrders).
export function orderAddressesFromLogs(logs) {
  const seen = {};
  const addresses = [];
  (Array.isArray(logs) ? logs : []).forEach(function (log) {
    if (!isOwnActorsLog(log)) return;
    const key = log.address.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    addresses.push(log.address);
  });
  return addresses;
}

// Keeps the addresses that Chain says are its orders. An address whose check fails
// (the node could not be read) is not kept.
export async function keepChainOrders(chain, addresses) {
  const kept = [];
  for (let b = 0; b < addresses.length; b += 5) {
    const batch = addresses.slice(b, b + 5);
    const answers = await Promise.all(batch.map(function (address) {
      return chain.methods.isOrder(address).call().catch(function () { return false; });
    }));
    for (let i = 0; i < batch.length; i++) {
      if (answers[i] === true) kept.push(batch[i]);
    }
  }
  return kept;
}

// The commitments of workers to one order, oldest first, from its OrderActors logs:
// [{ worker, position, blockNumber }]. Position 1 is the first worker of the order,
// 2 the one who committed after the first left. Logs of other emitters are ignored.
export function commitmentsFromLogs(logs, orderAddress) {
  const own = (Array.isArray(logs) ? logs : []).filter(function (log) {
    return isOwnActorsLog(log) && same(log.address, orderAddress) && isWorker(topicAddress(log.topics[3]));
  });
  own.sort(function (a, b) {
    return (Number(a.blockNumber) - Number(b.blockNumber)) || (Number(a.logIndex) - Number(b.logIndex));
  });
  return own.map(function (log, i) {
    return { worker: topicAddress(log.topics[3]), position: i + 1, blockNumber: Number(log.blockNumber) };
  });
}

// The commitments of one order, read from the node. Used when the page has no
// logs of this order yet.
export async function readCommitments(logWeb3, orderAddress, fromBlock) {
  const logs = await logWeb3.eth.getPastLogs({
    address: orderAddress,
    topics: [ORDER_ACTORS_TOPIC],
    fromBlock: fromBlock || 0,
    toBlock: 'latest',
  });
  return commitmentsFromLogs(logs, orderAddress);
}

// Every worker of an order, each once, oldest first. `currentWorker` (field 8 of
// Chain.getOrder) is added when the logs do not name it, for example when the logs
// could not be read.
export function workersOfOrder(commitments, currentWorker) {
  const workers = [];
  (Array.isArray(commitments) ? commitments : []).forEach(function (c) {
    if (c && isWorker(c.worker) && !workers.some(function (w) { return same(w, c.worker); })) workers.push(c.worker);
  });
  if (isWorker(currentWorker) && !workers.some(function (w) { return same(w, currentWorker); })) workers.push(currentWorker);
  return workers;
}

// The last commitment, if it is the one of the worker committed now. Null when the
// logs do not show it (not read, or behind the chain).
export function currentCommitment(commitments, currentWorker) {
  if (!Array.isArray(commitments) || commitments.length === 0 || !isWorker(currentWorker)) return null;
  const last = commitments[commitments.length - 1];
  return same(last.worker, currentWorker) ? last : null;
}

// What the customer may do about one worker of an order, from the answer of
// GlobalReputation.orderRatings(order, worker): (outcome, byClient, byEstablishment).
// The customer rates a worker who delivered or who left after pickup, once.
export function customerRatingState(worker, answer) {
  const outcome = answer ? parseInt(answer[0], 10) : NaN;
  const score = answer ? parseInt(answer[1], 10) : NaN;
  if (isNaN(outcome) || isNaN(score)) {
    return { worker: worker, known: false, outcome: null, score: 0, rated: false, canRate: false };
  }
  const rated = score > 0;
  const mayRate = outcome === OUTCOME_DELIVERED || outcome === OUTCOME_LEFT_AFTER_PICKUP;
  return { worker: worker, known: true, outcome: outcome, score: score, rated: rated, canRate: mayRate && !rated };
}

// The rating state of each worker of an order. A worker whose read fails comes
// back with known = false and cannot be rated from the page.
export async function readWorkerRatings(reputation, orderAddress, workers) {
  return Promise.all(workers.map(function (worker) {
    return reputation.methods.orderRatings(orderAddress, worker).call()
      .then(function (answer) { return customerRatingState(worker, answer); })
      .catch(function () { return customerRatingState(worker, null); });
  }));
}

// One line about what a worker did on the order, or null when the order reported
// nothing about them (still committed, or paid by a cancellation).
export function outcomeText(outcome) {
  if (outcome === OUTCOME_DELIVERED) return 'delivered this order';
  if (outcome === OUTCOME_LEFT_AFTER_PICKUP) return 'left this order after pickup';
  if (outcome === OUTCOME_LEFT_BEFORE_PICKUP) return 'left this order before pickup';
  return null;
}

// True if the customer has sent the delivery details for the worker in `position`
// of this order (an Information log of Storage). The filter has the Storage
// address: another contract can emit a log with the same topics.
export async function detailsSentTo(logWeb3, storageAddress, orderId, position, fromBlock) {
  const logs = await logWeb3.eth.getPastLogs({
    address: storageAddress,
    topics: [INFORMATION_TOPIC, uintTopic(orderId), uintTopic(position)],
    fromBlock: fromBlock || 0,
    toBlock: 'latest',
  });
  return logs.some(function (log) { return same(log.address, storageAddress); });
}

const SENT_BEFORE = 'What you sent before was prepared for the first worker; the second one cannot open it.';

// What to tell the customer about the workers of an order that waits for one or
// has one. `detailsSent` is true, false, or null when it is not known.
// Returns null when there is nothing to say.
export function workerNotice(status, commitments, currentWorker, detailsSent) {
  const count = Array.isArray(commitments) ? commitments.length : 0;
  if (status === 'PREPARATION') {
    if (count === 0) return null;
    return 'The delivery worker who committed to this order left it before pickup, or the establishment replaced them. '
      + 'The order is offered again and your payment stays in it. '
      + 'When a second worker commits, send your address again. ' + SENT_BEFORE;
  }
  if (status !== 'WAITING') return null;
  const current = currentCommitment(commitments, currentWorker);
  if (current && current.position >= 2) {
    if (detailsSent === true) return 'A second delivery worker committed to this order after the first one left. Your address was sent to them.';
    return 'A second delivery worker committed to this order after the first one left. '
      + (detailsSent === false ? 'Send your address again. ' : 'If you have not sent your address since they committed, send it again. ')
      + SENT_BEFORE;
  }
  if (detailsSent === true) return 'Your address was sent to the delivery worker.';
  if (detailsSent === false) return 'A delivery worker committed to this order. Send them your address.';
  return null;
}
