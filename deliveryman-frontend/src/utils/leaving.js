// What leaving an order means for the worker, and how an order they left looks.

// The contracts end an order whose worker did not pick up (or deliver) within one hour.
export const HANDOVER_TIMEOUT_SECONDS = 3600;

const COUNTED = 'It is counted on your public record as an order you left, and you are not paid for it.';

// A leaving that ends the order pays the establishment back through the payment
// pool, in the worker's transaction: it costs about ten times the gas of one that
// reopens the order.
export const ENDING_GAS_NOTE = "This transaction also returns the establishment's money to the payment pool and costs more gas than the other steps.";
// Shown next to the buttons. In WAITING the card does not know yet whether the
// worker is the first or the second.
export const GIVE_UP_GAS_NOTE = 'If giving up ends the order (you are its second worker, or the hour for the pickup has passed): ' +
  "the transaction also returns the establishment's money to the payment pool and costs more gas than the other steps.";
export const CANCEL_GAS_NOTE = "Cancelling after pickup also returns the establishment's money to the payment pool, so this transaction costs more gas than the other steps.";

// The text the worker confirms before they leave an order.
// status: the order's step; position: 1 (first worker), 2 (second) or null if unknown;
// since: when the order entered that step (seconds); now: the current time (seconds).
export function leavingNotice(status, position, since, now) {
  if (status === 'DISPATCHED') {
    return 'Cancel this delivery? The order ends: the customer is refunded. ' + COUNTED +
      ' Both the customer and the establishment will be able to rate you for it. ' + ENDING_GAS_NOTE;
  }
  const timedOut = Number(since) > 0 && Number(now) > Number(since) + HANDOVER_TIMEOUT_SECONDS;
  let outcome;
  let gas = '';
  if (position === 1 && !timedOut) {
    outcome = 'The order goes back to the open orders, for another worker.';
  } else if (position === 2 || (position === 1 && timedOut)) {
    outcome = 'The order ends: the customer is refunded.';
    gas = ' ' + ENDING_GAS_NOTE;
  } else {
    outcome = 'The order goes back to the open orders or, if no other worker can take it, ends.';
    gas = ' If the order ends: ' + ENDING_GAS_NOTE.charAt(0).toLowerCase() + ENDING_GAS_NOTE.slice(1);
  }
  return 'Give up this delivery? ' + outcome + ' ' + COUNTED +
    ' The establishment will be able to rate you for it.' + gas;
}

// True when getOrder answered an account with the view of a party. A worker who left
// (or was replaced) gets the public view: no status, or PREPARATION while the order
// waits for another worker.
export function isWorkerView(orderBlock) {
  return !!orderBlock && !!orderBlock[3] && orderBlock[3] !== 'ORDERED' && orderBlock[3] !== 'PREPARATION';
}

function scoreText(score) {
  return Number(score) > 0 ? `rated you ${Number(score)} ★` : 'has not rated you';
}

// The line shown for an order the worker left. `ratings` is the answer of
// GlobalReputation.orderRatings(order, worker): outcome (1 = left before pickup,
// 2 = left after pickup), the customer's score, the establishment's score.
// Returns null when the contract reports no leaving for this worker.
export function leftOrderText(ratings) {
  if (!ratings) return null;
  const outcome = Number(ratings.outcome !== undefined ? ratings.outcome : ratings[0]);
  const byClient = ratings.byClient !== undefined ? ratings.byClient : ratings[1];
  const byEstablishment = ratings.byEstablishment !== undefined ? ratings.byEstablishment : ratings[2];
  if (outcome === 1) {
    return `You left this order before pickup. Only the establishment can rate you for it: it ${scoreText(byEstablishment)}.`;
  }
  if (outcome === 2) {
    return `You left this order after pickup. The customer ${scoreText(byClient)}; the establishment ${scoreText(byEstablishment)}.`;
  }
  return null;
}
