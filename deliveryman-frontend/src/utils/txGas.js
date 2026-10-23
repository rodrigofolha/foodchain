// The gas limit of a transaction: the node's estimate times a margin, never a fixed
// number. Gas schedules differ between networks and change with forks (on Sepolia
// a new storage slot costs about five times more since 2026-10-06), so a fixed limit
// that is enough today can stop every transaction tomorrow.
//
// - The estimate is asked with the same sender and value as the transaction. The
//   margin covers what can change before the transaction is mined (a first write to
//   a slot, a new level of the payment pool's tree) and nodes that answer the gas
//   used: a call that gives gas back at its end needs up to 1.20 times that.
// - When the node says the call would fail (a revert, not enough funds), the error
//   is thrown as it is and nothing is sent. The caller shows it with
//   parseContractError, which knows the contracts' reasons.
// - Fallback: when no estimate could be made at all (the node did not answer, limits
//   its requests, or does not offer the method), the transaction is sent without a
//   gas limit and the wallet sets it. The reason is printed, as a message only.

export const GAS_MARGIN_PERCENT = 125;

// The limit for an estimate, or null when the estimate is not a usable number.
export function gasLimitFor(estimate) {
  const gas = Number(estimate);
  if (!Number.isFinite(gas) || gas <= 0) return null;
  return Math.ceil(gas * GAS_MARGIN_PERCENT / 100);
}

// What an execution failure looks like: these are never taken for a missing answer.
const EXECUTION_FAILURE = /revert|vm exception|insufficient funds|gas required exceeds|always failing|out of gas|invalid opcode/i;

// What a missing answer looks like.
const NO_ANSWER = [
  /too many requests/i, /rate limit/i, /request limit/i,
  /timeout/i, /timed out/i,
  /failed to fetch/i, /network ?error/i, /invalid json rpc response/i,
  /connection (error|refused|not open|timeout)/i, /connection_refused/i, /econn/i,
  /method not found/i, /not supported/i, /unsupported method/i, /does not exist\/is not available/i,
];
// JSON-RPC: method not found, limit exceeded. EIP-1193: unsupported method.
const NO_ANSWER_CODES = [-32601, -32005, 4200];

// True when the estimate failed because the node could not be asked, not because
// the call would fail.
export function estimateUnavailable(err) {
  if (!err) return false;
  const message = String(err.message || err);
  if (EXECUTION_FAILURE.test(message) || err.data) return false;
  if (NO_ANSWER_CODES.indexOf(err.code) !== -1) return true;
  return NO_ANSWER.some(pattern => pattern.test(message));
}

// The options to send `tx` (a web3 contract method call) with: `options` plus the
// gas limit. A `gas` in `options` is ignored. See the top of this file for what
// happens when the estimate fails.
export async function withEstimatedGas(tx, options) {
  const sendOptions = Object.assign({}, options);
  delete sendOptions.gas;
  let estimate;
  try {
    estimate = await tx.estimateGas(Object.assign({}, sendOptions));
  } catch (err) {
    if (!estimateUnavailable(err)) throw err;
    console.warn('Gas could not be estimated; the wallet sets the limit:', String(err.message || err).slice(0, 150));
    return sendOptions;
  }
  const gas = gasLimitFor(estimate);
  if (gas === null) {
    console.warn('Gas could not be estimated; the wallet sets the limit:', 'the node answered no number.');
    return sendOptions;
  }
  sendOptions.gas = gas;
  return sendOptions;
}
