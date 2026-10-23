/* global BigInt */
import { keccak256 } from 'web3-utils';
import { poseidon2 } from './poseidon';
import { buildLayers, computeZeros, getRoot, computeRootFromPath } from './merkleTree';
import {
  NOTE_TREE_DEPTH, NOTE_ADDED_TOPIC,
  computePaymentCommitment, computePaymentLeaf, computeNullifierHash, computeNoteLeaf,
  findNoteIndex, getNotePath, findNoteLeafIndex, getDummyNote, selectWithdrawalNotes,
  storePaymentNote, getUnspentNotes, syncSpentNotes, claimRevenueNote, getPaymentNotes,
} from './zkWithdraw';
import { paymentCommitmentFor, ordersWithUnclaimedNote } from './paymentSecrets';
import { deploymentKey } from './deploymentStorage';

const pad = (v) => BigInt(v).toString(16).padStart(64, '0');
const noteAddedLog = (leafIndex, leaf) => ({ topics: [NOTE_ADDED_TOPIC], data: '0x' + pad(leafIndex) + pad(leaf) });
const note = (nullifier, trapdoor, amount, leafIndex) => ({
  nullifier: String(nullifier), trapdoor: String(trapdoor), amount: String(amount), leafIndex: leafIndex,
  commitment: computePaymentCommitment(nullifier, trapdoor).toString(),
});

function treeStateOf(leaves) {
  const zeros = computeZeros(NOTE_TREE_DEPTH);
  const layers = buildLayers(leaves, NOTE_TREE_DEPTH, zeros);
  return { allLeaves: leaves, layers: layers, zeros: zeros, root: getRoot(layers, NOTE_TREE_DEPTH, zeros) };
}

describe('note formulas', () => {
  it('uses the NoteAdded(uint32,uint256) topic', () => {
    expect(NOTE_ADDED_TOPIC).toBe(keccak256('NoteAdded(uint32,uint256)'));
  });

  it('hashes leaf = poseidon(commitment, amount) and nullifier hash = poseidon(amount, nullifier)', () => {
    expect(computePaymentLeaf(5n, 1000n)).toBe(poseidon2([5n, 1000n]));
    expect(computeNullifierHash(1000n, 9n)).toBe(poseidon2([1000n, 9n]));
    expect(computeNoteLeaf(note(1, 2, 3))).toBe(poseidon2([poseidon2([1n, 2n]), 3n]));
  });

  it('matches the dummy note of the contract', () => {
    // leaf poseidon(poseidon(0,0), 0) at index 0; dummyNoteNullifierHash = poseidon(0, 0)
    expect(computeNoteLeaf(getDummyNote())).toBe(poseidon2([poseidon2([0n, 0n]), 0n]));
    expect(computeNullifierHash(0n, 0n)).toBe(14744269619966411208579211824598458697587494354926760081771325075741142829156n);
    expect(getDummyNote().leafIndex).toBe(0);
  });
});

describe('locating notes in the note tree', () => {
  const real = note(11, 12, 5000, 2);
  const leaves = [computeNoteLeaf(getDummyNote()), poseidon2([77n, 1n]), computeNoteLeaf(real), poseidon2([78n, 2n])];

  it('uses the stored leafIndex, or finds the note by its leaf', () => {
    expect(findNoteIndex(real, leaves)).toBe(2);
    expect(findNoteIndex(Object.assign({}, real, { leafIndex: 0 }), leaves)).toBe(2);
    expect(findNoteIndex(Object.assign({}, real, { leafIndex: null }), leaves)).toBe(2);
    expect(findNoteIndex(getDummyNote(), leaves)).toBe(0);
    expect(() => findNoteIndex(note(1, 1, 1, 1), leaves)).toThrow(/not found in the note tree/);
  });

  it('builds 25-level paths that reach the root (real note and dummy)', () => {
    const treeState = treeStateOf(leaves);
    [real, getDummyNote()].forEach((n) => {
      const { pathIndices, siblings } = getNotePath(n, treeState);
      expect(pathIndices).toHaveLength(25);
      expect(computeRootFromPath(computeNoteLeaf(n), pathIndices, siblings)).toBe(treeState.root);
    });
  });

  it('refuses a path that does not reach the given root', () => {
    const treeState = Object.assign(treeStateOf(leaves), { root: 1n });
    expect(() => getNotePath(real, treeState)).toThrow(/does not reach the note-tree root/);
  });
});

describe('findNoteLeafIndex', () => {
  const leaf = poseidon2([3n, 4n]);

  it('reads an ethers receipt (receipt.logs)', () => {
    const receipt = { logs: [{ topics: ['0x' + pad(1)], data: '0x' }, noteAddedLog(9, poseidon2([1n, 1n])), noteAddedLog(10, leaf)] };
    expect(findNoteLeafIndex(receipt, leaf)).toBe(10);
    expect(findNoteLeafIndex(receipt, leaf.toString())).toBe(10);
  });

  it('reads a web3 receipt (receipt.events, raw logs)', () => {
    const receipt = { events: { 0: { raw: { topics: ['0x' + pad(1)], data: '0x' } }, NoteAdded: [{ raw: noteAddedLog(4, poseidon2([1n, 1n])) }, { raw: noteAddedLog(5, leaf) }] } };
    expect(findNoteLeafIndex(receipt, leaf)).toBe(5);
    expect(findNoteLeafIndex({ events: { NoteAdded: { raw: noteAddedLog(6, leaf) } } }, leaf)).toBe(6);
  });

  it('returns null when no NoteAdded log matches', () => {
    expect(findNoteLeafIndex({ logs: [noteAddedLog(1, poseidon2([1n, 1n]))] }, leaf)).toBeNull();
    expect(findNoteLeafIndex({}, leaf)).toBeNull();
  });
});

describe('selectWithdrawalNotes', () => {
  const a = note(1, 1, 300), b = note(2, 2, 500), c = note(3, 3, 100);

  it('uses the two largest notes when there are two or more', () => {
    expect(selectWithdrawalNotes([a, b, c], 800)).toEqual({ note1: b, note2: a });
    expect(selectWithdrawalNotes([c, a], 50)).toEqual({ note1: a, note2: c });
    expect(selectWithdrawalNotes([a, b, c], 801)).toBeNull();
  });

  it('pairs a single note with the reusable dummy note', () => {
    expect(selectWithdrawalNotes([b], 500)).toEqual({ note1: b, note2: getDummyNote() });
    expect(selectWithdrawalNotes([b], 501)).toBeNull();
    expect(selectWithdrawalNotes([], 1)).toBeNull();
  });
});

describe('syncSpentNotes', () => {
  beforeEach(() => localStorage.clear());

  it('marks notes the contract reports as spent (spentNoteNullifiers)', async () => {
    const kept = note(21, 22, 700, 3), gone = note(31, 32, 900, 4);
    storePaymentNote(kept);
    storePaymentNote(gone);
    const spentOnChain = new Set([computeNullifierHash(gone.amount, gone.nullifier).toString()]);
    const queried = [];
    const reputationContract = { methods: { spentNoteNullifiers: (h) => ({ call: async () => { queried.push(h); return spentOnChain.has(h); } }) } };

    const unspent = await syncSpentNotes(reputationContract);
    expect(queried).toHaveLength(2);
    expect(unspent.map((n) => n.nullifier)).toEqual(['21']);
    expect(getUnspentNotes().map((n) => n.nullifier)).toEqual(['21']);
  });
});

describe('computePaymentCommitment', () => {
  it('is poseidon(nullifier, trapdoor)', () => {
    expect(computePaymentCommitment('8', '9')).toBe(poseidon2([8n, 9n]));
  });
});

describe('the note an order paid to the establishment', () => {
  beforeEach(() => localStorage.clear());

  const ORDER = '0x00000000000000000000000000000000000000aa';
  const secretsOf = (id) => ({ nullifier: String(100 + id), trapdoor: String(200 + id), commitment: computePaymentCommitment(100 + id, 200 + id).toString() });
  const accept = (id) => paymentCommitmentFor(String(id), ORDER, '1760000000', () => secretsOf(id));
  const leafOf = (id, amount) => computePaymentLeaf(secretsOf(id).commitment, amount);
  const record = (id) => JSON.parse(localStorage.getItem(deploymentKey('paymentNoteSecrets')))[id];

  it('is stored with the amount of field 5, whatever the ending: a returned collateral as a payment', () => {
    accept(1);
    accept(2);
    // order 1 concluded (payment plus collateral), order 2 was cancelled (the collateral alone)
    const tree = { allLeaves: [5n, leafOf(1, 23000), 7n, leafOf(2, 3000)] };
    expect(claimRevenueNote('1', '23000', tree)).toBe(true);
    expect(claimRevenueNote('2', '3000', tree)).toBe(true);
    expect(getPaymentNotes()).toEqual([
      { nullifier: '101', trapdoor: '201', amount: '23000', leafIndex: 1, commitment: secretsOf(1).commitment, spent: false },
      { nullifier: '102', trapdoor: '202', amount: '3000', leafIndex: 3, commitment: secretsOf(2).commitment, spent: false },
    ]);
    expect(record(1).claimed).toBe(true);
    expect(record(2).claimed).toBe(true);
  });

  it('is never stored twice', () => {
    accept(2);
    const tree = { allLeaves: [leafOf(2, 3000)] };
    expect(claimRevenueNote('2', '3000', tree)).toBe(true);
    expect(claimRevenueNote('2', '3000', tree)).toBe(false);
    expect(getPaymentNotes()).toHaveLength(1);
    // the Orders page does not ask again either
    expect(ordersWithUnclaimedNote([['2', '', '3000', 'CANCELED BY RESTAURANT', '', '3000']])).toEqual([]);
  });

  it('waits when the note is not in the tree the node gave, or the amount is another one', () => {
    accept(2);
    expect(claimRevenueNote('2', '3000', { allLeaves: [9n] })).toBe(false);
    expect(claimRevenueNote('2', '2999', { allLeaves: [leafOf(2, 3000)] })).toBe(false);
    expect(claimRevenueNote('2', '0', { allLeaves: [leafOf(2, 0)] })).toBe(false);
    expect(record(2).claimed).toBeUndefined();
    expect(getPaymentNotes()).toEqual([]);
    // found at the next load of the page
    expect(claimRevenueNote('2', '3000', { allLeaves: [9n, leafOf(2, 3000)] })).toBe(true);
  });

  it('is not stored for an order whose secrets are not in this browser', () => {
    expect(claimRevenueNote('3', '3000', { allLeaves: [leafOf(3, 3000)] })).toBe(false);
    expect(getPaymentNotes()).toEqual([]);
  });
});
