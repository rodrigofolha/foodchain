/* global BigInt */
import { sendPoolDeposit, reconcilePoolDeposits, hasPendingPoolDeposits, wasRejectedInWallet } from './poolDeposit';
import { getPaymentNotes, getUnspentBalance, computePaymentLeaf, computePaymentCommitment, NOTE_ADDED_TOPIC } from './zkWithdraw';
import { getRevenueSummary } from './cashout';
import { deploymentKey, DEPLOYMENT_KEYS } from './deploymentStorage';

const ACCOUNT = '0x00000000000000000000000000000000000000a1';
const AMOUNT = '50000000000000000';
const ESTIMATE = 965202;

const pending = () => JSON.parse(localStorage.getItem(deploymentKey('poolDeposits')) || '[]');
const word = (x) => BigInt(x).toString(16).padStart(64, '0');

// A stand-in for the pool's web3 contract. behaviour.estimate / behaviour.send: the error thrown
function setup(behaviour = {}) {
  const node = { estimates: [], sent: [], keptAtSend: null, tree: [] };
  node.contract = {
    methods: {
      depositPayment: (commitment) => ({
        estimateGas: async (options) => {
          node.estimates.push(options);
          if (behaviour.estimate) throw behaviour.estimate;
          return ESTIMATE;
        },
        send: async (options) => {
          // what the browser kept when the wallet was asked
          node.keptAtSend = pending();
          node.sent.push({ commitment: commitment, options: options });
          const leaf = computePaymentLeaf(commitment, options.value);
          // the deposit is mined whatever the page learns of it, unless the wallet refused it
          if (!behaviour.send || behaviour.mined) node.tree.push(leaf.toString());
          if (behaviour.send) throw behaviour.send;
          return { status: true, transactionHash: '0x' + '5'.repeat(64), logs: [{ topics: [NOTE_ADDED_TOPIC], data: '0x' + word(6) + word(leaf) }] };
        },
      }),
    },
  };
  return node;
}

const deposit = (node) => sendPoolDeposit({ reputationContract: node.contract, from: ACCOUNT, amountWei: AMOUNT });
const treeOf = (node) => ({ allLeaves: ['111'].concat(node.tree) });

beforeAll(() => {
  if (!window.crypto) window.crypto = require('crypto').webcrypto;
});
beforeEach(() => localStorage.clear());

describe('a deposit into the pool from the wallet', () => {
  it('is a storage name of the deployment', () => {
    expect(DEPLOYMENT_KEYS).toContain('poolDeposits');
  });

  it('has its secrets in storage before the wallet is asked to send', async () => {
    const node = setup();
    await deposit(node);
    expect(node.keptAtSend).toHaveLength(1);
    const kept = node.keptAtSend[0];
    expect(computePaymentCommitment(kept.nullifier, kept.trapdoor).toString()).toBe(node.sent[0].commitment);
    expect(kept.commitment).toBe(node.sent[0].commitment);
    expect(kept.amount).toBe(AMOUNT);
    expect(kept.leaf).toBe(computePaymentLeaf(kept.commitment, AMOUNT).toString());
  });

  it('is sent with the estimate times the margin and stored as one note', async () => {
    const node = setup();
    const result = await deposit(node);
    expect(node.sent[0].options).toEqual({ from: ACCOUNT, value: AMOUNT, gas: '1158243' });
    expect(result.leafIndex).toBe(6);
    const notes = getPaymentNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ amount: AMOUNT, leafIndex: 6, commitment: node.sent[0].commitment, spent: false });
    expect(getUnspentBalance()).toBe(BigInt(AMOUNT));
    expect(hasPendingPoolDeposits()).toBe(false);
    // a deposit is not counted as a note received from an order
    expect(getRevenueSummary().revenueCount).toBe(0);
  });

  it('keeps the secrets when the receipt never arrives, and the next page load stores the note once', async () => {
    const node = setup({ send: new Error('Transaction was not mined within 750 seconds'), mined: true });
    let error;
    await deposit(node).catch((err) => { error = err; });
    expect(error.kept).toBe(true);
    expect(error.notSent).toBe(false);
    expect(getPaymentNotes()).toHaveLength(0);
    expect(hasPendingPoolDeposits()).toBe(true);

    expect(reconcilePoolDeposits(treeOf(node))).toBe(1);
    const notes = getPaymentNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ amount: AMOUNT, leafIndex: 1, commitment: node.sent[0].commitment, spent: false });
    expect(computePaymentCommitment(notes[0].nullifier, notes[0].trapdoor).toString()).toBe(node.sent[0].commitment);
    expect(hasPendingPoolDeposits()).toBe(false);
    expect(reconcilePoolDeposits(treeOf(node))).toBe(0);
    expect(getPaymentNotes()).toHaveLength(1);
  });

  it('keeps the record while the note is not in the tree', async () => {
    const node = setup({ send: new Error('Failed to fetch') });
    await deposit(node).catch(() => {});
    expect(reconcilePoolDeposits(treeOf(node))).toBe(0);
    expect(hasPendingPoolDeposits()).toBe(true);
    expect(getPaymentNotes()).toHaveLength(0);
  });

  it('stores one note when the page that sent it and another page both learn of it', async () => {
    const node = setup();
    const original = node.contract.methods.depositPayment;
    // another page finds the leaf in the tree while this one waits for the receipt
    node.contract.methods.depositPayment = (commitment) => {
      const call = original(commitment);
      const send = call.send;
      call.send = async (options) => {
        const receipt = await send(options);
        expect(reconcilePoolDeposits(treeOf(node))).toBe(1);
        return receipt;
      };
      return call;
    };
    await deposit(node);
    expect(getPaymentNotes()).toHaveLength(1);
    expect(hasPendingPoolDeposits()).toBe(false);
  });

  it('keeps no record when the estimate is refused: nothing was sent', async () => {
    const node = setup({ estimate: new Error('execution reverted: Must deposit non-zero amount') });
    let error;
    await deposit(node).catch((err) => { error = err; });
    expect(error.notSent).toBe(true);
    expect(error.kept).toBeUndefined();
    expect(node.sent).toHaveLength(0);
    expect(hasPendingPoolDeposits()).toBe(false);
  });

  it('keeps no record when the person refuses in the wallet', async () => {
    const node = setup({ send: Object.assign(new Error('MetaMask Tx Signature: User denied transaction signature.'), { code: 4001 }) });
    let error;
    await deposit(node).catch((err) => { error = err; });
    expect(error.notSent).toBe(true);
    expect(hasPendingPoolDeposits()).toBe(false);
    expect(getPaymentNotes()).toHaveLength(0);
  });

  it('keeps no record when the deposit was mined and failed', async () => {
    const node = setup({ send: Object.assign(new Error('Transaction has been reverted by the EVM'), { receipt: { status: false } }) });
    let error;
    await deposit(node).catch((err) => { error = err; });
    expect(error.reverted).toBe(true);
    expect(error.kept).toBeUndefined();
    expect(hasPendingPoolDeposits()).toBe(false);
  });

  it('keeps the record of an earlier deposit when a later one is refused', async () => {
    const first = setup({ send: new Error('Failed to fetch'), mined: true });
    await deposit(first).catch(() => {});
    const second = setup({ send: Object.assign(new Error('User denied'), { code: 4001 }) });
    await deposit(second).catch(() => {});
    expect(pending()).toHaveLength(1);
    expect(pending()[0].commitment).toBe(first.sent[0].commitment);
  });
});

describe('a refusal in the wallet', () => {
  it('is told by its code or its text', () => {
    expect(wasRejectedInWallet({ code: 4001 })).toBe(true);
    expect(wasRejectedInWallet(new Error('MetaMask Tx Signature: User denied transaction signature.'))).toBe(true);
    expect(wasRejectedInWallet({ code: 'ACTION_REJECTED' })).toBe(true);
    expect(wasRejectedInWallet(new Error('Failed to fetch'))).toBe(false);
    expect(wasRejectedInWallet({ code: -32603, message: 'Internal JSON-RPC error.' })).toBe(false);
    expect(wasRejectedInWallet(null)).toBe(false);
  });
});
