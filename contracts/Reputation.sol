// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

interface IMergeWithdrawVerifier {
    function verifyProof(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[6] memory input) external view returns (bool);
}

// Interface for the circomlibjs-generated Poseidon hasher
interface IHasher {
    function poseidon(uint256[2] memory input) external pure returns (uint256);
}

// Implemented by Chain: true only for Order contracts that Chain created
interface IOrderRegistry {
    function isOrder(address account) external view returns (bool);
}

/// @notice Reputation record of the delivery workers and zero-knowledge payment pool.
///         - Ratings are given in the clear, through the rated order (Chain.rateOrder -> Order.rateOrder).
///           An order reports the worker who delivered it and each worker who left it; this contract
///           decides from those reports who may rate whom, and keeps each worker's totals.
///         - One global note tree for the payment pool (one anonymity set shared by all establishments).
contract GlobalReputation {
    IHasher public hasher;
    IMergeWithdrawVerifier public mergeWithdrawVerifier;

    uint8 public constant NOTE_TREE_DEPTH = 25;      // 33,554,432 notes, shared by all establishments
    uint256 public constant MAX_AMOUNT = 2**128;     // amounts are range-checked below 2^128 in the circuit

    // Hashes of empty nodes at each level: zeros[0] = 0, zeros[i] = poseidon(zeros[i-1], zeros[i-1]).
    // 25 words kept in the code instead of 25 storage slots (computed with circomlibjs by the build
    // script). The constructor checks every word against the hasher, so a wrong table cannot be deployed.
    bytes private constant ZEROS = hex"00000000000000000000000000000000000000000000000000000000000000002098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b648641069673dcdb12263df301a6ff584a7ec261a44cb9dc68df067a4774460b1f1e118f43331537ee2af2e3d758d50f72106467c6eea50371dd528d57eb2b856d23807f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f552dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d2fa5e5f18f6027a6501bec864564472a616b2e274a41211a444cbe3a99f3cc610e884376d0d8fd21ecb780389e941f66e45e7acce3e228ab3e2156a614fcd7471b7201da72494f1e28717ad1a52eb469f95892f957713533de6175e5da190af21f8d8822725e36385200c0b201249819a6e6e1e4650808b5bebc6bface7d76362c5d82f66c914bafb9701589ba8cfcfb6162b0a12acf88a8d0879a0471b5f85a14c54148a0940bb820957f5adf3fa1134ef5c4aaa113f4646458f270e0bfbfd0190d33b12f986f961e10c0ee44d8b9af11be25588cad89d416118e4bf4ebe80c22f98aa9ce704152ac17354914ad73ed1167ae6596af510aa5b3649325e06c922a7c7c9b6ce5880b9f6f228d72bf6a575a526f29c66ecceef8b753d38bba73232e8186e558698ec1c67af9c14d463ffc470043c9c2988b954d75dd643f36b9920f57c5571e9a4eab49e2c8cf050dae948aef6ead647392273546249d1c1ff10f1830ee67b5fb554ad5f63d4388800e1cfe78e310697d46e43c9ce36134f72cca2134e76ac5d21aab186c2be1dd8f84ee880a1e46eaf712f9d371b6df22191f3e19df90ec844ebc4ffeebd866f33859b0c051d8c958ee3aa88f8f8df3db91a5b118cca2a66b5c0787981e69aefd84852d74af0e93ef4912b4648c05f722efe52b2388909415230d1b4d1304d2d54f473a628338f2efad83fadf05644549d2538d27171fb4a97b6cc0e9e8f543b5294de866a2af2c9c8d0b1d96e673e4529ed540";

    // Same getter as the former `uint256[25] public zeros` (declared view, although it reads no
    // storage, so that the ABI is unchanged)
    function zeros(uint256 i) public view returns (uint256 z) {
        require(i < NOTE_TREE_DEPTH);
        z = _zeroAt(ZEROS, i);
    }

    function _zeroAt(bytes memory table, uint256 i) private pure returns (uint256 z) {
        assembly {
            z := mload(add(add(table, 32), mul(i, 32)))
        }
    }

    // Every root the tree has ever had stays valid. A proof against an older root still
    // proves membership (leaves are never removed), and the nullifier stops double spending.
    // A lookup costs the same whatever the root's age, so a proof that waits in a congested
    // mempool does not expire.

    // --- Note tree (payment pool) ---
    uint256 public noteRoot;
    uint32 public noteNextIndex;
    uint256[25] private noteFilledSubtrees;
    mapping(uint256 => bool) private knownNoteRoots;

    // --- Payment pool ---
    uint256 public denomination; // kept for interface compatibility; withdrawals are not restricted to it

    // One storage slot per worker
    struct WorkerStats {
        uint64 totalScore;
        uint48 totalRatings;        // all ratings, also the ones received after leaving an order
        uint48 completedOrders;
        uint48 leftOrders;          // times the worker left an order (withdrawal, timeout, replacement, contested delivery)
        uint48 ratingsAfterLeaving; // ratings received for an order the worker left
    }

    mapping(address => WorkerStats) public workers;

    // What an order reported about one of its workers, and the scores that worker got on it
    // (0 = not rated yet). One slot per order and worker.
    uint8 public constant LEFT_BEFORE_PICKUP = 1; // only the establishment may rate
    uint8 public constant LEFT_AFTER_PICKUP = 2;  // the customer and the establishment may rate
    uint8 public constant DELIVERED = 3;          // the customer and the establishment may rate
    struct OrderRatings {
        uint8 outcome; // 0 = nothing reported: the worker cannot be rated on this order
        uint8 byClient;
        uint8 byEstablishment;
    }
    mapping(address => mapping(address => OrderRatings)) public orderRatings; // order => worker

    mapping(uint256 => bool) public spentNoteNullifiers; // payment notes

    // Nullifier hash of the zero-value dummy note at note index 0. Reusing it adds no value,
    // so it is never marked as spent and any single-note withdrawal can pair with it.
    uint256 public immutable dummyNoteNullifierHash;

    // --- Access control ---
    address public immutable owner;
    address public chain; // set once, after Chain is deployed

    event OrderRated(address indexed worker, address indexed order, bool byClient, uint256 score, bool afterLeaving);
    event NoteAdded(uint32 leafIndex, uint256 leaf);
    event MergeWithdrawal(address indexed to, uint256 amount, uint256 nullHash1, uint256 nullHash2);

    constructor(
        address _hasherAddress,
        address _mergeWithdrawVerifierAddress,
        uint256 _denomination
    ) {
        mergeWithdrawVerifier = IMergeWithdrawVerifier(_mergeWithdrawVerifierAddress);
        hasher = IHasher(_hasherAddress);
        denomination = _denomination;
        owner = msg.sender;

        // Check the zero-hash constants against the hasher
        uint256 zero = 0;
        require(zeros(0) == 0, "Wrong zero-hash constant");
        for (uint8 i = 1; i < NOTE_TREE_DEPTH; i++) {
            zero = hasher.poseidon([zero, zero]);
            require(zero == zeros(i), "Wrong zero-hash constant");
        }

        // Insert the zero-value dummy note at index 0 for single-note withdrawals
        // leaf = poseidon(poseidon(0, 0), 0)
        uint256 innerCommit = hasher.poseidon([uint256(0), uint256(0)]);
        _insertNote(hasher.poseidon([innerCommit, uint256(0)]));
        // payment nullifier hash = poseidon(amount, nullifier) = poseidon(0, 0)
        dummyNoteNullifierHash = innerCommit;
    }

    /// @notice Links this contract to the Chain that creates orders. Callable once, by the deployer.
    function setChain(address _chain) external {
        require(msg.sender == owner, "Only owner");
        require(chain == address(0), "Chain already set");
        require(_chain != address(0), "Invalid chain");
        chain = _chain;
    }

    modifier onlyOrder() {
        require(chain != address(0) && IOrderRegistry(chain).isOrder(msg.sender), "Only orders created by Chain");
        _;
    }

    // ─── Internal: insert a leaf into the note tree ──────────────────────────────
    function _insertNote(uint256 _leaf) internal returns (uint32) {
        require(noteNextIndex < 2**NOTE_TREE_DEPTH, "Note tree is full");

        uint32 leafIndex = noteNextIndex;
        uint32 currentIndex = leafIndex;
        uint256 currentLevelHash = _leaf;
        uint256 left;
        uint256 right;

        // One noteFilledSubtrees write per insertion. A slot is read only by an insertion that is
        // a right child at that level, and the last write before such a read comes from the
        // insertion that completed the subtree to its left: the one whose lower index bits are
        // all 1, for which that level is its lowest left-child level. Every other write would be
        // overwritten before it is read, so only the lowest left-child level is stored. The roots
        // and every value that is ever read are unchanged; slots that are not read keep older values.
        bool stored = false;
        bytes memory zeroTable = ZEROS; // copied from the code once per insertion
        for (uint8 i = 0; i < NOTE_TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = _zeroAt(zeroTable, i);
                if (!stored) {
                    noteFilledSubtrees[i] = currentLevelHash;
                    stored = true;
                }
            } else {
                left = noteFilledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = hasher.poseidon([left, right]);
            currentIndex /= 2;
        }

        noteRoot = currentLevelHash;
        knownNoteRoots[currentLevelHash] = true;

        noteNextIndex = leafIndex + 1;
        emit NoteAdded(leafIndex, _leaf);
        return leafIndex;
    }

    // ─── Root checks ─────────────────────────────────────────────────────────────
    function isKnownNoteRoot(uint256 _root) public view returns (bool) {
        return _root != 0 && knownNoteRoots[_root];
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // RATING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice Counts one concluded delivery for the worker, who can then be rated on the calling order.
    /// @dev Only an Order created by Chain can call it, at delivery conclusion.
    function addCompletedOrder(address _worker) external onlyOrder {
        workers[_worker].completedOrders += 1;
        orderRatings[msg.sender][_worker].outcome = DELIVERED;
    }

    /// @notice Counts that the worker left the calling order, and lets the worker be rated on it:
    ///         by the establishment only if they left before pickup, by the customer too after pickup.
    /// @dev Only an Order created by Chain can call it: at the worker's own withdrawal or cancellation,
    ///      at a timeout charged to them, at their replacement, at a contested delivery decided against them.
    function addLeaving(address _worker, bool _afterPickup) external onlyOrder {
        workers[_worker].leftOrders += 1;
        OrderRatings storage given = orderRatings[msg.sender][_worker];
        // The same account can commit twice to one order: the later, wider outcome is kept
        uint8 outcome = _afterPickup ? LEFT_AFTER_PICKUP : LEFT_BEFORE_PICKUP;
        if (outcome > given.outcome) given.outcome = outcome;
    }

    /// @notice Adds one score to the worker's record: the rating, on the calling order, by its customer
    ///         (_byClient) or by its establishment. Each of the two rates a worker of an order once.
    /// @dev Only an Order created by Chain can call it. The order says whether the rater is its customer
    ///      (_byClient), its establishment (_byEstablishment) or neither (refused); an account that is
    ///      both rates as the customer. Whether that worker can be rated comes from what the order
    ///      reported before (addCompletedOrder, addLeaving).
    function addRating(address _worker, uint256 _score, bool _byClient, bool _byEstablishment) external onlyOrder {
        require(_byClient || _byEstablishment, "This caller is unauthorized");
        require(_score >= 1 && _score <= 5, "Score must be between 1 and 5");

        OrderRatings storage given = orderRatings[msg.sender][_worker];
        uint8 outcome = given.outcome;
        require(outcome != 0, "This worker cannot be rated on this order");
        require(!_byClient || outcome != LEFT_BEFORE_PICKUP, "Only the establishment rates a worker who left before pickup");
        if (_byClient) {
            require(given.byClient == 0, "Already rated");
            given.byClient = uint8(_score);
        } else {
            require(given.byEstablishment == 0, "Already rated");
            given.byEstablishment = uint8(_score);
        }

        WorkerStats storage stats = workers[_worker];
        stats.totalScore += uint64(_score);
        stats.totalRatings += 1;
        if (outcome != DELIVERED) stats.ratingsAfterLeaving += 1;
        emit OrderRated(_worker, msg.sender, _byClient, _score, outcome != DELIVERED);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PAYMENT FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice Deposits a payment note into the note tree.
    /// @dev Called by Order at conclusion, or directly by an establishment to fund the pool.
    ///      leaf = poseidon(commitment, msg.value). The amount is embedded in the leaf by the
    ///      contract (not the caller).
    /// @param _commitment poseidon(nullifier, trapdoor) — the restaurant's secret commitment
    function depositPayment(uint256 _commitment) external payable {
        require(msg.value > 0, "Must deposit non-zero amount");
        require(msg.value < MAX_AMOUNT, "Amount too large");
        _insertNote(hasher.poseidon([_commitment, msg.value]));
    }

    /// @notice Merges up to 2 notes, pays out withdrawAmount and re-inserts a change note.
    /// @param _recipient Address to receive the withdrawn ETH
    /// @param _withdrawAmount Amount to pay out (0 for a pure merge)
    /// @param _nullHash1 Nullifier hash for note 1 (spent marker)
    /// @param _nullHash2 Nullifier hash for note 2 (spent marker, or the dummy note's)
    /// @param _changeCommitment Leaf of the change note (reinserted into the note tree)
    /// @param _root The note-tree root used in the proof (must be a recent root)
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
        // No denomination restriction — the ZK proof enforces amount1 + amount2 >= withdrawAmount,
        // with every amount range-checked below 2^128 inside the circuit
        require(_withdrawAmount < MAX_AMOUNT, "Amount too large");
        require(_nullHash1 != _nullHash2, "Cannot use same note twice");
        require(_nullHash1 == dummyNoteNullifierHash || !spentNoteNullifiers[_nullHash1], "Note 1 already spent");
        require(_nullHash2 == dummyNoteNullifierHash || !spentNoteNullifiers[_nullHash2], "Note 2 already spent");
        require(isKnownNoteRoot(_root), "Root is not known");

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

        // Mark the real notes as spent (the zero-value dummy stays reusable)
        if (_nullHash1 != dummyNoteNullifierHash) spentNoteNullifiers[_nullHash1] = true;
        if (_nullHash2 != dummyNoteNullifierHash) spentNoteNullifiers[_nullHash2] = true;

        // Insert the change note into the note tree
        if (_changeCommitment != 0) {
            _insertNote(_changeCommitment);
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

    /// @notice Reverts if the worker is below an order's minimums (0 = no minimum). Called by the
    ///         Order in confirmIntention. _minReputation uses the x10 scale of getWorkerStats.
    function requireQualified(address _worker, uint256 _minReputation, uint256 _minOrders) external view {
        WorkerStats storage stats = workers[_worker];
        if (_minReputation > 0) {
            require(stats.totalRatings > 0, "Deliveryman has no ratings yet");
            require((uint256(stats.totalScore) * 10) / stats.totalRatings >= _minReputation, "Deliveryman reputation below minimum required");
        }
        if (_minOrders > 0) {
            require(stats.completedOrders >= _minOrders, "Deliveryman does not have enough completed orders");
        }
    }

    function getWorkerAverage(address _worker) external view returns (uint256) {
        if (workers[_worker].totalRatings == 0) return 0;
        return (uint256(workers[_worker].totalScore) * 10) / workers[_worker].totalRatings;
    }

    function getWorkerStats(address _worker) external view returns (uint256, uint256, uint256) {
        WorkerStats storage stats = workers[_worker];
        uint256 avg = stats.totalRatings == 0 ? 0 : (uint256(stats.totalScore) * 10) / stats.totalRatings;
        return (avg, stats.totalRatings, stats.completedOrders);
    }

    function getNoteTreeInfo() external view returns (uint256 root, uint32 nextLeafIndex) {
        return (noteRoot, noteNextIndex);
    }

    function getDenomination() external view returns (uint256) {
        return denomination;
    }
}
