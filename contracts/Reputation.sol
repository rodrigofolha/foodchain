// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

interface IFeedbackVerifier {
    function verifyProof(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[4] memory input) external view returns (bool);
}

interface IMergeWithdrawVerifier {
    function verifyProof(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[6] memory input) external view returns (bool);
}

// Interface for the circomlibjs-generated Poseidon hasher
interface IHasher {
    function poseidon(uint256[2] memory input) external pure returns (uint256);
}

contract GlobalReputation {
    IHasher public hasher;
    IFeedbackVerifier public feedbackVerifier;
    IMergeWithdrawVerifier public mergeWithdrawVerifier;
    uint8 public constant TREE_DEPTH = 25;

    // --- Single global Merkle tree (shared for ratings + payments) ---
    uint256 public globalRoot;
    uint32 public globalNextLeafIndex;
    uint256[25] public globalFilledSubtrees;

    // Pre-calculated hashes of empty nodes at each level
    uint256[25] public zeros;

    // --- Root history (ring buffer of last 100 roots) ---
    uint256 public constant ROOT_HISTORY_SIZE = 100;
    uint256[100] public rootHistory;
    uint256 public currentRootIndex;

    // --- Payment pool ---
    uint256 public denomination; // Fixed withdrawal amount (e.g., 0.001 ETH)

    struct WorkerStats {
        uint256 totalScore;
        uint256 totalRatings;
        uint256 completedOrders;
    }

    mapping(address => WorkerStats) public workers;
    mapping(address => uint32) private workerTicketCount;

    // Tracks used nullifiers (shared for ratings + payments)
    mapping(uint256 => bool) public usedNullifiers;

    // Privacy-preserving events — no actor address revealed
    event TicketAdded(uint32 leafIndex, uint256 leaf);
    event MergeWithdrawal(address indexed to, uint256 amount, uint256 nullHash1, uint256 nullHash2);

    constructor(
        address _hasherAddress,
        address _feedbackVerifierAddress,
        address _mergeWithdrawVerifierAddress,
        uint256 _denomination
    ) {
        feedbackVerifier = IFeedbackVerifier(_feedbackVerifierAddress);
        mergeWithdrawVerifier = IMergeWithdrawVerifier(_mergeWithdrawVerifierAddress);
        hasher = IHasher(_hasherAddress);
        denomination = _denomination;

        // Pre-compute zero hashes for each level
        zeros[0] = 0;
        for (uint8 i = 1; i < TREE_DEPTH; i++) {
            zeros[i] = hasher.poseidon([zeros[i - 1], zeros[i - 1]]);
        }

        // Insert dummy zero-note at index 0 for single-note withdrawals
        // leaf = poseidon(poseidon(0, 0), 0) — the "empty" note
        uint256 innerCommit = hasher.poseidon([uint256(0), uint256(0)]);
        uint256 dummyLeaf = hasher.poseidon([innerCommit, uint256(0)]);
        _insertLeaf(dummyLeaf);
    }

    // ─── Internal: insert a leaf into the incremental Merkle tree ────────────────
    function _insertLeaf(uint256 _leaf) internal returns (uint32) {
        require(globalNextLeafIndex < 2**TREE_DEPTH, "Tree is full!");

        uint32 currentIndex = globalNextLeafIndex;
        uint32 leafIndex = currentIndex;
        uint256 currentLevelHash = _leaf;
        uint256 left;
        uint256 right;

        for (uint8 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = zeros[i];
                globalFilledSubtrees[i] = currentLevelHash;
            } else {
                left = globalFilledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = hasher.poseidon([left, right]);
            currentIndex /= 2;
        }

        globalRoot = currentLevelHash;

        // Store root in history ring buffer
        currentRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        rootHistory[currentRootIndex] = globalRoot;

        globalNextLeafIndex += 1;
        emit TicketAdded(leafIndex, _leaf);
        return leafIndex;
    }

    // ─── Check if a root is recent (in the last 100 roots) ──────────────────────
    function isKnownRoot(uint256 _root) public view returns (bool) {
        if (_root == 0) return false;
        if (_root == globalRoot) return true;
        for (uint256 i = 0; i < ROOT_HISTORY_SIZE; i++) {
            if (rootHistory[i] == _root) return true;
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // RATING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice Adds a rating ticket to the global Merkle tree.
    /// @dev leaf = poseidon(innerCommitment, workerAddress). Called by Order at delivery conclusion.
    function addRatingTicket(address _worker, uint256 _innerCommitment) external {
        uint256 leaf = hasher.poseidon([_innerCommitment, uint256(uint160(_worker))]);
        _insertLeaf(leaf);

        // Track completed orders per worker (every 2 tickets = 1 completed order)
        workerTicketCount[_worker] += 1;
        if (workerTicketCount[_worker] % 2 == 0) {
            workers[_worker].completedOrders += 1;
        }
    }

    function submitRating(
        address _worker,
        uint256 _score,
        uint256 _nullifierHash,
        uint256 _root,
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c
    ) external {
        require(!usedNullifiers[_nullifierHash], "You have already rated this worker!");
        require(_score >= 1 && _score <= 5, "Score must be between 1 and 5");
        require(isKnownRoot(_root), "Root is not known");

        // Public signals: [nullifierHash, externalNullifier(=worker), signalHash(=score), root]
        uint[4] memory publicInputs = [_nullifierHash, uint256(uint160(_worker)), _score, _root];

        require(feedbackVerifier.verifyProof(a, b, c, publicInputs), "Invalid Zero Knowledge Proof");

        usedNullifiers[_nullifierHash] = true;

        WorkerStats storage stats = workers[_worker];
        stats.totalScore += _score;
        stats.totalRatings += 1;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PAYMENT FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice Deposits a payment note into the shared Merkle tree.
    /// @dev Called by Order at conclusion. leaf = poseidon(commitment, msg.value).
    ///      The amount is embedded in the leaf by the contract (not the caller).
    /// @param _commitment poseidon(nullifier, trapdoor) — the restaurant's secret commitment
    function depositPayment(uint256 _commitment) external payable {
        require(msg.value > 0, "Must deposit non-zero amount");
        uint256 leaf = hasher.poseidon([_commitment, msg.value]);
        _insertLeaf(leaf);
    }

    /// @notice Merge 2 notes and optionally withdraw the denomination amount.
    /// @dev Verifies a MergeWithdraw ZK proof. withdrawAmount must be 0 (pure merge) or denomination.
    /// @param _recipient Address to receive the withdrawn ETH
    /// @param _withdrawAmount 0 for pure merge, or denomination for withdrawal
    /// @param _nullHash1 Nullifier hash for note 1 (spent marker)
    /// @param _nullHash2 Nullifier hash for note 2 (spent marker)
    /// @param _changeCommitment Commitment for the change note (reinserted into tree)
    /// @param _root The Merkle root used in the proof (must be a recent root)
    /// @param a Groth16 proof component
    /// @param b Groth16 proof component
    /// @param c Groth16 proof component
    function mergeWithdraw(
        address payable _recipient,
        uint256 _withdrawAmount,
        uint256 _nullHash1,
        uint256 _nullHash2,
        uint256 _changeCommitment,
        uint256 _root,
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c
    ) external {
        // No denomination restriction — the ZK proof enforces amount1 + amount2 >= withdrawAmount
        require(!usedNullifiers[_nullHash1], "Note 1 already spent");
        require(!usedNullifiers[_nullHash2], "Note 2 already spent");
        require(_nullHash1 != _nullHash2, "Cannot use same note twice");
        require(isKnownRoot(_root), "Root is not known");

        // MergeWithdraw public signals order (circom 2.0):
        // outputs first: [nullifierHash1, nullifierHash2, changeCommitment]
        // then public inputs: [root, withdrawAmount, recipient]
        uint[6] memory publicInputs = [
            _nullHash1,
            _nullHash2,
            _changeCommitment,
            _root,
            _withdrawAmount,
            uint256(uint160(address(_recipient)))
        ];

        require(mergeWithdrawVerifier.verifyProof(a, b, c, publicInputs), "Invalid ZK proof");

        // Mark both notes as spent
        usedNullifiers[_nullHash1] = true;
        usedNullifiers[_nullHash2] = true;

        // Insert change note into tree (if change > 0, the commitment will be non-trivial)
        // We always insert the change commitment — if changeAmount is 0, it's a known
        // dummy leaf that can't be spent (nullifier would collide with the pre-inserted dummy)
        if (_changeCommitment != 0) {
            _insertLeaf(_changeCommitment);
        }

        // Transfer withdrawn amount to recipient
        if (_withdrawAmount > 0) {
            (bool success, ) = _recipient.call{value: _withdrawAmount}("");
            require(success, "ETH transfer failed");
            emit MergeWithdrawal(_recipient, _withdrawAmount, _nullHash1, _nullHash2);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    function getWorkerAverage(address _worker) external view returns (uint256) {
        if (workers[_worker].totalRatings == 0) return 0;
        return (workers[_worker].totalScore * 10) / workers[_worker].totalRatings;
    }

    function getWorkerStats(address _worker) external view returns (uint256, uint256, uint256) {
        WorkerStats storage stats = workers[_worker];
        uint256 avg = stats.totalRatings == 0 ? 0 : (stats.totalScore * 10) / stats.totalRatings;
        return (avg, stats.totalRatings, stats.completedOrders);
    }

    function getTreeInfo() external view returns (uint256 root, uint32 nextLeafIndex, uint256[25] memory filledSubtrees) {
        return (globalRoot, globalNextLeafIndex, globalFilledSubtrees);
    }

    function getDenomination() external view returns (uint256) {
        return denomination;
    }
}
