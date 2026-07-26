/**
 * ZK Proof Smoke Test
 *
 * Tests the full cycle OFF-CHAIN:
 *  1. Generate a random identity (nullifier + trapdoor)
 *  2. Compute the commitment = Poseidon(nullifier, trapdoor)
 *  3. Build a 20-level Merkle tree with just this one leaf
 *  4. Extract the Merkle path for that leaf
 *  5. Generate a Groth16 proof with snarkJS
 *  6. Verify the proof locally against verification_key.json
 *
 * No blockchain needed. Run with:
 *   node scripts/test_zk_proof.js
 */

const { buildPoseidon } = require('circomlibjs');
const { groth16 } = require('snarkjs');
const path = require('path');

const TREE_DEPTH = 20;
const WASM_PATH = path.join(__dirname, '../circuits/feedback_js/feedback.wasm');
const ZKEY_PATH = path.join(__dirname, '../circuits/feedback_0001.zkey');
const VK_PATH   = path.join(__dirname, '../circuits/verification_key.json');

async function main() {
  console.log('=== FoodChain ZK Rating Proof Test ===\n');

  // ── 1. Build Poseidon ──────────────────────────────────────────────
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // ── 2. Generate test identity ───────────────────────────────────────
  const identityNullifier = BigInt('0x' + Buffer.from(require('crypto').randomBytes(31)).toString('hex'));
  const identityTrapdoor  = BigInt('0x' + Buffer.from(require('crypto').randomBytes(31)).toString('hex'));
  console.log('identityNullifier:', identityNullifier.toString());
  console.log('identityTrapdoor :', identityTrapdoor.toString());

  // ── 3. Commitment = Poseidon(nullifier, trapdoor) ───────────────────
  const commitment = BigInt(F.toString(poseidon([identityNullifier, identityTrapdoor])));
  console.log('\ncommitment (leaf):', commitment.toString());

  // ── 4. Build Merkle tree zeros ──────────────────────────────────────
  const zeros = [0n];
  for (let i = 1; i < TREE_DEPTH; i++) {
    zeros.push(BigInt(F.toString(poseidon([zeros[i-1], zeros[i-1]]))));
  }

  // ── 5. Build path for leaf at index 0 ──────────────────────────────
  // Leaf 0 is always a LEFT child at every level → all pathIndices = 0
  // All siblings are zero-hashes
  const treePathIndices = Array(TREE_DEPTH).fill(0);
  const treeSiblings    = zeros.slice(0, TREE_DEPTH).map(z => z.toString());

  // Manually compute the root for this single-leaf tree
  let current = commitment;
  for (let i = 0; i < TREE_DEPTH; i++) {
    current = BigInt(F.toString(poseidon([current, zeros[i]])));
  }
  const root = current;
  console.log('\nMerkle root (single-leaf tree):', root.toString());

  // ── 6. externalNullifier = fake worker address as BigInt ────────────
  const externalNullifier = BigInt('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
  const signalHash = BigInt(4); // rating = 4 stars

  // Expected nullifierHash = Poseidon(externalNullifier, identityNullifier)
  const expectedNullifierHash = BigInt(F.toString(poseidon([externalNullifier, identityNullifier])));
  console.log('\nexternalNullifier:', externalNullifier.toString());
  console.log('signalHash (score):', signalHash.toString());
  console.log('expected nullifierHash:', expectedNullifierHash.toString());

  // ── 7. Generate proof ───────────────────────────────────────────────
  console.log('\nGenerating proof (this takes ~10-30 seconds)...');
  const input = {
    identityNullifier: identityNullifier.toString(),
    identityTrapdoor:  identityTrapdoor.toString(),
    treePathIndices:   treePathIndices.map(String),
    treeSiblings,
    root:              root.toString(),
    externalNullifier: externalNullifier.toString(),
    signalHash:        signalHash.toString(),
  };

  const { proof, publicSignals } = await groth16.fullProve(input, WASM_PATH, ZKEY_PATH);

  console.log('\n✓  Proof generated successfully');
  console.log('\nPublic signals (order: nullifierHash, externalNullifier, signalHash, root):');
  publicSignals.forEach((s, i) => console.log(`  [${i}] ${s}`));

  // Sanity check: signal[0] must equal expectedNullifierHash
  if (publicSignals[0] === expectedNullifierHash.toString()) {
    console.log('\n✓  nullifierHash matches expected value');
  } else {
    console.error('\n✗  nullifierHash MISMATCH');
    console.error('  expected:', expectedNullifierHash.toString());
    console.error('  got     :', publicSignals[0]);
    process.exit(1);
  }

  // ── 8. Verify proof locally ─────────────────────────────────────────
  const vKey = require(VK_PATH);
  const isValid = await groth16.verify(vKey, publicSignals, proof);

  if (isValid) {
    console.log('\n✓  Proof verified successfully against verification_key.json');
    console.log('\n=== ALL CHECKS PASSED ===');
  } else {
    console.error('\n✗  Proof verification FAILED');
    process.exit(1);
  }

  // ── 9. Print Solidity calldata format ──────────────────────────────
  console.log('\n--- Solidity calldata (for manual Remix test) ---');
  const calldata = await groth16.exportSolidityCallData(proof, publicSignals);
  console.log(calldata);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
