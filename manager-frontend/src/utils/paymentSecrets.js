// Secrets of the note an accepted order pays the establishment to, kept per deployment under
// 'paymentNoteSecrets' (deploymentStorage.js), by order number, until the order ends and its
// note is stored (claimRevenueNote). Every ending that pays the establishment makes that note:
// the payment plus the collateral, or the returned collateral alone.
// Order numbers start again on a restarted local node, which has the same chain id and the
// same Chain address, so a record also names the order it was made for: the order's address and the time it was placed. A
// record of another order with the same number is never sent again: its commitment may be
// public already, and the same commitment under two one-time addresses would link them.

import { readDeployment, writeDeployment } from './deploymentStorage';

const STORAGE_KEY = 'paymentNoteSecrets';

function readAll() {
  return readDeployment(STORAGE_KEY, {});
}

/** True when `record` holds unclaimed secrets made for this order. */
export function isEarlierAttempt(record, orderAddress, placedAt) {
  return !!record && !record.claimed && !!record.nullifier && !!record.trapdoor && !!record.commitment &&
    !!record.order && !!orderAddress &&
    String(record.order).toLowerCase() === String(orderAddress).toLowerCase() &&
    String(record.placedAt) === String(placedAt);
}

/**
 * The payment commitment to send with prepareOrder. The secrets of an earlier attempt to
 * accept the same order are used again (that attempt's prepareOrder may still be mined, and
 * new secrets would replace the only copy of the ones it carries). Otherwise new secrets are
 * made and saved before anything is sent.
 *
 * @param {string|number} orderId
 * @param {string} orderAddress - the order's contract
 * @param {string|number} placedAt - Chain.getOrder field 6
 * @param {Function} makeSecrets - returns { nullifier, trapdoor, commitment } as strings
 * @returns {string} the commitment
 */
export function paymentCommitmentFor(orderId, orderAddress, placedAt, makeSecrets) {
  var all = readAll();
  var earlier = all[orderId];
  if (isEarlierAttempt(earlier, orderAddress, placedAt)) return String(earlier.commitment);
  // Unclaimed secrets of another order with this number are moved, not lost
  if (earlier && !earlier.claimed && earlier.nullifier && earlier.trapdoor) {
    all[orderId + '@' + (earlier.order || 'earlier') + '@' + (earlier.placedAt || 0)] = earlier;
  }
  var made = makeSecrets();
  all[orderId] = {
    nullifier: String(made.nullifier),
    trapdoor: String(made.trapdoor),
    commitment: String(made.commitment),
    order: String(orderAddress),
    placedAt: String(placedAt),
  };
  writeDeployment(STORAGE_KEY, all);
  return all[orderId].commitment;
}

/**
 * The orders whose note is in the pool and not stored in this browser yet: any order, in any
 * step, that says it paid the establishment a note (field 5 of Chain.getOrder, read as the
 * order's establishment, above zero) and whose secrets are here and not claimed. The amount is
 * 0 while an order is open and when it paid nothing or paid by transfer.
 *
 * @param {Array} ordersBlock - orders as Chain.getOrder gives them
 * @returns {Array} [{ orderId, amount }] (strings)
 */
export function ordersWithUnclaimedNote(ordersBlock) {
  var all = readAll();
  return (ordersBlock || []).filter(function (b) {
    if (!b || b[0] === undefined || b[0] === null) return false;
    var record = all[b[0]];
    return !!record && !record.claimed && /^[0-9]+$/.test(String(b[5])) && !/^0+$/.test(String(b[5]));
  }).map(function (b) { return { orderId: String(b[0]), amount: String(b[5]) }; });
}
