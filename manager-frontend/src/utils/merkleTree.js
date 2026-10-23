/* global BigInt */
/**
 * Incremental Poseidon Merkle tree helpers (pure: no network, no storage).
 *
 * They rebuild, from its leaves, the tree kept by GlobalReputation (contracts/Reputation.sol):
 * the note tree of the payment pool (depth 25, NoteAdded events). The contracts keep no
 * other tree: ratings are given in the clear through the order.
 *
 * Empty leaves are 0 and zeros[i] = poseidon(zeros[i - 1], zeros[i - 1]), as in the contract,
 * so the root of the leaves [l0, ..., ln-1] is the root the contract had after inserting them
 * in that order.
 */
import { poseidon2 } from './poseidon';

/**
 * Hash of an empty subtree at each level: zeros[0] = 0 (empty leaf) up to zeros[depth]
 * (root of an empty tree).
 */
export function computeZeros(depth) {
  var zeros = [0n];
  for (var i = 1; i <= depth; i++) {
    zeros.push(poseidon2([zeros[i - 1], zeros[i - 1]]));
  }
  return zeros;
}

/**
 * Hash the tree level by level, keeping only the non-empty nodes:
 * layers[level] holds ceil(n / 2^level) nodes, and any node past the end is zeros[level].
 * Costs about n hashes (instead of n * depth when replaying the contract's insertions).
 */
export function buildLayers(leaves, depth, zeros) {
  if (leaves.length > Math.pow(2, depth)) {
    throw new Error('Too many leaves (' + leaves.length + ') for a tree of depth ' + depth);
  }
  zeros = zeros || computeZeros(depth);
  var layers = [leaves.map(function(l) { return BigInt(l); })];
  for (var level = 0; level < depth; level++) {
    var nodes = layers[level];
    var parents = [];
    for (var i = 0; i < nodes.length; i += 2) {
      var right = i + 1 < nodes.length ? nodes[i + 1] : zeros[level];
      parents.push(poseidon2([nodes[i], right]));
    }
    layers.push(parents);
  }
  return layers;
}

/**
 * Root of the tree described by layers (zeros[depth] when the tree is empty).
 */
export function getRoot(layers, depth, zeros) {
  return layers[depth].length > 0 ? layers[depth][0] : zeros[depth];
}

/**
 * Merkle path of the leaf at leafIndex, in the circuits' format (MerkleTreeChecker):
 * pathIndices[i] = 1 when the node at level i is a right child, siblings[i] = the other child.
 */
export function getMerklePath(layers, leafIndex, depth, zeros) {
  if (leafIndex < 0 || leafIndex >= layers[0].length) {
    throw new Error('Leaf index ' + leafIndex + ' is outside the tree (' + layers[0].length + ' leaves)');
  }
  var pathIndices = [];
  var siblings = [];
  var idx = leafIndex;
  for (var level = 0; level < depth; level++) {
    var isRight = idx % 2;
    var siblingIdx = isRight ? idx - 1 : idx + 1;
    pathIndices.push(isRight);
    siblings.push(siblingIdx < layers[level].length ? layers[level][siblingIdx] : zeros[level]);
    idx = Math.floor(idx / 2);
  }
  return { pathIndices: pathIndices, siblings: siblings };
}

/**
 * Builds the tree from its leaves and returns the path of one leaf plus the root.
 */
export function buildMerklePath(leaves, leafIndex, depth) {
  var zeros = computeZeros(depth);
  var layers = buildLayers(leaves, depth, zeros);
  var path = getMerklePath(layers, leafIndex, depth, zeros);
  return { pathIndices: path.pathIndices, siblings: path.siblings, root: getRoot(layers, depth, zeros) };
}

/**
 * Root reached from a leaf and its path, exactly as the circuits' MerkleTreeChecker computes it.
 */
export function computeRootFromPath(leaf, pathIndices, siblings) {
  var node = BigInt(leaf);
  for (var i = 0; i < pathIndices.length; i++) {
    node = Number(pathIndices[i]) === 1
      ? poseidon2([BigInt(siblings[i]), node])
      : poseidon2([node, BigInt(siblings[i])]);
  }
  return node;
}

/**
 * Decodes the data of a NoteAdded log: abi.encode(uint32 leafIndex, uint256 leaf).
 */
export function decodeLeafLog(data) {
  var hex = data.slice(0, 2) === '0x' ? data.slice(2) : data;
  return {
    leafIndex: parseInt(hex.slice(0, 64), 16),
    leaf: BigInt('0x' + hex.slice(64, 128)),
  };
}

/**
 * Puts decoded { leafIndex, leaf } entries in tree order. knownLeaves pre-fills leaves that may
 * have no log in the queried range (the note tree's dummy note at index 0 is inserted by the
 * constructor, before DEPLOY_BLOCK). Throws when an index is missing, because a tree with a
 * hole would give a root the contract never had.
 */
export function orderLeaves(entries, knownLeaves) {
  var leaves = (knownLeaves || []).map(function(l) { return BigInt(l); });
  for (var i = 0; i < entries.length; i++) {
    leaves[entries[i].leafIndex] = BigInt(entries[i].leaf);
  }
  for (var j = 0; j < leaves.length; j++) {
    if (leaves[j] === undefined) {
      throw new Error('Leaf ' + j + ' of ' + leaves.length + ' is missing from the events (the RPC may have returned partial logs). Please try again.');
    }
  }
  return leaves;
}
