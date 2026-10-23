// The OrderActors logs of a query over every contract, as the orders page needs them.
//
// OrderActors(address indexed client, address indexed establishment, address indexed deliveryworker, address orderAddress)
// is emitted by each order, which names itself in the data. Any contract can emit a log
// with the same topic, so a log is used only if it has the expected shape and its
// emitter is the address it names. The emitters are candidates only: the caller still
// asks Chain.isOrder (keepChainOrders in orderCheck.js).
import { ORDER_ACTORS_TOPIC } from './orderRatings';

const TOPIC_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const DATA_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ZERO_ADDRESS = '0x' + '0'.repeat(40);

function topicAddress(topic) {
  return '0x' + topic.slice(26).toLowerCase();
}

/**
 * One OrderActors log of an order, or null for anything else: a log without the four
 * topics and the 32 bytes of data, or a log whose emitter is not the address in its data.
 * Never throws.
 *
 * @returns {Object|null} { orderAddress, establishment } in lower case; establishment is the
 *   zero address until the order is accepted
 */
export function parseOrderActorsLog(log) {
  if (!log || typeof log !== 'object') return null;
  if (typeof log.address !== 'string' || !ADDRESS_PATTERN.test(log.address)) return null;
  if (!Array.isArray(log.topics) || log.topics.length !== 4) return null;
  for (var i = 0; i < 4; i++) {
    if (typeof log.topics[i] !== 'string' || !TOPIC_PATTERN.test(log.topics[i])) return null;
  }
  if (log.topics[0].toLowerCase() !== ORDER_ACTORS_TOPIC) return null;
  if (typeof log.data !== 'string' || !DATA_PATTERN.test(log.data)) return null;
  var emitter = log.address.toLowerCase();
  // an order names itself; a log that names another contract proves nothing about it
  if (topicAddress(log.data) !== emitter || emitter === ZERO_ADDRESS) return null;
  if (log.data.slice(2, 26) !== '0'.repeat(24)) return null;
  return { orderAddress: emitter, establishment: topicAddress(log.topics[2]) };
}

/**
 * The orders to look at, from the logs of a query: those whose establishment is one of the
 * given one-time addresses (accepted orders) and those not accepted yet (the establishment is
 * then known to the order only). Each order once, in the order of the logs; the entry of an
 * accepted order replaces the one of its creation.
 *
 * @param {Array} logs
 * @param {Object} keyOf - one-time address (lower case) to its key
 * @param {Function} [skip] - skip(orderAddress) true for orders the page already has
 * @returns {Array} [{ orderAddress, stealthPrivateKey }] (stealthPrivateKey null when the
 *   order is not accepted yet: every key is tried)
 */
export function candidateOrdersFromLogs(logs, keyOf, skip) {
  var byOrder = {};
  var order = [];
  (Array.isArray(logs) ? logs : []).forEach(function(log) {
    var parsed = parseOrderActorsLog(log);
    if (!parsed) return;
    if (skip && skip(parsed.orderAddress)) return;
    var key = Object.prototype.hasOwnProperty.call(keyOf, parsed.establishment) ? keyOf[parsed.establishment] : null;
    if (!key && parsed.establishment !== ZERO_ADDRESS) return;
    if (!Object.prototype.hasOwnProperty.call(byOrder, parsed.orderAddress)) {
      order.push(parsed.orderAddress);
      byOrder[parsed.orderAddress] = null;
    }
    if (key) byOrder[parsed.orderAddress] = key;
  });
  return order.map(function(address) { return { orderAddress: address, stealthPrivateKey: byOrder[address] }; });
}
