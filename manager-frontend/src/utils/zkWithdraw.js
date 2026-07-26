/* global BigInt */
/**
 * ZK Payment Withdrawal Utilities (Manager/Restaurant Side)
 *
 * Handles:
 *   - Generating MergeWithdraw proofs in-browser via snarkjs
 *   - Managing payment notes in localStorage (UTXO model)
 *   - Auto-batching merge + withdrawal operations
 *
 * Uses window.snarkjs (loaded via UMD script tag, same pattern as rating proofs).
 */

import { poseidon2 } from '../utils/poseidon';

const PAYMENT_NOTES_KEY = 'restaurantPaymentNotes';
const MERGE_WITHDRAW_WASM = '/circuits/mergeWithdraw.wasm';
const MERGE_WITHDRAW_ZKEY = '/circuits/mergeWithdraw_0001.zkey';

// ─── Note Management (localStorage) ─────────────────────────────────────────

/**
 * Store a new payment note (created when an order concludes).
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
  localStorage.setItem(PAYMENT_NOTES_KEY, JSON.stringify(notes));
}

/**
 * Get all payment notes (both spent and unspent).
 */
export function getPaymentNotes() {
  return JSON.parse(localStorage.getItem(PAYMENT_NOTES_KEY) || '[]');
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
  localStorage.setItem(PAYMENT_NOTES_KEY, JSON.stringify(notes));
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
 * Build a Merkle proof for a given leaf index from the tree state.
 *
 * @param {number} leafIndex - Index of the leaf in the tree
 * @param {Array} filledSubtrees - The globalFilledSubtrees array from the contract
 * @param {Array} allLeaves - All leaves inserted into the tree (from TicketAdded events)
 * @param {number} treeDepth - Depth of the tree (25)
 * @returns {Object} { pathIndices, siblings }
 */
export function buildMerkleProof(leafIndex, allLeaves, zeros, treeDepth = 25) {
  // Build tree only up to actual leaf count (NOT 2^25 = 33M)
  // Pad to next power of 2 for balanced tree, but only as large as needed
  var n = allLeaves.length;
  if (n === 0) n = 1;
  // Round up to next power of 2, but cap at 2^treeDepth
  var size = 1;
  while (size < n) size *= 2;

  // Layer 0: actual leaves + zeros padding
  var layers = [[]];
  for (var i = 0; i < size; i++) {
    layers[0].push(i < allLeaves.length ? BigInt(allLeaves[i]) : BigInt(zeros[0]));
  }

  // Build intermediate layers — only as many nodes as needed
  for (var level = 1; level <= treeDepth; level++) {
    layers.push([]);
    var prevLayer = layers[level - 1];
    if (prevLayer.length === 0) {
      layers[level].push(BigInt(zeros[level]));
    } else {
      for (var j = 0; j < prevLayer.length; j += 2) {
        var left = prevLayer[j];
        var right = j + 1 < prevLayer.length ? prevLayer[j + 1] : BigInt(zeros[level - 1]);
        layers[level].push(poseidon2([left, right]));
      }
    }
    // Once we've reduced to 1 node and remaining levels use zeros, we can shortcut
    // but still need to build all 25 levels for the proof path
  }

  // Extract proof path
  var pathIndices = [];
  var siblings = [];
  var idx = leafIndex;

  for (var lv = 0; lv < treeDepth; lv++) {
    var isRight = idx % 2;
    pathIndices.push(isRight);
    var siblingIdx = isRight ? idx - 1 : idx + 1;
    if (lv < layers.length && siblingIdx < layers[lv].length) {
      siblings.push(layers[lv][siblingIdx]);
    } else {
      siblings.push(BigInt(zeros[lv]));
    }
    idx = Math.floor(idx / 2);
  }

  return { pathIndices: pathIndices, siblings: siblings };
}

/**
 * Generate a MergeWithdraw ZK proof.
 *
 * @param {Object} params
 * @param {Object} params.note1 - { nullifier, trapdoor, amount, leafIndex }
 * @param {Object} params.note2 - { nullifier, trapdoor, amount, leafIndex } (use dummy for single-note)
 * @param {BigInt} params.withdrawAmount - 0n for pure merge, denomination for withdrawal
 * @param {string} params.recipient - Address to receive withdrawn ETH
 * @param {BigInt} params.root - Merkle root
 * @param {Array} params.allLeaves - All tree leaves (from events)
 * @param {Array} params.zeros - Zero hashes for each level
 * @param {Object} params.changeSecrets - { nullifier, trapdoor } for the change note
 * @returns {Promise<Object>} { proof, publicSignals, changeNote }
 */
export async function generateMergeWithdrawProof(params) {
  const {
    note1, note2, withdrawAmount, recipient, root, allLeaves, zeros, changeSecrets,
  } = params;

  const treeDepth = 25;

  // Build Merkle proofs using incremental tree algorithm (matches contract)
  const proof1 = buildMerkleProofFromLeaves(note1.leafIndex, allLeaves, zeros, treeDepth);
  const proof2 = buildMerkleProofFromLeaves(note2.leafIndex, allLeaves, zeros, treeDepth);

  // Debug: verify root locally
  var leaf1Inner = poseidon2([BigInt(note1.nullifier), BigInt(note1.trapdoor)]);
  var leaf1Computed = poseidon2([leaf1Inner, BigInt(note1.amount)]);
  var localRoot = leaf1Computed;
  for (var dbg = 0; dbg < treeDepth; dbg++) {
    if (proof1.pathIndices[dbg] === 0) {
      localRoot = poseidon2([localRoot, proof1.siblings[dbg]]);
    } else {
      localRoot = poseidon2([proof1.siblings[dbg], localRoot]);
    }
  }
  console.log('[ZK] local root:', localRoot.toString());
  console.log('[ZK] contract root:', root.toString());
  console.log('[ZK] roots match:', localRoot.toString() === root.toString());

  // Compute change amount
  const changeAmount = BigInt(note1.amount) + BigInt(note2.amount) - BigInt(withdrawAmount);

  // Compute change commitment
  const changeInner = poseidon2([BigInt(changeSecrets.nullifier), BigInt(changeSecrets.trapdoor)]);
  const changeCommitment = poseidon2([changeInner, changeAmount]);

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
 * Fetch tree state by querying TicketAdded events from the Reputation contract.
 * Reconstructs the allLeaves array needed for Merkle proof generation.
 *
 * @param {Object} logWeb3 - web3 instance connected to RPC (for reading events)
 * @param {string} reputationAddress - Reputation contract address
 * @param {number} fromBlock - DEPLOY_BLOCK to start scanning from
 * @returns {Promise<Object>} { allLeaves, zeros }
 */
/**
 * Fetch tree state from events AND contract state.
 * Returns allLeaves (from events), zeros, filledSubtrees, and root (from contract).
 */
export async function fetchTreeState(logWeb3, reputationAddress, fromBlock, web3) {
  var eventTopic = logWeb3.utils.keccak256('TicketAdded(uint32,uint256)');

  // Retry up to 5 times with increasing delay (Infura rate limits)
  var logs = [];
  for (var attempt = 0; attempt < 5; attempt++) {
    try {
      logs = await logWeb3.eth.getPastLogs({
        address: reputationAddress,
        fromBlock: fromBlock,
        toBlock: 'latest',
        topics: [eventTopic]
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

  // The dummy zero-note at index 0 is always poseidon(poseidon(0,0), 0)
  // Its constructor event may not be captured if DEPLOY_BLOCK is after the deployment tx
  var innerCommit = poseidon2([0n, 0n]);
  var dummyLeaf = poseidon2([innerCommit, 0n]);
  var allLeaves = [dummyLeaf.toString()]; // index 0 = dummy note

  for (var i = 0; i < logs.length; i++) {
    var log = logs[i];
    var decoded = logWeb3.eth.abi.decodeParameters(['uint32', 'uint256'], log.data);
    var leafIndex = parseInt(decoded[0]);
    var leaf = decoded[1];
    while (allLeaves.length <= leafIndex) {
      allLeaves.push('0');
    }
    allLeaves[leafIndex] = BigInt(leaf).toString();
  }

  // Compute zeros array matching the contract
  var TREE_DEPTH = 25;
  var zeros = [];
  zeros[0] = '0';
  for (var level = 1; level < TREE_DEPTH; level++) {
    zeros[level] = poseidon2([BigInt(zeros[level - 1]), BigInt(zeros[level - 1])]).toString();
  }

  console.log('[TreeState] allLeaves count:', allLeaves.length);
  console.log('[TreeState] allLeaves FULL:', allLeaves);
  console.log('[TreeState] raw logs count:', logs.length);
  for (var dl = 0; dl < logs.length; dl++) {
    var dd = logWeb3.eth.abi.decodeParameters(['uint32', 'uint256'], logs[dl].data);
    console.log('[TreeState] event', dl, 'leafIndex:', dd[0], 'leaf:', dd[1]);
  }

  return { allLeaves: allLeaves, zeros: zeros };
}

/**
 * Build a Merkle proof by re-computing the tree from all leaves.
 * Uses the same algorithm as the contract's incremental Merkle tree.
 */
export function buildMerkleProofFromLeaves(leafIndex, allLeaves, zeros, treeDepth) {
  treeDepth = treeDepth || 25;
  var n = allLeaves.length;

  // Simulate incremental tree: insert leaves one by one, tracking filledSubtrees
  var filledSubtrees = [];
  for (var z = 0; z < treeDepth; z++) {
    filledSubtrees[z] = BigInt(zeros[z]);
  }

  // We need to track the full tree nodes at each level for the proof
  // Store all nodes: layers[level][index] = hash
  var layers = [];
  for (var l = 0; l < treeDepth + 1; l++) {
    layers.push({});
  }

  // Insert each leaf using the same algorithm as the contract
  for (var li = 0; li < n; li++) {
    var currentIndex = li;
    var currentLevelHash = BigInt(allLeaves[li]);
    layers[0][li] = currentLevelHash;

    for (var lv = 0; lv < treeDepth; lv++) {
      var left, right;
      if (currentIndex % 2 === 0) {
        left = currentLevelHash;
        right = BigInt(zeros[lv]);
        filledSubtrees[lv] = currentLevelHash;
      } else {
        left = filledSubtrees[lv];
        right = currentLevelHash;
      }
      currentLevelHash = poseidon2([left, right]);
      currentIndex = Math.floor(currentIndex / 2);
      layers[lv + 1][currentIndex] = currentLevelHash;
    }
  }

  // Now extract the proof path for the target leaf
  var pathIndices = [];
  var siblings = [];
  var idx = leafIndex;

  for (var plv = 0; plv < treeDepth; plv++) {
    var isRight = idx % 2;
    pathIndices.push(isRight);
    var siblingIdx = isRight ? idx - 1 : idx + 1;
    if (layers[plv][siblingIdx] !== undefined) {
      siblings.push(layers[plv][siblingIdx]);
    } else {
      siblings.push(BigInt(zeros[plv]));
    }
    idx = Math.floor(idx / 2);
  }

  return { pathIndices: pathIndices, siblings: siblings };
}

// ─── Dummy Note ──────────────────────────────────────────────────────────────

/**
 * Get the dummy zero-note (pre-inserted at index 0 in the tree).
 * Used as the second input for single-note withdrawals.
 */
export function getDummyNote() {
  return {
    nullifier: 0n,
    trapdoor: 0n,
    amount: 0n,
    leafIndex: 0,
  };
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
