/* global BigInt */
/**
 * ZK Payment Withdrawal Utilities (Manager/Restaurant Side)
 *
 * Handles:
 *   - Generating MergeWithdraw proofs in-browser via snarkjs
 *   - Managing payment notes in localStorage (UTXO model), per deployment
 *   - Auto-batching merge + withdrawal operations
 *
 * Uses window.snarkjs (loaded via UMD script tag in public/index.html).
 */

import { poseidon2 } from '../utils/poseidon';
import { computeZeros, buildLayers, getRoot, getMerklePath, computeRootFromPath, decodeLeafLog, orderLeaves } from './merkleTree';
import { readDeployment, writeDeployment } from './deploymentStorage';
import { getLogsChunked } from './chainLogs';

const PAYMENT_NOTES_KEY = 'restaurantPaymentNotes';
const MERGE_WITHDRAW_WASM = process.env.PUBLIC_URL + '/circuits/mergeWithdraw.wasm';
const MERGE_WITHDRAW_ZKEY = process.env.PUBLIC_URL + '/circuits/mergeWithdraw_0001.zkey';

// Depth of the payment pool's note tree (Reputation.NOTE_TREE_DEPTH, MergeWithdraw(25) circuit)
export const NOTE_TREE_DEPTH = 25;

// NoteAdded(uint32 leafIndex, uint256 leaf) — topic hash
export const NOTE_ADDED_TOPIC = '0xb4e8ce87d291434ce9d769aec519af2f38b6cda474f670051a09f975ee0579fb';

// ─── Note Management (localStorage) ─────────────────────────────────────────

/**
 * Store a new payment note (a deposit, the change of a withdrawal, or what an order paid
 * to the establishment when it ended).
 *
 * @param {Object} note - { nullifier, trapdoor, amount, leafIndex, commitment }
 *   All values as BigInt-compatible strings or BigInts.
 */
export function storePaymentNote(note) {
  const notes = getPaymentNotes();
  notes.push({
    nullifier: note.nullifier.toString(),
    trapdoor: note.trapdoor.toString(),
    amount: note.amount.toString(),
    leafIndex: note.leafIndex,
    commitment: note.commitment.toString(),
    spent: false,
  });
  writeDeployment(PAYMENT_NOTES_KEY, notes);
}

/**
 * Get all payment notes (both spent and unspent).
 */
export function getPaymentNotes() {
  return readDeployment(PAYMENT_NOTES_KEY, []);
}

/**
 * Get only unspent notes.
 */
export function getUnspentNotes() {
  return getPaymentNotes().filter(n => !n.spent);
}

/**
 * Get total balance of unspent notes.
 */
export function getUnspentBalance() {
  return getUnspentNotes().reduce((sum, n) => sum + BigInt(n.amount), 0n);
}

/**
 * Mark a note as spent by its nullifier.
 */
export function markNoteSpent(nullifier) {
  const notes = getPaymentNotes();
  const note = notes.find(n => n.nullifier === nullifier.toString());
  if (note) note.spent = true;
  writeDeployment(PAYMENT_NOTES_KEY, notes);
}

/**
 * Add a change note (created by a merge operation).
 */
export function addChangeNote(note) {
  storePaymentNote(note);
}

// ─── Proof Generation ────────────────────────────────────────────────────────

/**
 * Generate a random nullifier/trapdoor pair for a new note.
 */
export function generateNoteSecrets() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const nullifier = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));

  window.crypto.getRandomValues(bytes);
  const trapdoor = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));

  return { nullifier, trapdoor };
}

/**
 * Compute payment commitment: poseidon(nullifier, trapdoor)
 * This is stored on-chain when accepting an order.
 */
export function computePaymentCommitment(nullifier, trapdoor) {
  return poseidon2([BigInt(nullifier), BigInt(trapdoor)]);
}

/**
 * Compute the leaf for a payment note: poseidon(commitment, amount)
 */
export function computePaymentLeaf(commitment, amount) {
  return poseidon2([BigInt(commitment), BigInt(amount)]);
}

/**
 * Compute nullifier hash: poseidon(amount, nullifier)
 */
export function computeNullifierHash(amount, nullifier) {
  return poseidon2([BigInt(amount), BigInt(nullifier)]);
}

/**
 * Leaf of a stored note: poseidon(poseidon(nullifier, trapdoor), amount)
 */
export function computeNoteLeaf(note) {
  return computePaymentLeaf(computePaymentCommitment(note.nullifier, note.trapdoor), note.amount);
}

/**
 * Find a note in the rebuilt note tree. The stored leafIndex is used when it holds the note's
 * leaf; otherwise the note is looked up by its leaf (older notes may have no or a wrong index).
 */
export function findNoteIndex(note, allLeaves) {
  var leaf = computeNoteLeaf(note);
  var stored = note.leafIndex === null || note.leafIndex === undefined ? -1 : Number(note.leafIndex);
  if (stored >= 0 && stored < allLeaves.length && BigInt(allLeaves[stored]) === leaf) return stored;
  for (var i = 0; i < allLeaves.length; i++) {
    if (BigInt(allLeaves[i]) === leaf) return i;
  }
  throw new Error('Payment note not found in the note tree (its deposit may not be indexed by the RPC yet). Please try again in a moment.');
}

/**
 * Merkle path of a note in the rebuilt note tree, checked against the tree's root.
 */
export function getNotePath(note, treeState) {
  var leafIndex = findNoteIndex(note, treeState.allLeaves);
  var path = getMerklePath(treeState.layers, leafIndex, NOTE_TREE_DEPTH, treeState.zeros);
  if (computeRootFromPath(computeNoteLeaf(note), path.pathIndices, path.siblings) !== BigInt(treeState.root)) {
    throw new Error('Merkle path of note ' + leafIndex + ' does not reach the note-tree root');
  }
  return path;
}

/**
 * Generate a MergeWithdraw ZK proof.
 *
 * @param {Object} params
 * @param {Object} params.note1 - { nullifier, trapdoor, amount, leafIndex }
 * @param {Object} params.note2 - { nullifier, trapdoor, amount, leafIndex } (use dummy for single-note)
 * @param {BigInt} params.withdrawAmount - 0n for pure merge, otherwise the amount to pay out
 * @param {string} params.recipient - Address to receive withdrawn ETH
 * @param {Object} params.treeState - Rebuilt note tree from fetchTreeState() ({ allLeaves, layers, zeros, root });
 *   its root is the public root of the proof, so check it with isKnownNoteRoot() first
 * @param {Object} params.changeSecrets - { nullifier, trapdoor } for the change note
 * @returns {Promise<Object>} { proof, publicSignals, changeNote }
 */
export async function generateMergeWithdrawProof(params) {
  const {
    note1, note2, withdrawAmount, recipient, treeState, changeSecrets,
  } = params;

  // Merkle paths in the note tree (each one is checked to reach treeState.root)
  const proof1 = getNotePath(note1, treeState);
  const proof2 = getNotePath(note2, treeState);
  const root = treeState.root;
  console.log('[ZK] note-tree root:', root.toString());

  // Compute change amount
  const changeAmount = BigInt(note1.amount) + BigInt(note2.amount) - BigInt(withdrawAmount);

  // Compute change commitment
  const changeInner = poseidon2([BigInt(changeSecrets.nullifier), BigInt(changeSecrets.trapdoor)]);
  const changeCommitment = computePaymentLeaf(changeInner, changeAmount);

  // Circuit inputs
  const input = {
    // Note 1
    nullifier1: BigInt(note1.nullifier).toString(),
    trapdoor1: BigInt(note1.trapdoor).toString(),
    amount1: BigInt(note1.amount).toString(),
    pathIndices1: proof1.pathIndices.map(String),
    siblings1: proof1.siblings.map(s => s.toString()),

    // Note 2
    nullifier2: BigInt(note2.nullifier).toString(),
    trapdoor2: BigInt(note2.trapdoor).toString(),
    amount2: BigInt(note2.amount).toString(),
    pathIndices2: proof2.pathIndices.map(String),
    siblings2: proof2.siblings.map(s => s.toString()),

    // Change note
    changeNullifier: BigInt(changeSecrets.nullifier).toString(),
    changeTrapdoor: BigInt(changeSecrets.trapdoor).toString(),

    // Public inputs
    root: BigInt(root).toString(),
    withdrawAmount: BigInt(withdrawAmount).toString(),
    recipient: BigInt(recipient).toString(),
  };

  // Generate proof using snarkjs (loaded as UMD in index.html)
  const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
    input,
    MERGE_WITHDRAW_WASM,
    MERGE_WITHDRAW_ZKEY
  );

  // Format proof for Solidity verifier
  const solidityProof = {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };

  return {
    proof: solidityProof,
    publicSignals,
    changeNote: {
      nullifier: changeSecrets.nullifier,
      trapdoor: changeSecrets.trapdoor,
      amount: changeAmount,
      commitment: changeCommitment,
    },
  };
}

// ─── Tree State from Events ──────────────────────────────────────────────────

/**
 * Rebuild the note tree from the NoteAdded events of the Reputation contract.
 *
 * @param {Object} logWeb3 - web3 instance connected to RPC (for reading events)
 * @param {string} reputationAddress - Reputation contract address
 * @param {number} fromBlock - DEPLOY_BLOCK to start scanning from
 * @returns {Promise<Object>} { allLeaves, layers, zeros, root } — root is computed locally
 */
export async function fetchTreeState(logWeb3, reputationAddress, fromBlock) {
  // Retry up to 5 times with increasing delay (Infura rate limits)
  var logs = null;
  for (var attempt = 0; attempt < 5; attempt++) {
    try {
      logs = await getLogsChunked(logWeb3, {
        address: reputationAddress,
        fromBlock: fromBlock,
        toBlock: 'latest',
        topics: [NOTE_ADDED_TOPIC]
      });
      if (logs.length > 0) break;
      // If 0 logs but no error, might be legitimate (empty tree) or rate limited
      // Wait and retry to be sure
      if (attempt < 4) await new Promise(function(r) { setTimeout(r, 2000 * (attempt + 1)); });
    } catch(e) {
      console.warn('[TreeState] getPastLogs attempt', attempt + 1, 'failed:', e.message);
      if (attempt < 4) await new Promise(function(r) { setTimeout(r, 2000 * (attempt + 1)); });
    }
  }
  if (logs === null) {
    throw new Error('Failed to fetch the note tree (RPC rate limited). Please wait a moment and try again.');
  }

  // The dummy zero-note at index 0 is always poseidon(poseidon(0,0), 0).
  // Its constructor event is not captured when DEPLOY_BLOCK is after the deployment tx.
  var allLeaves = orderLeaves(
    logs.map(function(log) { return decodeLeafLog(log.data); }),
    [computeNoteLeaf(getDummyNote())]
  );

  var zeros = computeZeros(NOTE_TREE_DEPTH);
  var layers = buildLayers(allLeaves, NOTE_TREE_DEPTH, zeros);
  var root = getRoot(layers, NOTE_TREE_DEPTH, zeros);

  console.log('[TreeState] raw logs count:', logs.length);
  console.log('[TreeState] allLeaves count:', allLeaves.length);
  console.log('[TreeState] computed root:', root.toString());

  return { allLeaves: allLeaves, layers: layers, zeros: zeros, root: root };
}

/**
 * Store the note an order paid to the establishment, once. At acceptance the dApp keeps the
 * note's secrets (paymentSecrets.js); in the transaction that ends the order, whatever the
 * ending, the order deposits what it pays the establishment into the pool under that commitment:
 * the payment plus the collateral, or the collateral alone (`amount`: field 5 of Chain.getOrder
 * for the establishment). Finds the leaf in the note tree and stores the note so it can be
 * withdrawn later. A record that is claimed is never stored again.
 * @returns {boolean} true if a note was stored now
 */
export function claimRevenueNote(orderId, amount, treeState) {
  var all = readDeployment('paymentNoteSecrets', {});
  var secrets = all[orderId];
  if (!secrets || secrets.claimed || !amount || BigInt(amount) === 0n) return false;
  var leaf = computePaymentLeaf(secrets.commitment, amount).toString();
  var leafIndex = treeState.allLeaves.findIndex(function(l) { return l.toString() === leaf; });
  if (leafIndex < 0) return false;
  var alreadyStored = getPaymentNotes().some(function(n) { return n.commitment === secrets.commitment.toString(); });
  if (!alreadyStored) {
    storePaymentNote({
      nullifier: secrets.nullifier,
      trapdoor: secrets.trapdoor,
      amount: BigInt(amount).toString(),
      leafIndex: leafIndex,
      commitment: secrets.commitment,
    });
  }
  all[orderId] = Object.assign({}, secrets, { claimed: true });
  writeDeployment('paymentNoteSecrets', all);
  return !alreadyStored;
}

/**
 * Leaf index of a note just inserted, read from the NoteAdded log of its transaction receipt
 * (ethers: receipt.logs; web3: receipt.events, raw logs). Returns null when no log matches.
 */
export function findNoteLeafIndex(receipt, leaf) {
  var target = BigInt(leaf);
  var logs = receipt && receipt.logs ? receipt.logs.slice() : [];
  if (receipt && receipt.events) {
    Object.keys(receipt.events).forEach(function(key) {
      [].concat(receipt.events[key]).forEach(function(ev) {
        if (ev && ev.raw) logs.push(ev.raw);
      });
    });
  }
  for (var i = 0; i < logs.length; i++) {
    var topics = logs[i].topics || [];
    if (topics[0] && topics[0].toLowerCase() === NOTE_ADDED_TOPIC) {
      var decoded = decodeLeafLog(logs[i].data);
      if (decoded.leaf === target) return decoded.leafIndex;
    }
  }
  return null;
}

/**
 * Mark local notes that the contract already counts as spent (e.g. withdrawn from another
 * browser), using the pool's own spent set (spentNoteNullifiers). Returns the unspent notes.
 *
 * @param {Object} reputationContract - web3 contract instance of the Reputation contract
 */
export async function syncSpentNotes(reputationContract) {
  var notes = getUnspentNotes();
  for (var i = 0; i < notes.length; i++) {
    var nullHash = computeNullifierHash(notes[i].amount, notes[i].nullifier).toString();
    var spent = await reputationContract.methods.spentNoteNullifiers(nullHash).call();
    if (spent) {
      console.warn('[Notes] note', notes[i].leafIndex, 'is already spent on-chain; marking it spent');
      markNoteSpent(notes[i].nullifier);
    }
  }
  return getUnspentNotes();
}

// ─── Dummy Note ──────────────────────────────────────────────────────────────

/**
 * Get the dummy zero-note (pre-inserted at index 0 in the note tree).
 * Used as the second input for single-note withdrawals. The contract never marks its
 * nullifier hash (dummyNoteNullifierHash = poseidon(0, 0)) as spent, so it can always be reused.
 */
export function getDummyNote() {
  return {
    nullifier: 0n,
    trapdoor: 0n,
    amount: 0n,
    leafIndex: 0,
  };
}

/**
 * Pick the two inputs of a single mergeWithdraw that pays out targetAmount:
 * the two largest notes (the withdrawal also merges them), or the only note plus the dummy note.
 *
 * @returns {Object|null} { note1, note2 }, or null when no such pair covers targetAmount
 */
export function selectWithdrawalNotes(unspentNotes, targetAmount) {
  var target = BigInt(targetAmount);
  var notes = unspentNotes.slice().sort(function(a, b) {
    return Number(BigInt(b.amount) - BigInt(a.amount));
  });

  if (notes.length >= 2) {
    if (BigInt(notes[0].amount) + BigInt(notes[1].amount) < target) return null;
    return { note1: notes[0], note2: notes[1] };
  }
  if (notes.length === 1) {
    if (BigInt(notes[0].amount) < target) return null;
    return { note1: notes[0], note2: getDummyNote() };
  }
  return null;
}

// ─── Auto-Batch Withdrawal ──────────────────────────────────────────────────

/**
 * Plan a withdrawal: determine the sequence of merge + withdraw operations needed.
 *
 * @param {Array} unspentNotes - Array of unspent note objects
 * @param {BigInt} targetAmount - The amount to withdraw (flexible, not fixed denomination)
 * @returns {Array} Array of operations: { type: 'merge'|'withdraw', note1, note2, withdrawAmount }
 */
export function planWithdrawal(unspentNotes, targetAmount) {
  var operations = [];
  var target = BigInt(targetAmount);
  var notes = unspentNotes.slice().sort(function(a, b) {
    return Number(BigInt(b.amount) - BigInt(a.amount));
  });

  if (notes.length === 0) return operations;

  // Check if any single note >= target
  var bigNotes = notes.filter(function(n) { return BigInt(n.amount) >= target; });
  if (bigNotes.length > 0) {
    // Withdraw from the smallest sufficient note + dummy
    var best = bigNotes[bigNotes.length - 1];
    operations.push({
      type: 'withdraw',
      note1: best,
      note2: null, // will use dummy
      withdrawAmount: target,
    });
    return operations;
  }

  // All notes are below target — need to merge first
  // Strategy: chain-merge notes until accumulated >= target, then withdraw
  if (notes.length >= 2) {
    // First: pure merge of first two notes
    operations.push({
      type: 'merge',
      note1: notes[0],
      note2: notes[1],
      withdrawAmount: 0n,
    });

    var accumulated = BigInt(notes[0].amount) + BigInt(notes[1].amount);

    // Merge more notes if needed
    for (var i = 2; i < notes.length && accumulated < target; i++) {
      operations.push({
        type: 'merge',
        note1: null, // change note from previous operation
        note2: notes[i],
        withdrawAmount: 0n,
      });
      accumulated += BigInt(notes[i].amount);
    }

    // Final: withdraw if accumulated >= target
    if (accumulated >= target) {
      operations.push({
        type: 'withdraw',
        note1: null, // change note from last merge
        note2: null, // dummy
        withdrawAmount: target,
      });
    }
  }

  return operations;
}
