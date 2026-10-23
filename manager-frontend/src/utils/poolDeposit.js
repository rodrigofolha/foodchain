// Deposit into the payment pool from the establishment's wallet (Menu page).
//
// A deposit can only be spent with the secrets of its note. They are saved, in a record of
// deposits not recorded yet, before the wallet is asked to send anything. The note is stored
// when the receipt arrives; when it never reaches this page (the page was closed or reloaded,
// the wallet replaced the transaction, the connection failed), the record stays and the note
// is stored when its leaf, poseidon(commitment, amount), is found in the pool's note tree
// (reconcilePoolDeposits, on the Menu and Orders pages).

import { sendFromWallet, isEstimateError } from './oneTimeSend';
import { readDeployment, writeDeployment } from './deploymentStorage';
import {
  generateNoteSecrets, computePaymentCommitment, computePaymentLeaf, storePaymentNote,
  getPaymentNotes, findNoteLeafIndex,
} from './zkWithdraw';

const DEPOSITS_KEY = 'poolDeposits';

function pendingDeposits() {
  return readDeployment(DEPOSITS_KEY, []);
}

/** True when a deposit was handed to the wallet and its note is not stored yet. */
export function hasPendingPoolDeposits() {
  return pendingDeposits().length > 0;
}

function dropDeposit(leaf) {
  writeDeployment(DEPOSITS_KEY, pendingDeposits().filter(function (r) { return r.leaf !== leaf; }));
}

// Stores the note of a mined deposit, once, and forgets its record
function settleDeposit(record, leafIndex) {
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
  dropDeposit(record.leaf);
  return !known;
}

/** True when the wallet's error says the person refused to sign: nothing was sent. */
export function wasRejectedInWallet(err) {
  if (!err) return false;
  return err.code === 4001 || err.code === 'ACTION_REJECTED' || /user denied|user rejected/i.test(String(err.message || ''));
}

// A receipt that says the transaction was mined and failed: the money did not reach the pool
function revertedOnChain(err) {
  var receipt = err && err.receipt;
  return !!receipt && (receipt.status === false || receipt.status === 0 || receipt.status === '0x0');
}

/**
 * Stores the notes of the deposits that were mined while their outcome was not recorded.
 * A record whose note is not in the tree stays: its transaction may still be mined.
 *
 * @param {Object} treeState - from fetchTreeState()
 * @returns {number} how many notes were stored now
 */
export function reconcilePoolDeposits(treeState) {
  var leaves = treeState.allLeaves.map(String);
  var stored = 0;
  pendingDeposits().forEach(function (record) {
    var leafIndex = leaves.indexOf(String(record.leaf));
    if (leafIndex >= 0 && settleDeposit(record, leafIndex)) stored++;
  });
  return stored;
}

/**
 * Deposits `amountWei` into the pool from the person's wallet, under a new commitment.
 *
 * @param {Object} params
 * @param {Object} params.reputationContract - web3 contract of the pool, on the wallet's provider
 * @param {string} params.from - the wallet's account
 * @param {string} params.amountWei
 * @returns {Promise<Object>} { receipt, leafIndex }
 * @throws the wallet's or the node's error. `notSent: true`: nothing left the wallet.
 *   `reverted: true`: mined and failed. Otherwise the outcome is not known and the secrets are
 *   kept (`kept: true`) until the note is found in the pool.
 */
export async function sendPoolDeposit(params) {
  var secrets = generateNoteSecrets();
  var commitment = computePaymentCommitment(secrets.nullifier, secrets.trapdoor).toString();
  var amount = String(params.amountWei);
  var record = {
    nullifier: secrets.nullifier.toString(),
    trapdoor: secrets.trapdoor.toString(),
    commitment: commitment,
    amount: amount,
    leaf: computePaymentLeaf(commitment, amount).toString(),
    at: Date.now(),
  };
  // saved before the wallet is asked: after this line the secrets are never only in memory
  writeDeployment(DEPOSITS_KEY, pendingDeposits().concat([record]));

  var receipt;
  try {
    receipt = await sendFromWallet(params.reputationContract.methods.depositPayment(commitment),
      { from: params.from, value: amount });
  } catch (err) {
    if (err && typeof err === 'object') {
      err.notSent = isEstimateError(err) || wasRejectedInWallet(err);
      err.reverted = !err.notSent && revertedOnChain(err);
      // refused before it was sent, or mined and failed: no note can come of this record
      if (err.notSent || err.reverted) dropDeposit(record.leaf);
      else err.kept = true;
    }
    throw err;
  }
  var leafIndex = findNoteLeafIndex(receipt, record.leaf);
  settleDeposit(record, leafIndex);
  return { receipt: receipt, leafIndex: leafIndex };
}
