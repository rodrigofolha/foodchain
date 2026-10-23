/* global BigInt */
// The gas money of an order's one-time address.
//
// The address receives the customer's stipend with the order (it pays for the pool withdrawal
// below) and, when the order is accepted, a withdrawal from the establishment's notes in the
// payment pool: the delivery fee (the collateral prepareOrder sends) plus a top-up for gas.
//
// The top-up is sized so that the address can pay, without counting what is left of the
// stipend, for prepareOrder and then for its heaviest sequence: one replacement and the rating
// of the replaced worker, the pickup, a cancellation or contested decision that inserts the
// establishment's note into the pool, and a second rating. Gas figures are those of Sepolia's
// schedule since 2026-10-06, the dearer of the two, as simulated on Sepolia's state
// of 2026-10-12 (the main network's schedule, which is the local one, needs less for
// every call):
//
//   prepareOrder                            492,172
//   callSecondDeliveryman                   286,257  (276,257 in the block of the commitment)
//   rateOrder                                68,187
//   pickupOrder                             158,690
//   ending that inserts a note, its limit 2,044,006  (1,583,175 used at most: a contested
//       decision against a worker without a record, on a new level of the note tree; the
//       dApp sends 1.2 times the node's estimate, and the address must hold the whole limit)
//   sum                                   3,049,312, under ORDER_GAS_BUDGET by 3 %
//
// After the ending about 461,000 gas of its limit comes back in the worst case, which pays
// the second rating (about 86,000 with its margin). The budget is withdrawn at GAS_PRICE_ROOM
// times the gas price of the moment, so the sequence stays payable while the price rises up
// to 1.5 times.
// These figures are simulated, not measured: the budget must be checked against the
// measurement on Sepolia.

import { readDeployment, writeDeployment } from './deploymentStorage';

export const ORDER_GAS_BUDGET = 3150000;
// room for a rise of the gas price after the funding: 3/2
export const GAS_PRICE_ROOM = { times: 3n, over: 2n };
// Gas limit of a pool withdrawal sent by the one-time address (1.2 x 1,529,591, Sepolia)
export const FUNDING_WITHDRAWAL_GAS = 1840000;

const FUNDINGS_KEY = 'orderFundings';
// MergeWithdrawal(address indexed to, uint256 amount, uint256 nullHash1, uint256 nullHash2)
export const MERGE_WITHDRAWAL_EVENT = 'MergeWithdrawal(address,uint256,uint256,uint256)';

/** The gas budget in wei at a gas price, with or without the room for a price rise. */
export function gasBudgetWei(gasPrice, withRoom) {
  var plain = BigInt(String(gasPrice)) * BigInt(ORDER_GAS_BUDGET);
  return withRoom ? plain * GAS_PRICE_ROOM.times / GAS_PRICE_ROOM.over : plain;
}

/** What the first funding of an order withdraws: the delivery fee plus the budget with room. @returns {BigInt} wei */
export function fundingNeeded(deliveryFee, gasPrice) {
  return BigInt(String(deliveryFee)) + gasBudgetWei(gasPrice, true);
}

/**
 * What to withdraw from the pool for an order, given what the pool already paid to its one-time
 * address (`withdrawn`, read from the chain). The address's balance is not looked at: the
 * customer's stipend is never taken for the funding.
 *
 *   - nothing was paid yet: the whole funding;
 *   - the amount paid still covers the fee and the budget at the gas price of now: nothing
 *     (a price rise within the room does not cause a second withdrawal);
 *   - otherwise: only what is missing to the funding at the gas price of now, plus what that
 *     withdrawal itself costs the address.
 *
 * @returns {Object} { withdraw (BigInt, 0 when nothing is to be withdrawn), first (boolean) }
 */
export function fundingPlan(withdrawn, deliveryFee, gasPrice) {
  var paid = BigInt(String(withdrawn || 0));
  var target = fundingNeeded(deliveryFee, gasPrice);
  if (paid === 0n) return { withdraw: target, first: true };
  if (paid >= BigInt(String(deliveryFee)) + gasBudgetWei(gasPrice, false)) return { withdraw: 0n, first: false };
  return { withdraw: target - paid + BigInt(String(gasPrice)) * BigInt(FUNDING_WITHDRAWAL_GAS), first: false };
}

/**
 * Keeps what a mined funding withdrawal paid to a one-time address. The chain decides (see
 * withdrawnTo); this record only covers a log node that is behind the node that mined it.
 */
export function recordFunding(address, amount) {
  var all = readDeployment(FUNDINGS_KEY, {});
  var key = String(address).toLowerCase();
  all[key] = (BigInt(all[key] || 0) + BigInt(String(amount))).toString();
  writeDeployment(FUNDINGS_KEY, all);
}

/** @returns {BigInt} what this browser saw the pool pay to the address */
export function recordedFunding(address) {
  var all = readDeployment(FUNDINGS_KEY, {});
  return BigInt(all[String(address).toLowerCase()] || 0);
}

/**
 * What the pool paid to an address so far: the sum of the MergeWithdrawal events of the pool
 * to it, or what this browser recorded when that is more.
 *
 * @param {Object} logWeb3 - web3 instance for reading logs
 * @param {string} reputationAddress - the pool
 * @param {string} address - the order's one-time address
 * @param {number} fromBlock - DEPLOY_BLOCK
 * @returns {Promise<BigInt>} wei; throws when the logs could not be read
 */
export async function withdrawnTo(logWeb3, reputationAddress, address, fromBlock) {
  var logs = await logWeb3.eth.getPastLogs({
    address: reputationAddress,
    fromBlock: fromBlock,
    toBlock: 'latest',
    topics: [logWeb3.utils.keccak256(MERGE_WITHDRAWAL_EVENT), '0x' + '0'.repeat(24) + String(address).slice(2).toLowerCase()],
  });
  var onChain = logs.reduce(function (sum, log) {
    return sum + BigInt('0x' + String(log.data).slice(2, 66));
  }, 0n);
  var seen = recordedFunding(address);
  return onChain > seen ? onChain : seen;
}
