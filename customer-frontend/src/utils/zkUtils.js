/* global BigInt */
import { poseidon2 } from './poseidon';
import { DEPLOY_BLOCK, REPUTATION_ADDRESS, SEPOLIA_RPC_URL } from '../services/config';
import Web3 from 'web3';

const TREE_DEPTH = 25;

// Singleton read-only web3 instance for event queries (bypasses MetaMask RPC limits)
let _logWeb3;
function getLogWeb3() {
  if (!_logWeb3) {
    _logWeb3 = SEPOLIA_RPC_URL
      ? new Web3(new Web3.providers.HttpProvider(SEPOLIA_RPC_URL))
      : new Web3(window.ethereum);
  }
  return _logWeb3;
}

// TicketAdded(uint32 leafIndex, uint256 leaf) — topic hash
const TICKET_ADDED_TOPIC = '0x88800b36ccd95860e1fe41bd64893c29e92f1e9029bf1e400a2175a834813f98';

// Rebuild the Merkle path for a given leaf in the global rating tree.
// Fetches ALL TicketAdded events (no worker filter — the global tree is shared).
async function buildMerklePath(targetLeaf) {
  // 1. Precompute zero hashes for each level
  const zeros = [BigInt(0)];
  for (let i = 1; i < TREE_DEPTH; i++) {
    zeros.push(poseidon2([zeros[i - 1], zeros[i - 1]]));
  }

  // 2. Fetch ALL TicketAdded events using getPastLogs (works reliably with HttpProvider)
  const logWeb3 = getLogWeb3();
  const fromBlock = DEPLOY_BLOCK || 0;
  console.log('[ZK] Querying TicketAdded logs from block', fromBlock, 'on contract', REPUTATION_ADDRESS);
  const logs = await logWeb3.eth.getPastLogs({
    fromBlock,
    toBlock: 'latest',
    address: REPUTATION_ADDRESS,
    topics: [TICKET_ADDED_TOPIC],
  });
  console.log('[ZK] Found', logs.length, 'TicketAdded logs');

  // 3. Decode logs and build allLeaves array
  var logWeb3Decode = logWeb3;
  // The dummy zero-note at index 0 may not appear in events (constructor event)
  var innerCommitDummy = poseidon2([0n, 0n]);
  var dummyLeaf = poseidon2([innerCommitDummy, 0n]);
  var allLeaves = [dummyLeaf]; // index 0 = dummy note

  for (var li = 0; li < logs.length; li++) {
    var logData = logs[li].data;
    var leafIdx = parseInt(logData.slice(0, 66), 16);
    var leafVal = BigInt('0x' + logData.slice(66, 130));
    while (allLeaves.length <= leafIdx) {
      allLeaves.push(0n);
    }
    allLeaves[leafIdx] = leafVal;
  }

  console.log('[ZK] Looking for targetLeaf:', targetLeaf.toString());
  console.log('[ZK] allLeaves count:', allLeaves.length);
  var leafIndex = allLeaves.findIndex(function(l) { return l === targetLeaf; });
  if (leafIndex === -1) throw new Error('Your rating ticket was not found in the global tree. Leaves: ' + allLeaves.length + ', targetLeaf: ' + targetLeaf.toString());

  // 4. Build incremental Merkle tree (matching contract's _insertLeaf algorithm)
  var filledSubtrees = [];
  for (var z = 0; z < TREE_DEPTH; z++) {
    filledSubtrees[z] = zeros[z];
  }
  var layers = [];
  for (var ll = 0; ll < TREE_DEPTH + 1; ll++) {
    layers.push({});
  }

  for (var ins = 0; ins < allLeaves.length; ins++) {
    var currentIndex = ins;
    var currentLevelHash = allLeaves[ins];
    layers[0][ins] = currentLevelHash;

    for (var lv = 0; lv < TREE_DEPTH; lv++) {
      var left, right;
      if (currentIndex % 2 === 0) {
        left = currentLevelHash;
        right = zeros[lv];
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

  // Extract proof path
  var pathIndices = [];
  var siblings = [];
  var idx = leafIndex;

  for (var plv = 0; plv < TREE_DEPTH; plv++) {
    var isRight = idx % 2;
    pathIndices.push(isRight);
    var siblingIdx = isRight ? idx - 1 : idx + 1;
    if (layers[plv][siblingIdx] !== undefined) {
      siblings.push(layers[plv][siblingIdx]);
    } else {
      siblings.push(zeros[plv]);
    }
    idx = Math.floor(idx / 2);
  }

  // Root is the last computed node at top level
  var root = layers[TREE_DEPTH][0] || zeros[TREE_DEPTH];
  console.log('[ZK] Computed root:', root.toString());
  return { pathIndices, siblings, root };
}

// Generate a ZK proof for an anonymous rating.
// Returns { proof, nullifierHash } ready for submitRating().
export async function generateRatingProof(web3, reputationContract, workerAddress, score, orderId) {

  // Load stored secrets for this order
  const orderSecrets = JSON.parse(localStorage.getItem('orderSecrets') || '{}');
  const secrets = orderSecrets[orderId];
  if (!secrets) throw new Error('Rating secrets not found — was the order placed from this browser?');

  const nullifier = BigInt(secrets.nullifier);
  const trapdoor = BigInt(secrets.trapdoor);

  // Compute the worker-bound leaf: poseidon(poseidon(nullifier, trapdoor), workerAddress)
  // This matches what the contract computes in addRatingTicket()
  const innerCommitment = poseidon2([nullifier, trapdoor]);
  const externalNullifier = BigInt(workerAddress);
  const targetLeaf = poseidon2([innerCommitment, externalNullifier]);
  console.log('[ZK] innerCommitment:', innerCommitment.toString());
  console.log('[ZK] workerAddress:', workerAddress, '→ BigInt:', externalNullifier.toString());
  console.log('[ZK] targetLeaf:', targetLeaf.toString());

  const { pathIndices, siblings, root } = await buildMerklePath(targetLeaf);

  const signalHash = BigInt(score);

  const circuitInput = {
    identityNullifier: nullifier.toString(),
    identityTrapdoor: trapdoor.toString(),
    treePathIndices: pathIndices.map(String),
    treeSiblings: siblings.map(String),
    root: root.toString(),
    externalNullifier: externalNullifier.toString(),
    signalHash: signalHash.toString(),
  };

  const wasmPath = '/circuits/feedback.wasm';
  const zkeyPath = '/circuits/feedback_0001.zkey';

  const { groth16 } = window.snarkjs;
  const { proof, publicSignals } = await groth16.fullProve(circuitInput, wasmPath, zkeyPath);

  // publicSignals order (circom 2.0): [nullifierHash(output), externalNullifier, signalHash, root]
  const nullifierHash = publicSignals[0];
  // Format proof for Solidity (pi_b coordinates are reversed per EIP-197)
  const a = [proof.pi_a[0], proof.pi_a[1]];
  const b = [
    [proof.pi_b[0][1], proof.pi_b[0][0]],
    [proof.pi_b[1][1], proof.pi_b[1][0]],
  ];
  const c = [proof.pi_c[0], proof.pi_c[1]];

  return { a, b, c, nullifierHash, root: root.toString() };
}
