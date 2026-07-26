pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Merkle proof checker — same template used in feedback.circom
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component hashers[levels];
    signal currentLevelHash[levels + 1];

    currentLevelHash[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== currentLevelHash[i] + (pathElements[i] - currentLevelHash[i]) * pathIndices[i];
        hashers[i].inputs[1] <== currentLevelHash[i] + (pathElements[i] - currentLevelHash[i]) * (1 - pathIndices[i]);
        currentLevelHash[i + 1] <== hashers[i].out;
    }

    root <== currentLevelHash[levels];
}

// MergeWithdraw circuit: merges 2 UTXO notes into 1 withdrawal + 1 change note
// Used by restaurants to privately withdraw accumulated payments from the ZK pool.
//
// Flow:
//   - Prover knows secrets for 2 notes (nullifier, trapdoor, amount) + Merkle proofs
//   - Proves both notes exist in the tree
//   - Proves sum of amounts >= withdrawAmount
//   - Computes change = sum - withdrawAmount
//   - Outputs changeCommitment for reinsertion into tree
//   - withdrawAmount must be 0 (pure merge) or the contract's denomination
template MergeWithdraw(levels) {
    // ----------------------------------------------------------------
    // PRIVATE INPUTS — note 1
    // ----------------------------------------------------------------
    signal input nullifier1;
    signal input trapdoor1;
    signal input amount1;
    signal input pathIndices1[levels];
    signal input siblings1[levels];

    // ----------------------------------------------------------------
    // PRIVATE INPUTS — note 2
    // ----------------------------------------------------------------
    signal input nullifier2;
    signal input trapdoor2;
    signal input amount2;
    signal input pathIndices2[levels];
    signal input siblings2[levels];

    // ----------------------------------------------------------------
    // PRIVATE INPUTS — change note secrets
    // ----------------------------------------------------------------
    signal input changeNullifier;
    signal input changeTrapdoor;

    // ----------------------------------------------------------------
    // PUBLIC INPUTS
    // ----------------------------------------------------------------
    signal input root;              // Merkle root (any recent root accepted by contract)
    signal input withdrawAmount;    // 0 (pure merge) or denomination
    signal input recipient;         // Address receiving the withdrawal (uint256)

    // ----------------------------------------------------------------
    // OUTPUTS (public)
    // ----------------------------------------------------------------
    signal output nullifierHash1;   // Spent marker for note 1
    signal output nullifierHash2;   // Spent marker for note 2
    signal output changeCommitment; // Commitment for the change note

    // ================================================================
    // 1. Compute leaf1 = poseidon(poseidon(nullifier1, trapdoor1), amount1)
    // ================================================================
    component innerHash1 = Poseidon(2);
    innerHash1.inputs[0] <== nullifier1;
    innerHash1.inputs[1] <== trapdoor1;

    component leafHash1 = Poseidon(2);
    leafHash1.inputs[0] <== innerHash1.out;
    leafHash1.inputs[1] <== amount1;
    signal leaf1 <== leafHash1.out;

    // ================================================================
    // 2. Verify leaf1 is in the Merkle tree
    // ================================================================
    component tree1 = MerkleTreeChecker(levels);
    tree1.leaf <== leaf1;
    for (var i = 0; i < levels; i++) {
        tree1.pathElements[i] <== siblings1[i];
        tree1.pathIndices[i] <== pathIndices1[i];
    }
    tree1.root === root;

    // ================================================================
    // 3. Compute leaf2 = poseidon(poseidon(nullifier2, trapdoor2), amount2)
    // ================================================================
    component innerHash2 = Poseidon(2);
    innerHash2.inputs[0] <== nullifier2;
    innerHash2.inputs[1] <== trapdoor2;

    component leafHash2 = Poseidon(2);
    leafHash2.inputs[0] <== innerHash2.out;
    leafHash2.inputs[1] <== amount2;
    signal leaf2 <== leafHash2.out;

    // ================================================================
    // 4. Verify leaf2 is in the Merkle tree
    // ================================================================
    component tree2 = MerkleTreeChecker(levels);
    tree2.leaf <== leaf2;
    for (var i = 0; i < levels; i++) {
        tree2.pathElements[i] <== siblings2[i];
        tree2.pathIndices[i] <== pathIndices2[i];
    }
    tree2.root === root;

    // ================================================================
    // 5. Verify amount1 + amount2 >= withdrawAmount
    // ================================================================
    component gte = GreaterEqThan(252);
    gte.in[0] <== amount1 + amount2;
    gte.in[1] <== withdrawAmount;
    gte.out === 1;

    // ================================================================
    // 6. Compute changeAmount and changeCommitment
    //    changeAmount = amount1 + amount2 - withdrawAmount
    //    changeCommitment = poseidon(poseidon(changeNullifier, changeTrapdoor), changeAmount)
    // ================================================================
    signal changeAmount <== amount1 + amount2 - withdrawAmount;

    component changeInnerHash = Poseidon(2);
    changeInnerHash.inputs[0] <== changeNullifier;
    changeInnerHash.inputs[1] <== changeTrapdoor;

    component changeLeafHash = Poseidon(2);
    changeLeafHash.inputs[0] <== changeInnerHash.out;
    changeLeafHash.inputs[1] <== changeAmount;
    changeCommitment <== changeLeafHash.out;

    // ================================================================
    // 7. Compute nullifier hashes (spent markers)
    //    nullifierHash = poseidon(amount, nullifier)
    //    Including amount prevents cross-note nullifier collisions
    // ================================================================
    component nullHash1 = Poseidon(2);
    nullHash1.inputs[0] <== amount1;
    nullHash1.inputs[1] <== nullifier1;
    nullifierHash1 <== nullHash1.out;

    component nullHash2 = Poseidon(2);
    nullHash2.inputs[0] <== amount2;
    nullHash2.inputs[1] <== nullifier2;
    nullifierHash2 <== nullHash2.out;

    // ================================================================
    // 8. Bind recipient to the proof (prevents front-running)
    // ================================================================
    signal recipientSquare <== recipient * recipient;
}

// Instantiate with depth 25 (shared tree with ratings)
component main {public [root, withdrawAmount, recipient]} = MergeWithdraw(25);
