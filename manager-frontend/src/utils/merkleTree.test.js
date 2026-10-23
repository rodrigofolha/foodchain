/* global BigInt */
import { poseidon2 } from './poseidon';
import {
  computeZeros, buildLayers, getRoot, getMerklePath, buildMerklePath,
  computeRootFromPath, decodeLeafLog, orderLeaves,
} from './merkleTree';

// ─── Independent references ──────────────────────────────────────────────────

// The contract's incremental insertion (GlobalReputation._insertNote / _insertTicket),
// replayed leaf by leaf with filledSubtrees. Returns the root after the last insertion.
function contractRoot(leaves, depth) {
  var zeros = [0n];
  for (var z = 1; z < depth; z++) zeros.push(poseidon2([zeros[z - 1], zeros[z - 1]]));
  var filledSubtrees = [];
  var root;
  leaves.forEach(function(leaf, leafIndex) {
    var currentIndex = leafIndex;
    var hash = leaf;
    for (var i = 0; i < depth; i++) {
      var left, right;
      if (currentIndex % 2 === 0) {
        left = hash;
        right = zeros[i];
        filledSubtrees[i] = hash;
      } else {
        left = filledSubtrees[i];
        right = hash;
      }
      hash = poseidon2([left, right]);
      currentIndex = Math.floor(currentIndex / 2);
    }
    root = hash;
  });
  return root;
}

// Hashes every node of a full tree of 2^depth leaves (small depths only).
function fullTreeRoot(leaves, depth) {
  var level = [];
  for (var i = 0; i < Math.pow(2, depth); i++) level.push(i < leaves.length ? leaves[i] : 0n);
  while (level.length > 1) {
    var next = [];
    for (var j = 0; j < level.length; j += 2) next.push(poseidon2([level[j], level[j + 1]]));
    level = next;
  }
  return level[0];
}

function sampleLeaves(n) {
  var leaves = [];
  for (var i = 0; i < n; i++) leaves.push(poseidon2([BigInt(7000 + i), BigInt(i + 1)]));
  return leaves;
}

// ─── Values computed by the Solidity contract (GlobalReputation on a local Hardhat network) ───

const CONTRACT = {
  zeros15: 15819538789928229930262697811477882737253464456578333862691129291651619515538n,
  zeros24: 17681057402012993898104192736393849603097507831571622013521167331642182653248n,
  // Note tree (depth 25): dummy note only, then depositPayment(1001 + i) with msg.value = 1 + i wei
  noteRootDummyOnly: 9889387287440051306214462986816368679898876904232821343646926637201194623049n,
  noteRootAfter3Deposits: 14957698974447541622881999881993737518606273179881028968171099938023710167319n,
  noteRootAfter5Deposits: 148132381245348058048969655604399750072966339057081308181701626603335343833n,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('computeZeros', () => {
  it('matches the known Poseidon zero hashes and the contract zeros()', () => {
    const zeros = computeZeros(25);
    expect(zeros).toHaveLength(26);
    expect(zeros[0]).toBe(0n);
    expect(zeros[1]).toBe(14744269619966411208579211824598458697587494354926760081771325075741142829156n);
    expect(zeros[15]).toBe(CONTRACT.zeros15);
    expect(zeros[24]).toBe(CONTRACT.zeros24);
  });
});

describe('tree root', () => {
  it('matches a replay of the contract insertions (depth 16)', () => {
    [1, 2, 3, 5, 8, 13].forEach((n) => {
      const leaves = sampleLeaves(n);
      const zeros = computeZeros(16);
      expect(getRoot(buildLayers(leaves, 16, zeros), 16, zeros)).toBe(contractRoot(leaves, 16));
    });
  });

  it('matches a full-tree hash (depth 4, every leaf count)', () => {
    for (let n = 1; n <= 16; n++) {
      const leaves = sampleLeaves(n);
      expect(buildMerklePath(leaves, 0, 4).root).toBe(fullTreeRoot(leaves, 4));
    }
  });

  it('is zeros[depth] for an empty tree', () => {
    const zeros = computeZeros(16);
    expect(getRoot(buildLayers([], 16, zeros), 16, zeros)).toBe(zeros[16]);
  });

  it('matches the note-tree roots computed by the contract', () => {
    const dummy = poseidon2([poseidon2([0n, 0n]), 0n]);
    const leaves = [dummy];
    expect(buildMerklePath(leaves, 0, 25).root).toBe(CONTRACT.noteRootDummyOnly);
    for (let i = 0; i < 5; i++) leaves.push(poseidon2([1001n + BigInt(i), 1n + BigInt(i)]));
    expect(buildMerklePath(leaves.slice(0, 4), 0, 25).root).toBe(CONTRACT.noteRootAfter3Deposits);
    expect(buildMerklePath(leaves, 0, 25).root).toBe(CONTRACT.noteRootAfter5Deposits);
  });

  it('rejects more leaves than the depth allows', () => {
    expect(() => buildLayers(sampleLeaves(5), 2)).toThrow(/Too many leaves/);
  });
});

describe('getMerklePath', () => {
  it('gives every leaf a path that reaches the root, as MerkleTreeChecker computes it', () => {
    const leaves = sampleLeaves(13);
    const zeros = computeZeros(16);
    const layers = buildLayers(leaves, 16, zeros);
    const root = getRoot(layers, 16, zeros);
    leaves.forEach((leaf, index) => {
      const { pathIndices, siblings } = getMerklePath(layers, index, 16, zeros);
      expect(pathIndices).toHaveLength(16);
      expect(siblings).toHaveLength(16);
      // pathIndices are the bits of the leaf index, lowest level first
      expect(pathIndices.map(String).reverse().join('')).toBe(index.toString(2).padStart(16, '0'));
      expect(computeRootFromPath(leaf, pathIndices, siblings)).toBe(root);
    });
  });

  it('uses empty-subtree hashes above the filled part of the tree', () => {
    const leaves = sampleLeaves(3);
    const zeros = computeZeros(16);
    const { siblings } = getMerklePath(buildLayers(leaves, 16, zeros), 2, 16, zeros);
    expect(siblings[0]).toBe(0n); // index 3 is empty
    expect(siblings[1]).toBe(poseidon2([leaves[0], leaves[1]]));
    for (let level = 2; level < 16; level++) expect(siblings[level]).toBe(zeros[level]);
  });

  it('gives a different root when a sibling or the leaf changes', () => {
    const leaves = sampleLeaves(6);
    const { pathIndices, siblings, root } = buildMerklePath(leaves, 4, 16);
    const tampered = siblings.slice();
    tampered[1] = tampered[1] + 1n;
    expect(computeRootFromPath(leaves[4], pathIndices, tampered)).not.toBe(root);
    expect(computeRootFromPath(leaves[5], pathIndices, siblings)).not.toBe(root);
  });

  it('rejects an index outside the tree', () => {
    expect(() => buildMerklePath(sampleLeaves(3), 3, 16)).toThrow(/outside the tree/);
  });
});

describe('decodeLeafLog / orderLeaves', () => {
  const pad = (v) => BigInt(v).toString(16).padStart(64, '0');

  it('decodes abi.encode(uint32 leafIndex, uint256 leaf)', () => {
    const leaf = poseidon2([1n, 2n]);
    expect(decodeLeafLog('0x' + pad(7) + pad(leaf))).toEqual({ leafIndex: 7, leaf });
  });

  it('orders leaves by index and keeps known leaves', () => {
    const entries = [{ leafIndex: 2, leaf: 22n }, { leafIndex: 1, leaf: 11n }];
    expect(orderLeaves(entries, [5n])).toEqual([5n, 11n, 22n]);
    expect(orderLeaves([{ leafIndex: 0, leaf: 3n }])).toEqual([3n]);
    expect(orderLeaves([])).toEqual([]);
  });

  it('throws when an index is missing', () => {
    expect(() => orderLeaves([{ leafIndex: 0, leaf: 1n }, { leafIndex: 2, leaf: 3n }])).toThrow(/Leaf 1 of 3 is missing/);
    expect(() => orderLeaves([{ leafIndex: 1, leaf: 1n }])).toThrow(/Leaf 0 of 2 is missing/);
  });
});
