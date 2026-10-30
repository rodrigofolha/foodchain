/**
 * Ratings given through an order, and the worker's public record (no wallet needed: read-only).
 *
 * The establishment rates with Chain.rateOrder(order, worker, score), sent from the order's
 * one-time address. GlobalReputation.orderRatings(order, worker) says what the order reported
 * about the worker and which scores were given.
 */
import { getLogsChunked } from './chainLogs';

// OrderActors(address indexed client, address indexed establishment, address indexed deliveryworker, address orderAddress)
export const ORDER_ACTORS_TOPIC = '0x3aab3448479337ae16f6a4a2ab87a664e7aad6b0c280f483bf1be0c16f888643';

// GlobalReputation: what an order reported about a worker
export const LEFT_BEFORE_PICKUP = 1;
export const LEFT_AFTER_PICKUP = 2;
export const DELIVERED = 3;

const ZERO_TOPIC = '0x' + '0'.repeat(64);

function byPosition(a, b) {
  return (Number(a.blockNumber) - Number(b.blockNumber)) || (Number(a.logIndex) - Number(b.logIndex));
}

/**
 * The workers who committed to an order, in order of commitment, from the order's own
 * OrderActors logs (the third indexed address; zero until a worker commits).
 * One entry per commitment: the same account can be the first and the second worker.
 */
export function orderCommitments(logs) {
  return (logs || [])
    .filter(function(log) {
      return log && log.topics && log.topics.length >= 4 &&
        String(log.topics[0]).toLowerCase() === ORDER_ACTORS_TOPIC && String(log.topics[3]).toLowerCase() !== ZERO_TOPIC;
    })
    .slice()
    .sort(byPosition)
    .map(function(log) { return '0x' + String(log.topics[3]).slice(26).toLowerCase(); });
}

/** The distinct workers among the commitments of an order (orderCommitments), first committed first. */
export function orderWorkers(commitments) {
  var seen = {};
  return (commitments || []).filter(function(worker) {
    if (seen[worker]) return false;
    seen[worker] = true;
    return true;
  });
}

/**
 * Reads the commitments of one order. The logs are filtered by the order's address: each order
 * emits its own OrderActors, and the address must be an order of Chain (Chain.findAddress or
 * Chain.isOrder), or the logs could be anything.
 */
export async function fetchOrderCommitments(logWeb3, orderAddress, fromBlock) {
  var logs = await getLogsChunked(logWeb3, {
    address: orderAddress,
    fromBlock: fromBlock || 0,
    toBlock: 'latest',
    topics: [ORDER_ACTORS_TOPIC],
  });
  return orderCommitments(logs);
}

/**
 * "Call other deliveryman" is accepted once per order and never for a second worker
 * (Order.callSecondDeliveryman: "Second worker already called").
 *
 * @param {string} status - the order's step
 * @param {Array|null} commitments - orderCommitments of the order, or null when not read yet
 * @returns {string} 'allowed', 'second-worker' (refused by the contract), 'unknown' (the
 *   commitments could not be read: the contract decides) or 'no' (not in WAITING)
 */
export function replacementState(status, commitments) {
  if (status !== 'WAITING') return 'no';
  if (!commitments) return 'unknown';
  return commitments.length >= 2 ? 'second-worker' : 'allowed';
}

/** What the order reported about the worker, in words. */
export function outcomeText(outcome) {
  switch (Number(outcome)) {
    case LEFT_BEFORE_PICKUP: return 'left before pickup';
    case LEFT_AFTER_PICKUP: return 'left after pickup';
    case DELIVERED: return 'delivered';
    default: return 'nothing reported';
  }
}

/**
 * One line per worker of the order that the establishment can rate or has rated.
 *
 * @param {string} worker
 * @param {Object} given - the answer of orderRatings(order, worker): (outcome, byClient, byEstablishment)
 * @returns {Object|null} { worker, outcome, score, canRate }, or null when the order reported
 *   nothing about the worker (still committed, or paid by a cancellation): they cannot be rated
 */
export function ratingLine(worker, given) {
  var outcome = Number(given && (given.outcome !== undefined ? given.outcome : given[0]));
  var score = Number(given && (given.byEstablishment !== undefined ? given.byEstablishment : given[2]));
  if (!outcome) return null;
  return { worker: worker, outcome: outcome, score: score || 0, canRate: !score };
}

/**
 * The workers of the order the establishment can rate or has rated, first committed first.
 *
 * @param {Object} reputationContract - web3 contract of GlobalReputation (read-only calls)
 * @param {string} orderAddress
 * @param {Array} workers - orderWorkers of the order
 */
export async function fetchRatingLines(reputationContract, orderAddress, workers) {
  var lines = [];
  for (var i = 0; i < workers.length; i++) {
    var given = await reputationContract.methods.orderRatings(orderAddress, workers[i]).call();
    var line = ratingLine(workers[i], given);
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * The worker's public record, from GlobalReputation.workers(worker):
 * (totalScore, totalRatings, completedOrders, leftOrders, ratingsAfterLeaving).
 * average is on the 1 to 5 scale, or null without ratings.
 */
export function workerRecord(result) {
  var pick = function(name, index) {
    var value = result && (result[name] !== undefined ? result[name] : result[index]);
    return Number(value || 0);
  };
  var totalScore = pick('totalScore', 0);
  var ratings = pick('totalRatings', 1);
  return {
    average: ratings > 0 ? totalScore / ratings : null,
    ratings: ratings,
    deliveries: pick('completedOrders', 2),
    left: pick('leftOrders', 3),
    ratingsAfterLeaving: pick('ratingsAfterLeaving', 4),
  };
}

function count(n, one, many) {
  return n + ' ' + (n === 1 ? one : many);
}

/** The record in one line, e.g. "4.5★ · 2 ratings · 3 deliveries · left 1 order · 1 rating received after leaving". */
export function workerRecordText(record) {
  var parts = [];
  if (record.ratings > 0) {
    parts.push(record.average.toFixed(1) + '★');
    parts.push(count(record.ratings, 'rating', 'ratings'));
  } else {
    parts.push('No ratings yet');
  }
  parts.push(count(record.deliveries, 'delivery', 'deliveries'));
  parts.push('left ' + count(record.left, 'order', 'orders'));
  parts.push(count(record.ratingsAfterLeaving, 'rating', 'ratings') + ' received after leaving');
  return parts.join(' · ');
}

export function shortAddress(address) {
  var text = String(address || '');
  return text.length > 12 ? text.slice(0, 6) + '...' + text.slice(-4) : text;
}
