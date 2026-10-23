// The timeout of an order that has a worker (Util.whoCancel in Order.sol). More than one hour
// after the worker committed (WAITING), or after the pickup was recorded (DISPATCHED), a
// cancellation by the customer or the establishment is charged to the worker. The customer
// gets back what the order holds (all they paid except the gas stipend, which went to the
// order's one-time address when the order was placed), the establishment gets its collateral
// (the delivery fee) back as a note in the payment pool, the worker is paid nothing and is
// counted as having left: before pickup in WAITING, after pickup in DISPATCHED.
// Before that, a cancellation by the establishment is its own: it loses the collateral.

export const WAITING_TIMEOUT_SECONDS = 3600;

/**
 * @param {number|string} committedAt - time the order entered its step, in seconds (field 7
 *   of Chain.getOrder): the commitment in WAITING, the pickup in DISPATCHED
 * @param {number|string} now - seconds; for a transaction, the time of the latest block
 * @returns {boolean} true when the contract would charge a cancellation to the worker
 */
export function waitingTimedOut(committedAt, now) {
  var since = Number(committedAt);
  var at = Number(now);
  if (!isFinite(since) || !isFinite(at) || since <= 0) return false;
  return at > since + WAITING_TIMEOUT_SECONDS;
}

/** When the timeout is reached, in seconds, or null. */
export function waitingTimeoutAt(committedAt) {
  var since = Number(committedAt);
  return isFinite(since) && since > 0 ? since + WAITING_TIMEOUT_SECONDS : null;
}

/** What the customer gets back when a cancellation is charged to the worker. */
export const TIMEOUT_REFUND_TEXT = 'the customer is refunded what they paid, except the gas stipend that came with the order';

/** Where the establishment's collateral goes when an order ends and returns it. */
export const COLLATERAL_RETURN_TEXT = 'your collateral (the delivery fee) comes back as a note in the payment pool';
