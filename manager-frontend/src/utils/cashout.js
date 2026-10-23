/* global BigInt */
/**
 * Cash-out of the payment pool to the establishment's own wallet, in fixed denominations.
 *
 * Policy (strategy "S3:10:p5" of benchmarking/privacy-eval): the establishment cashes out only
 * after a number of new notes received from orders (one for every order that paid the
 * establishment, in any ending), each withdrawal pays exactly one denomination, and what
 * does not fill a denomination stays in the pool. A fixed amount does not tell which orders it
 * came from; withdrawing the exact revenue does.
 *
 *   - planning: pure functions (no storage, no network)
 *   - ledger:   what was already cashed out, in localStorage (per deployment)
 *   - runner:   proves and sends one mergeWithdraw at a time
 */

import {
  getPaymentNotes, markNoteSpent, addChangeNote, generateNoteSecrets,
  generateMergeWithdrawProof, fetchTreeState, findNoteLeafIndex, syncSpentNotes, getDummyNote,
  computeNullifierHash,
} from './zkWithdraw';

import { readDeployment, writeDeployment, removeDeployment } from './deploymentStorage';
import { recordFunding } from './orderFunding';
import { withGasMargin } from './oneTimeSend';

var priceUtils = require('./priceUtils');

// ─── Policy ──────────────────────────────────────────────────────────────────

// The one place to configure the cash-out. Defaults: the values measured in the paper.
export const CASHOUT_POLICY = {
  denominationUsd: 10, // every withdrawal pays exactly this (1 U$ = 10^15 wei, see priceUtils)
  everyNotes: 5,       // cash out only after this many new notes received from orders
};

const CASHOUT_LEDGER_KEY = 'poolCashoutLedger';
const CASHOUT_PENDING_KEY = 'poolCashoutPending';
const CASHOUT_ASIDE_KEY = 'poolCashoutAside';

/** The denomination in wei. */
export function denominationWei(policy) {
  return BigInt(priceUtils.dollarsToWei(policy.denominationUsd));
}

// ─── Planning (pure) ─────────────────────────────────────────────────────────

function sumAmounts(notes) {
  return notes.reduce(function(sum, n) { return sum + BigInt(n.amount); }, 0n);
}

// Largest first; equal amounts keep a fixed order, so that the same notes give the same plan
function byAmountDesc(a, b) {
  var x = BigInt(a.amount), y = BigInt(b.amount);
  if (x !== y) return x > y ? -1 : 1;
  return String(a.nullifier) < String(b.nullifier) ? -1 : (String(a.nullifier) > String(b.nullifier) ? 1 : 0);
}

/**
 * The next mergeWithdraw on the way to paying out exactly `amount` (the circuit takes two notes):
 *   - the smallest note that covers it, with the dummy note (note2 = null);
 *   - or the two largest notes, when together they cover it;
 *   - or a pure merge of the two largest notes (nothing is paid out), to be followed by another step.
 *
 * @returns {Object|null} { type: 'withdraw'|'merge', note1, note2, withdrawAmount, changeAmount }
 *   (amounts as BigInt), or null when the notes do not hold `amount`
 */
export function nextWithdrawalStep(unspentNotes, amount) {
  var target = BigInt(amount);
  var notes = unspentNotes.filter(function(n) { return BigInt(n.amount) > 0n; }).sort(byAmountDesc);
  if (target <= 0n || sumAmounts(notes) < target) return null;

  var covering = notes.filter(function(n) { return BigInt(n.amount) >= target; });
  if (covering.length > 0) {
    var one = covering[covering.length - 1];
    return { type: 'withdraw', note1: one, note2: null, withdrawAmount: target, changeAmount: BigInt(one.amount) - target };
  }
  var both = BigInt(notes[0].amount) + BigInt(notes[1].amount);
  if (both >= target) {
    return { type: 'withdraw', note1: notes[0], note2: notes[1], withdrawAmount: target, changeAmount: both - target };
  }
  return { type: 'merge', note1: notes[0], note2: notes[1], withdrawAmount: 0n, changeAmount: both };
}

function without(notes, spent) {
  return notes.filter(function(n) { return spent.indexOf(n) < 0; });
}

/**
 * All the steps that pay out each of `amounts`, in order. A step may spend the change note of an
 * earlier step; such a note does not exist yet and is shown as { planned: true, amount }.
 */
export function planAmounts(unspentNotes, amounts) {
  var notes = unspentNotes.slice();
  var steps = [];
  for (var i = 0; i < amounts.length; i++) {
    for (;;) {
      var step = nextWithdrawalStep(notes, amounts[i]);
      if (!step) return steps;
      steps.push(step);
      notes = without(notes, [step.note1, step.note2]);
      if (step.changeAmount > 0n) {
        notes.push({ planned: true, nullifier: 'change-of-step-' + steps.length, amount: step.changeAmount.toString() });
      }
      if (step.type === 'withdraw') break;
    }
  }
  return steps;
}

/**
 * Where the cash-out stands.
 *
 * @param {Array} unspentNotes - unspent notes of the pool ({ nullifier, amount, ... })
 * @param {Object} policy - { denominationUsd, everyNotes }
 * @param {Object} state - { revenueCount, revenueWei } (notes received from orders so far, see
 *   getRevenueSummary) and the ledger fields { countedNotes, cashedOutWei, open }
 * @returns {Object} { poolWei, newNotes, due, cashableWei, withdrawals, cashoutWei, leftoverWei }
 *   cashableWei: revenue not cashed out yet (never more than what the pool holds);
 *   withdrawals: how many denominations it fills; leftoverWei: the part that stays in the pool.
 */
export function cashoutStatus(unspentNotes, policy, state) {
  var denomination = denominationWei(policy);
  var poolWei = sumAmounts(unspentNotes);
  var cashable = BigInt(state.revenueWei || 0) - BigInt(state.cashedOutWei || 0);
  if (cashable > poolWei) cashable = poolWei;
  if (cashable < 0n) cashable = 0n;
  var newNotes = Math.max(0, Number(state.revenueCount || 0) - Number(state.countedNotes || 0));
  var withdrawals = Number(cashable / denomination);
  return {
    poolWei: poolWei,
    newNotes: newNotes,
    // an interrupted cash-out stays due until it is finished
    due: !!state.open || newNotes >= policy.everyNotes,
    cashableWei: cashable,
    withdrawals: withdrawals,
    cashoutWei: denomination * BigInt(withdrawals),
    leftoverWei: cashable - denomination * BigInt(withdrawals),
  };
}

/**
 * The withdrawals the policy makes now: none below the threshold of new notes from orders, otherwise
 * one denomination at a time while the revenue not cashed out yet covers one.
 */
export function planCashout(unspentNotes, policy, state) {
  var status = cashoutStatus(unspentNotes, policy, state);
  if (!status.due) return [];
  var amounts = [];
  for (var i = 0; i < status.withdrawals; i++) amounts.push(denominationWei(policy));
  return planAmounts(unspentNotes, amounts);
}

/**
 * Everything in one withdrawal (pure merges first). This is NOT the policy: the amount paid out
 * is the exact sum of the notes, which makes the orders behind it traceable.
 */
export function planWithdrawAll(unspentNotes) {
  var total = sumAmounts(unspentNotes);
  return total > 0n ? planAmounts(unspentNotes, [total]) : [];
}

// ─── Ledger (localStorage) ───────────────────────────────────────────────────

/** { countedNotes, cashedOutWei, open, withdrawals: [{ amount, txHash, at }] } */
export function getCashoutLedger() {
  var ledger = readDeployment(CASHOUT_LEDGER_KEY, {});
  return {
    countedNotes: ledger.countedNotes || 0,
    cashedOutWei: ledger.cashedOutWei || '0',
    open: !!ledger.open,
    withdrawals: ledger.withdrawals || [],
  };
}

function saveCashoutLedger(ledger) {
  writeDeployment(CASHOUT_LEDGER_KEY, ledger);
}

/**
 * Notes received from orders so far (spent or not): those whose commitment was made when an
 * order was accepted (paymentSecrets.js, claimed). An order gives one in every ending that pays
 * the establishment: the payment plus the collateral when it is paid for the items, the
 * collateral alone when only that is returned. Each counts as one note of the cash-out rule
 * and its whole amount as revenue (a concluded order's note holds the collateral too).
 * Deposits, change notes and returned gas money are not revenue.
 */
export function getRevenueSummary() {
  var secrets = readDeployment('paymentNoteSecrets', {});
  var commitments = {};
  Object.keys(secrets).forEach(function(orderId) {
    if (secrets[orderId] && secrets[orderId].claimed) commitments[String(secrets[orderId].commitment)] = true;
  });
  var revenue = getPaymentNotes().filter(function(n) { return commitments[String(n.commitment)]; });
  return { revenueCount: revenue.length, revenueWei: sumAmounts(revenue).toString() };
}

/** The `state` argument of cashoutStatus and planCashout, read from localStorage. */
export function getCashoutState() {
  return Object.assign(getRevenueSummary(), getCashoutLedger());
}

// A withdrawal that was handed to the wallet and is not settled yet. The change note's secrets
// are saved before the transaction is sent: without them the change could never be spent.
// The order card keeps the withdrawal that funds an accepted order here too (funding: true).
function getPendingCashouts() {
  return readDeployment(CASHOUT_PENDING_KEY, []);
}

function savePendingCashouts(list) {
  writeDeployment(CASHOUT_PENDING_KEY, list);
}

// Withdrawals the person set aside: they do not block any more, but their records (with the
// change note's secrets) stay here and every later check still looks for them in the tree.
function getAsideCashouts() {
  return readDeployment(CASHOUT_ASIDE_KEY, []);
}

function saveAsideCashouts(list) {
  if (list.length === 0) removeDeployment(CASHOUT_ASIDE_KEY);
  else writeDeployment(CASHOUT_ASIDE_KEY, list);
}

// Removes the record from both lists (waiting and set aside)
function dropPendingCashout(changeLeaf) {
  var keep = function(p) { return p.changeLeaf !== changeLeaf; };
  savePendingCashouts(getPendingCashouts().filter(keep));
  if (getAsideCashouts().length > 0) saveAsideCashouts(getAsideCashouts().filter(keep));
}

/** How many withdrawals were set aside and are still not known to be mined or lost. */
export function countSetAsideCashouts() {
  return getAsideCashouts().length;
}

/**
 * The person's way out when a withdrawal never settles: every waiting withdrawal stops blocking.
 * Nothing is forgotten: the records move to a separate list that reconcilePendingCashouts still
 * checks, so a withdrawal that is mined later is recorded as usual. Meanwhile its notes count as
 * unspent; if a new withdrawal spends them, only one of the two can be mined (the contract
 * refuses a spent note), so nothing is paid twice and nothing is lost.
 *
 * @returns {number} how many records were set aside
 */
export function setAsidePendingCashouts() {
  var pending = getPendingCashouts();
  if (pending.length === 0) return 0;
  var at = Date.now();
  saveAsideCashouts(getAsideCashouts().concat(pending.map(function(p) { return Object.assign({}, p, { asideAt: at }); })));
  savePendingCashouts([]);
  return pending.length;
}

/**
 * Keep the record of a withdrawal that is about to be sent. Call it before sending.
 *
 * @param {Object} pending - { spent: [nullifier], nullifierHash (of note 1), change: { nullifier,
 *   trapdoor, amount }, changeLeaf, withdrawAmount, all, funding } (all values as strings).
 *   funding: the withdrawal pays an order's one-time address (`recipient`), so it is not counted
 *   as cashed out; once mined, the amount is kept for that address (orderFunding.js).
 *   A funding withdrawal is signed in the browser: its record also has { txHash, nonce, from,
 *   rawTx }, where rawTx is the signed transaction, so that the same bytes can be sent again.
 */
export function addPendingWithdrawal(pending) {
  savePendingCashouts(getPendingCashouts().concat([pending]));
}

/** Add what is known about the sent transaction ({ txHash, nonce, from }) to its record. */
export function notePendingTransaction(changeLeaf, fields) {
  savePendingCashouts(getPendingCashouts().map(function(p) {
    return p.changeLeaf === changeLeaf ? Object.assign({}, p, fields) : p;
  }));
}

/** Forget a withdrawal that was never sent or that reverted: its notes are untouched. */
export function dropPendingWithdrawal(changeLeaf) {
  dropPendingCashout(changeLeaf);
}

/** Record a mined withdrawal (see settleCashout). */
export function settlePendingWithdrawal(pending, leafIndex, txHash) {
  settleCashout(pending, leafIndex, txHash);
}

// Record a mined withdrawal: spend its notes, keep its change note, count what it paid out
function settleCashout(pending, leafIndex, txHash) {
  pending.spent.forEach(function(nullifier) { markNoteSpent(nullifier); });
  var known = getPaymentNotes().some(function(n) { return n.commitment === pending.changeLeaf; });
  if (!known && BigInt(pending.change.amount) > 0n) {
    addChangeNote({
      nullifier: pending.change.nullifier,
      trapdoor: pending.change.trapdoor,
      amount: pending.change.amount,
      leafIndex: leafIndex,
      commitment: pending.changeLeaf,
    });
  }
  // the funding of an order goes to its one-time address: it is not a cash-out
  if (pending.funding && pending.recipient) recordFunding(pending.recipient, pending.withdrawAmount);
  if (!pending.funding && BigInt(pending.withdrawAmount) > 0n) {
    var ledger = getCashoutLedger();
    ledger.cashedOutWei = (BigInt(ledger.cashedOutWei) + BigInt(pending.withdrawAmount)).toString();
    ledger.withdrawals.push({ amount: pending.withdrawAmount, txHash: txHash || null, at: Date.now() });
    if (pending.all) {
      // everything left the pool: no revenue is waiting any more
      var revenue = getRevenueSummary();
      ledger.cashedOutWei = revenue.revenueWei;
      ledger.countedNotes = revenue.revenueCount;
      ledger.open = false;
    }
    saveCashoutLedger(ledger);
  }
  dropPendingCashout(pending.changeLeaf);
}

/**
 * Settle the withdrawals whose outcome is not recorded (the page was closed, or the wallet
 * returned an error after sending). A withdrawal was mined if its change note is in the note tree.
 * It can no longer be mined if its note was spent by another transaction: its record is dropped
 * then, but only when the rebuilt tree is the contract's current one (a tree that is behind
 * could still miss the change note). With `web3` and the transaction's hash, the record is also
 * dropped when the transaction reverted, or when its sender has used its nonce for another
 * transaction (replaced or cancelled in the wallet) and the current tree does not hold its
 * change note.
 *
 * Withdrawals that were set aside are checked in the same way.
 *
 * @param {Object} [web3] - to look the sent transaction up by its hash
 * @returns {number} how many withdrawals were found mined and recorded now
 */
export async function reconcilePendingCashouts(reputationContract, treeState, web3) {
  var pending = getPendingCashouts().concat(getAsideCashouts());
  var settled = 0;
  for (var i = 0; i < pending.length; i++) {
    var p = pending[i];
    var leafIndex = treeState.allLeaves.map(String).indexOf(p.changeLeaf);
    if (leafIndex >= 0) {
      settleCashout(p, leafIndex, p.txHash || null);
      settled++;
      continue;
    }
    var spent = await anyInputSpent(reputationContract, p);
    var info = await reputationContract.methods.getNoteTreeInfo().call();
    var current = BigInt(info[0]) === BigInt(treeState.root);
    if (spent && current) {
      dropPendingCashout(p.changeLeaf);
    } else if (web3 && p.txHash) {
      try {
        if (await cannotBeMined(web3, p, current)) dropPendingCashout(p.changeLeaf);
      } catch (_) { /* not known yet: the record stays */ }
    }
  }
  return settled;
}

// True when the contract counts an input note of the withdrawal as spent. The record names the
// nullifier hash of note 1; the one of note 2 is computed from the local note.
async function anyInputSpent(reputationContract, p) {
  var hashes = [String(p.nullifierHash)];
  var notes = getPaymentNotes();
  (p.spent || []).forEach(function(nullifier) {
    var note = notes.filter(function(n) { return String(n.nullifier) === String(nullifier); })[0];
    if (!note) return;
    var hash = computeNullifierHash(note.amount, note.nullifier).toString();
    if (hashes.indexOf(hash) < 0) hashes.push(hash);
  });
  for (var i = 0; i < hashes.length; i++) {
    if (await reputationContract.methods.spentNoteNullifiers(hashes[i]).call()) return true;
  }
  return false;
}

// True when the sent transaction reverted, or when another transaction took its nonce and the
// current tree (currentTree) does not hold its change note.
async function cannotBeMined(web3, p, currentTree) {
  var receipt = await web3.eth.getTransactionReceipt(p.txHash);
  if (receipt) return receipt.status === false || Number(receipt.status) === 0;
  var nonce = p.nonce, from = p.from;
  if (nonce === undefined || nonce === null || !from) {
    var tx = await web3.eth.getTransaction(p.txHash);
    if (!tx) return false;
    nonce = tx.nonce;
    from = tx.from;
    notePendingTransaction(p.changeLeaf, { nonce: Number(nonce), from: from });
  }
  var used = Number(await web3.eth.getTransactionCount(from, 'latest'));
  return currentTree && used > Number(nonce);
}

// Hands a signed transaction to the node. Resolves once the node took it, without waiting for
// it to be mined; rejects with the node's or the connection's error.
function broadcastRaw(web3, rawTx) {
  return new Promise(function(resolve, reject) {
    var sending = web3.eth.sendSignedTransaction(rawTx);
    sending.once('transactionHash', resolve);
    sending.on('error', reject);
    // the outcome is read from the tree later; an error after the hash is not ours to handle
    if (typeof sending.catch === 'function') sending.catch(function() {});
  });
}

// For the waiting withdrawals that were signed in this browser (the funding of an order): when
// the node does not know the transaction, the same signed bytes are sent again. It is the same
// transaction (same hash, same nonce), so it can be mined once at most.
async function rebroadcastUnknown(web3) {
  var result = { resent: 0, refused: '' };
  if (!web3 || !web3.eth || typeof web3.eth.sendSignedTransaction !== 'function') return result;
  var pending = getPendingCashouts().filter(function(p) { return p.rawTx && p.txHash; });
  for (var i = 0; i < pending.length; i++) {
    var known;
    try {
      known = await web3.eth.getTransaction(pending[i].txHash);
    } catch (_) {
      continue; // the node did not answer: nothing is sent
    }
    if (known) continue;
    try {
      await broadcastRaw(web3, pending[i].rawTx);
      result.resent++;
    } catch (err) {
      var message = (err && err.message) || String(err);
      if (!/already known|known transaction/i.test(message)) result.refused = message;
    }
  }
  return result;
}

/**
 * "Check again": looks whether the withdrawals sent earlier (waiting or set aside) were mined and
 * records them. The wallet is not asked. Nothing new is sent; the only thing that can leave the
 * browser is a waiting withdrawal that was signed here and that the node does not know: the same
 * signed transaction is sent again.
 *
 * @param {Object} params - { reputationContract, logWeb3, reputationAddress, fromBlock, web3 }
 * @returns {Promise<Object>} { settled, pending, resent, refused, aside } (pending: true when one
 *   is still not recorded; resent: how many were sent again; refused: the node's answer when it
 *   did not take one of them; aside: how many set-aside withdrawals are left)
 */
export async function checkPendingCashouts(params) {
  var settled = 0;
  var again = { resent: 0, refused: '' };
  if (hasPendingCashouts() || countSetAsideCashouts() > 0) {
    var treeState = await fetchTreeState(params.logWeb3, params.reputationAddress, params.fromBlock);
    settled = await reconcilePendingCashouts(params.reputationContract, treeState, params.web3);
    if (hasPendingCashouts()) again = await rebroadcastUnknown(params.logWeb3);
  }
  return {
    settled: settled, pending: hasPendingCashouts(),
    resent: again.resent, refused: again.refused, aside: countSetAsideCashouts(),
  };
}

/** The error of a run that found a withdrawal still waiting to be mined. */
export function isPendingWithdrawalError(err) {
  return !!err && err.pendingWithdrawal === true;
}

function pendingWithdrawalError() {
  var err = new Error('A withdrawal sent earlier is still waiting to be mined. Nothing was sent.');
  err.pendingWithdrawal = true;
  return err;
}

/** True when a withdrawal was sent and its outcome is not recorded yet. */
export function hasPendingCashouts() {
  return getPendingCashouts().length > 0;
}

// ─── Runner ──────────────────────────────────────────────────────────────────

function isUserRejection(err) {
  return !!err && (err.code === 4001 || /user (rejected|denied)/i.test(err.message || ''));
}

/**
 * Run the cash-out: one mergeWithdraw at a time, sent by the establishment's own wallet to
 * itself, each one after the receipt of the previous. The plan is computed again before every
 * step from the notes as they are, so a run that stops (rejected in the wallet, failed, page
 * closed) is continued by running it again.
 *
 * @param {Object} params
 * @param {Object} params.reputationContract - web3 contract of the Reputation contract (wallet provider)
 * @param {Object} params.logWeb3 - web3 instance for reading logs
 * @param {string} params.reputationAddress
 * @param {number} params.fromBlock - DEPLOY_BLOCK
 * @param {string} params.account - the establishment's wallet: sender and recipient
 * @param {Object} [params.policy] - defaults to CASHOUT_POLICY
 * @param {Object} [params.web3] - to look a sent transaction up by its hash (wallet provider)
 * @param {boolean} [params.all] - withdraw everything in one amount instead of the policy
 * @param {Function} [params.onStep] - called with { index, total, type, amount, status, txHash, gasUsed, error }
 *   (status: 'proving' | 'sending' | 'done' | 'failed')
 * @returns {Promise<Array>} the steps done: { type, amount, txHash, gasUsed }
 * @throws an error for which isPendingWithdrawalError is true when a withdrawal sent earlier is
 *   still waiting to be mined (nothing is sent then)
 */
export async function runCashout(params) {
  var reputationContract = params.reputationContract;
  var policy = params.policy || CASHOUT_POLICY;
  var report = params.onStep || function() {};
  var done = [];
  var total = null;

  var readTree = function() { return fetchTreeState(params.logWeb3, params.reputationAddress, params.fromBlock); };

  for (;;) {
    // A withdrawal sent earlier may have been mined since: record it before planning.
    // While one is still waiting, nothing is sent: a second one would spend the same notes.
    // A withdrawal that was set aside is looked for too, and does not stop the run.
    if (hasPendingCashouts() || countSetAsideCashouts() > 0) {
      await reconcilePendingCashouts(reputationContract, await readTree(), params.web3);
      if (hasPendingCashouts()) throw pendingWithdrawalError();
    }

    // Drop local notes the contract already counts as spent, then plan from what is left
    var unspent = await syncSpentNotes(reputationContract);
    var state = getCashoutState();
    var plan;
    if (params.all) {
      plan = planWithdrawAll(unspent);
    } else {
      plan = planCashout(unspent, policy, state);
      var ledger = getCashoutLedger();
      if (plan.length > 0 && !ledger.open) {
        // The notes received from orders so far are counted from now on, whatever happens to this run
        ledger.open = true;
        ledger.countedNotes = state.revenueCount;
        saveCashoutLedger(ledger);
      } else if (plan.length === 0 && ledger.open) {
        ledger.open = false;
        saveCashoutLedger(ledger);
      }
    }
    if (plan.length === 0) break;
    if (total === null) total = plan.length;

    var step = plan[0];
    var info = { index: done.length, total: Math.max(total, done.length + plan.length), type: step.type, amount: step.withdrawAmount.toString() };
    var pending = null;
    var stage = 'proving';
    try {
      report(Object.assign({ status: 'proving' }, info));
      var treeState = await readTree();
      var root = treeState.root.toString();
      if (!(await reputationContract.methods.isKnownNoteRoot(root).call())) {
        throw new Error('The rebuilt note tree does not match the contract (the RPC node may be behind). Please wait a moment and try again.');
      }
      var changeSecrets = generateNoteSecrets();
      var proofResult = await generateMergeWithdrawProof({
        note1: step.note1,
        note2: step.note2 || getDummyNote(),
        withdrawAmount: step.withdrawAmount.toString(),
        recipient: BigInt(params.account).toString(),
        treeState: treeState,
        changeSecrets: changeSecrets,
      });

      pending = {
        spent: [step.note1].concat(step.note2 ? [step.note2] : []).map(function(n) { return n.nullifier.toString(); }),
        nullifierHash: computeNullifierHash(step.note1.amount, step.note1.nullifier).toString(),
        change: {
          nullifier: changeSecrets.nullifier.toString(),
          trapdoor: changeSecrets.trapdoor.toString(),
          amount: proofResult.changeNote.amount.toString(),
        },
        changeLeaf: proofResult.changeNote.commitment.toString(),
        withdrawAmount: step.withdrawAmount.toString(),
        all: !!params.all && step.type === 'withdraw',
      };

      var call = reputationContract.methods.mergeWithdraw(
        params.account,
        pending.withdrawAmount,
        proofResult.publicSignals[0],
        proofResult.publicSignals[1],
        proofResult.publicSignals[2],
        root,
        proofResult.proof.a,
        proofResult.proof.b,
        proofResult.proof.c
      );
      // Dry-run: a withdrawal that would revert is not sent
      var gas = Number(withGasMargin(await call.estimateGas({ from: params.account })));

      addPendingWithdrawal(pending);
      stage = 'sending';
      report(Object.assign({ status: 'sending' }, info));
      var sending = call.send({ from: params.account, gas: gas });
      if (sending && typeof sending.on === 'function') {
        sending.on('transactionHash', (function(changeLeaf) {
          return function(hash) {
            notePendingTransaction(changeLeaf, { txHash: hash, from: params.account });
            // the nonce tells later whether the wallet replaced or cancelled it
            if (params.web3) {
              params.web3.eth.getTransaction(hash).then(function(tx) {
                if (tx) notePendingTransaction(changeLeaf, { nonce: Number(tx.nonce) });
              }).catch(function() {});
            }
          };
        })(pending.changeLeaf));
      }
      var receipt = await sending;

      settleCashout(pending, findNoteLeafIndex(receipt, pending.changeLeaf), receipt.transactionHash);
      var result = Object.assign({ status: 'done', txHash: receipt.transactionHash, gasUsed: Number(receipt.gasUsed) }, info);
      done.push(result);
      report(result);
    } catch (err) {
      if (stage === 'sending') {
        if (isUserRejection(err) || (err && err.receipt && err.receipt.status === false)) {
          // never sent, or reverted: the notes are untouched
          dropPendingCashout(pending.changeLeaf);
        } else {
          // sent, outcome unknown: record it if it was mined, otherwise keep it for the next run
          try { await reconcilePendingCashouts(reputationContract, await readTree(), params.web3); } catch (_) {}
        }
      }
      report(Object.assign({ status: 'failed', error: (err && err.message) || String(err) }, info));
      throw err;
    }
  }
  return done;
}
