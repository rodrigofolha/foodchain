/* global BigInt */
// Return of the unused gas money of an ended order to the payment pool.
//
// After an order has ended, what is left at its one-time address (about half of the stipend
// and the top-up) can be used by nothing else: sending it to the establishment's wallet would
// link the order to the establishment. The address deposits it into the pool instead, under a
// new commitment whose secrets are kept as for any note of the establishment. The deposit is
// an ordinary pool deposit: the note is not counted as received from an order.
//
// The amount is the balance, less a reserve for the ratings still to be given from the address,
// less the gas limit times the gas price of the deposit (the address must hold that; what the
// transaction does not use, up to a fifth of the limit, stays at the address).

import { sendRecorded } from './signedSend';
import { withGasMargin } from './oneTimeSend';
import { readDeployment, writeDeployment } from './deploymentStorage';
import {
  generateNoteSecrets, computePaymentCommitment, computePaymentLeaf, storePaymentNote,
  getPaymentNotes, findNoteLeafIndex,
} from './zkWithdraw';

const RETURNS_KEY = 'gasReturns';

// Offered when what can be returned is worth more than this many times the cost: 3/2
export const GAS_RETURN_WORTH = { times: 3n, over: 2n };
// Kept at the address for each worker the establishment can still rate (a rating uses about
// 68,000 gas on Sepolia; twice that, for the limit and a price rise)
export const RATING_RESERVE_GAS = 150000;
// A commitment with no zero byte, for the estimate shown before any secrets are made
const QUOTE_COMMITMENT = '0x' + '11'.repeat(32);

/**
 * What a return would move and cost (pure).
 *
 * @param {string|BigInt} balance - of the one-time address
 * @param {string|BigInt} gasLimit - of the deposit
 * @param {string|BigInt} gasPrice
 * @param {number} unratedWorkers - workers the establishment can still rate on this order
 * @returns {Object} { cost, reserve, amount (BigInt, wei), offered }
 */
export function gasReturnOffer(balance, gasLimit, gasPrice, unratedWorkers) {
  var price = BigInt(String(gasPrice));
  var cost = BigInt(String(gasLimit)) * price;
  var reserve = BigInt(unratedWorkers || 0) * BigInt(RATING_RESERVE_GAS) * price;
  var spendable = BigInt(String(balance)) - reserve;
  var amount = spendable - cost;
  return {
    cost: cost,
    reserve: reserve,
    amount: amount > 0n ? amount : 0n,
    offered: amount > 0n && spendable * GAS_RETURN_WORTH.over > cost * GAS_RETURN_WORTH.times,
  };
}

// The node's estimate needs an amount the address can pay: half of the balance. What the
// deposit costs does not depend on the amount.
async function quote(reputation, commitment, unratedWorkers) {
  var provider = reputation.provider;
  var from = await reputation.signer.getAddress();
  var balance = BigInt((await provider.getBalance(from)).toString());
  if (balance < 2n) return Object.assign({ balance: balance }, gasReturnOffer(0, 0, 0, 0));
  var estimate = await reputation.estimateGas.depositPayment(commitment, { value: (balance / 2n).toString() });
  var gasLimit = withGasMargin(estimate.toString());
  var gasPrice = BigInt((await provider.getGasPrice()).toString());
  return Object.assign({ balance: balance, gasLimit: gasLimit, gasPrice: gasPrice },
    gasReturnOffer(balance, gasLimit, gasPrice, unratedWorkers));
}

/**
 * Reads what the one-time address holds and what returning it would cost. Only reads.
 *
 * @param {Object} reputation - ethers v5 Contract of the pool, connected to the one-time wallet
 * @param {number} unratedWorkers
 * @returns {Promise<Object>} { balance, gasLimit, gasPrice, cost, reserve, amount, offered }
 */
export function quoteGasReturn(reputation, unratedWorkers) {
  return quote(reputation, QUOTE_COMMITMENT, unratedWorkers);
}

function pendingReturns() {
  return readDeployment(RETURNS_KEY, []);
}

/** True when a return was sent and its note is not stored yet. */
export function hasPendingGasReturns() {
  return pendingReturns().length > 0;
}

function dropReturn(leaf) {
  writeDeployment(RETURNS_KEY, pendingReturns().filter(function (r) { return r.leaf !== leaf; }));
}

// Stores the note of a mined return, once, and forgets its record
function settleReturn(record, leafIndex) {
  var known = getPaymentNotes().some(function (n) { return String(n.commitment) === String(record.commitment); });
  if (!known) {
    storePaymentNote({
      nullifier: record.nullifier,
      trapdoor: record.trapdoor,
      amount: record.amount,
      leafIndex: leafIndex,
      commitment: record.commitment,
    });
  }
  dropReturn(record.leaf);
  return !known;
}

/**
 * Stores the notes of the returns that were mined while their outcome was not recorded (the
 * page was closed, or the connection failed after the transaction left). A record whose note
 * is not in the tree stays: its transaction may still be mined.
 *
 * @param {Object} treeState - from fetchTreeState()
 * @returns {number} how many notes were stored now
 */
export function reconcileGasReturns(treeState) {
  var leaves = treeState.allLeaves.map(String);
  var stored = 0;
  pendingReturns().forEach(function (record) {
    var leafIndex = leaves.indexOf(String(record.leaf));
    if (leafIndex >= 0 && settleReturn(record, leafIndex)) stored++;
  });
  return stored;
}

/**
 * Deposits the unused gas money of an ended order into the pool, from its one-time address.
 * The note's secrets are saved, with the signed transaction, before it is broadcast.
 *
 * @param {Object} params
 * @param {Object} params.ethers - the ethers v5 module
 * @param {Object} params.wallet - the one-time wallet, connected to a provider
 * @param {Object} params.reputation - ethers Contract of the pool, connected to `wallet`
 * @param {string|number} params.orderId
 * @param {number} params.unratedWorkers
 * @returns {Promise<Object>} { amount, cost (BigInt), txHash }
 * @throws when the return is not worth its cost any more (`notWorth: true`), or the error of
 *   the node; nothing was sent when `notWorth` or `notSent` is true
 */
export async function sendGasReturn(params) {
  var secrets = generateNoteSecrets();
  var commitment = computePaymentCommitment(secrets.nullifier, secrets.trapdoor).toString();
  var offer = await quote(params.reputation, commitment, params.unratedWorkers);
  if (!offer.offered) {
    var notWorth = new Error("What is left at the order's one-time address is not worth the cost of returning it. Nothing was sent.");
    notWorth.notWorth = true;
    throw notWorth;
  }
  var amount = offer.amount.toString();
  var record = {
    order: String(params.orderId),
    nullifier: secrets.nullifier.toString(),
    trapdoor: secrets.trapdoor.toString(),
    commitment: commitment,
    amount: amount,
    leaf: computePaymentLeaf(commitment, amount).toString(),
  };

  var tx;
  try {
    tx = await sendRecorded(params.ethers, params.wallet, params.reputation, 'depositPayment', [commitment],
      { value: amount, gasLimit: offer.gasLimit.toString(), gasPrice: offer.gasPrice.toString() },
      function (sentAs) { writeDeployment(RETURNS_KEY, pendingReturns().concat([Object.assign({ at: Date.now() }, record, sentAs)])); });
  } catch (err) {
    // refused by the node: nothing left the address. A connection error says nothing: the record stays.
    if (err && err.notSent) dropReturn(record.leaf);
    throw err;
  }
  var receipt;
  try {
    receipt = await tx.wait();
  } catch (err) {
    // reverted: the money is still at the address. Otherwise the outcome is unknown and the record stays.
    if (err && err.receipt && err.receipt.status === 0) dropReturn(record.leaf);
    throw err;
  }
  settleReturn(record, findNoteLeafIndex(receipt, record.leaf));
  return { amount: offer.amount, cost: offer.cost, txHash: receipt.transactionHash };
}
