pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Helper template to compute a Merkle Root from a leaf and a path
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
        
        // If pathIndex is 0, hash(current, pathElement)
        // If pathIndex is 1, hash(pathElement, current)
        hashers[i].inputs[0] <== currentLevelHash[i] + (pathElements[i] - currentLevelHash[i]) * pathIndices[i];
        hashers[i].inputs[1] <== currentLevelHash[i] + (pathElements[i] - currentLevelHash[i]) * (1 - pathIndices[i]);

        currentLevelHash[i + 1] <== hashers[i].out;
    }

    root <== currentLevelHash[levels];
}

// The main Anonymous Rating circuit
template Feedback(levels) {
    // ----------------------------------------------------------------
    // PRIVATE INPUTS (Hidden from everyone, known only to the rater)
    // ----------------------------------------------------------------
    signal input identityNullifier;  // Secret random number 1
    signal input identityTrapdoor;   // Secret random number 2
    signal input treePathIndices[levels]; // 0 or 1 (left or right path in the tree)
    signal input treeSiblings[levels];    // The hashes of neighbor nodes in the tree

    // ----------------------------------------------------------------
    // PUBLIC INPUTS (Known to the Smart Contract)
    // ----------------------------------------------------------------
    signal input externalNullifier; // The ID of the Service/Worker (prevents replay attacks)
    signal input signalHash;        // The Score (e.g., 5)
    signal input root;              // The Merkle Root of valid actors from the blockchain

    // ----------------------------------------------------------------
    // OUTPUTS (Calculated deterministically)
    // ----------------------------------------------------------------
    signal output nullifierHash;    // Unique tag to burn this specific rating ticket

    // 1. Generate Identity Commitment (The inner "Ticket" hash)
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== identityNullifier;
    commitmentHasher.inputs[1] <== identityTrapdoor;
    signal identityCommitment <== commitmentHasher.out;

    // 2. Bind commitment to worker: leaf = poseidon(identityCommitment, externalNullifier)
    //    This ensures the leaf in the global tree is tied to a specific worker,
    //    matching what the contract computes in addRatingTicket().
    component leafHasher = Poseidon(2);
    leafHasher.inputs[0] <== identityCommitment;
    leafHasher.inputs[1] <== externalNullifier;
    signal leaf <== leafHasher.out;

    // 3. Verify Membership in the Global Merkle Tree
    component treeChecker = MerkleTreeChecker(levels);
    treeChecker.leaf <== leaf;
    for (var i = 0; i < levels; i++) {
        treeChecker.pathElements[i] <== treeSiblings[i];
        treeChecker.pathIndices[i] <== treePathIndices[i];
    }
    
    // CONSTRAINT: The calculated root MUST match the public root on the blockchain
    treeChecker.root === root;

    // 4. Generate Nullifier Hash (To prevent double voting)
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== externalNullifier;
    nullifierHasher.inputs[1] <== identityNullifier;
    nullifierHash <== nullifierHasher.out;

    // 5. Bind the Signal (Score) to the Proof
    // This mathematically forces the score to be part of the final proof calculation
    signal dummySquare <== signalHash * signalHash;
}

// Instantiate the circuit
component main {public [root, externalNullifier, signalHash]} = Feedback(25);