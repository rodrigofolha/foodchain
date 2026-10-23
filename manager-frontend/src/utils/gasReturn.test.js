/* global BigInt */
import { ethers } from 'ethers';
import {
  gasReturnOffer, quoteGasReturn, sendGasReturn, reconcileGasReturns, hasPendingGasReturns,
  GAS_RETURN_WORTH, RATING_RESERVE_GAS,
} from './gasReturn';
import { getPaymentNotes, getUnspentBalance, computePaymentLeaf, computePaymentCommitment, NOTE_ADDED_TOPIC } from './zkWithdraw';
import { getRevenueSummary } from './cashout';
import { deploymentKey } from './deploymentStorage';

const REPUTATION = '0x00000000000000000000000000000000000000f1';
const ABI = ['function depositPayment(uint256 _commitment) payable'];
const PRICE = 1500000000n;        // 1.5 gwei
const ESTIMATE = 965202;          // a deposit on Sepolia
const LIMIT = 1158243n;           // the estimate times 1.2, rounded up
const COST = LIMIT * PRICE;

const pending = () => JSON.parse(localStorage.getItem(deploymentKey('gasReturns')) || '[]');
const word = (x) => BigInt(x).toString(16).padStart(64, '0');

// A stand-in for the node. behaviour.send: an error of the broadcast; behaviour.wait: of the receipt
function setup(balance, behaviour = {}) {
  const provider = {
    _isProvider: true,
    received: [],
    estimates: [],
    balance: BigInt(balance),
    getNetwork: async () => ({ chainId: 31337, name: 'local' }),
    getTransactionCount: async () => 9,
    getFeeData: async () => ({ gasPrice: ethers.BigNumber.from(PRICE.toString()), maxFeePerGas: null, maxPriorityFeePerGas: null }),
    getGasPrice: async () => ethers.BigNumber.from(PRICE.toString()),
    getBalance: async () => ethers.BigNumber.from(provider.balance.toString()),
    estimateGas: async (tx) => { provider.estimates.push(tx); return ethers.BigNumber.from(ESTIMATE); },
    resolveName: async (name) => name,
    sendTransaction: async (signed) => {
      // what the browser kept when the transaction left it
      provider.keptAtBroadcast = pending();
      provider.received.push(signed);
      if (behaviour.send) throw behaviour.send;
      const tx = ethers.utils.parseTransaction(signed);
      return {
        hash: tx.hash,
        wait: async () => {
          if (behaviour.wait) throw behaviour.wait;
          const leaf = computePaymentLeaf(tx.data.slice(10) ? BigInt('0x' + tx.data.slice(10)).toString() : '0', tx.value.toString());
          return { status: 1, transactionHash: tx.hash, logs: [{ topics: [NOTE_ADDED_TOPIC], data: '0x' + word(6) + word(leaf) }] };
        },
      };
    },
  };
  // a throwaway key, made for this run only
  const wallet = ethers.Wallet.createRandom().connect(provider);
  const reputation = new ethers.Contract(REPUTATION, ABI, wallet);
  return { provider, wallet, reputation };
}

const send = (node, extra) => sendGasReturn(Object.assign({ ethers, wallet: node.wallet, reputation: node.reputation, orderId: '7', unratedWorkers: 0 }, extra));

beforeAll(() => {
  if (!window.crypto) window.crypto = require('crypto').webcrypto;
});
beforeEach(() => localStorage.clear());

describe('what a return of unused gas money moves and costs', () => {
  it('is the balance less the limit times the price of the deposit', () => {
    expect(gasReturnOffer(5n * COST, LIMIT, PRICE, 0)).toEqual({ cost: COST, reserve: 0n, amount: 4n * COST, offered: true });
  });

  it('is offered only when the balance is worth more than one and a half times the cost', () => {
    expect(GAS_RETURN_WORTH).toEqual({ times: 3n, over: 2n });
    expect(gasReturnOffer(COST * 3n / 2n, LIMIT, PRICE, 0).offered).toBe(false);
    expect(gasReturnOffer(COST * 3n / 2n + 1n, LIMIT, PRICE, 0)).toMatchObject({ offered: true, amount: COST / 2n + 1n });
    expect(gasReturnOffer(COST, LIMIT, PRICE, 0)).toMatchObject({ offered: false, amount: 0n });
    expect(gasReturnOffer(0, LIMIT, PRICE, 0)).toMatchObject({ offered: false, amount: 0n });
  });

  it('leaves at the address what the ratings still to give need', () => {
    const reserve = 2n * BigInt(RATING_RESERVE_GAS) * PRICE;
    expect(gasReturnOffer(5n * COST, LIMIT, PRICE, 2)).toEqual({ cost: COST, reserve: reserve, amount: 4n * COST - reserve, offered: true });
    expect(gasReturnOffer(COST * 3n / 2n + reserve, LIMIT, PRICE, 2).offered).toBe(false);
  });

  it('is read from the node without sending anything', async () => {
    const node = setup(5n * COST);
    const offer = await quoteGasReturn(node.reputation, 0);
    expect(offer).toMatchObject({ balance: 5n * COST, gasLimit: LIMIT, gasPrice: PRICE, cost: COST, amount: 4n * COST, offered: true });
    expect(node.provider.estimates).toHaveLength(1);
    expect(node.provider.received).toHaveLength(0);
    expect((await quoteGasReturn(setup(0).reputation, 0)).offered).toBe(false);
  });
});

describe('returning the unused gas money', () => {
  it('deposits the balance less the cost under a new commitment and stores the note', async () => {
    const node = setup(5n * COST);
    const result = await send(node);
    expect(result.amount).toBe(4n * COST);
    expect(result.cost).toBe(COST);

    const tx = ethers.utils.parseTransaction(node.provider.received[0]);
    expect(tx.to.toLowerCase()).toBe(REPUTATION);
    expect(tx.from).toBe(node.wallet.address);
    expect(tx.value.toString()).toBe((4n * COST).toString());
    expect(tx.gasLimit.toString()).toBe(LIMIT.toString());
    expect(tx.gasPrice.toString()).toBe(PRICE.toString());
    // value plus limit times price is exactly what the address holds
    expect(BigInt(tx.value.toString()) + BigInt(tx.gasLimit.toString()) * BigInt(tx.gasPrice.toString())).toBe(5n * COST);

    const notes = getPaymentNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ amount: (4n * COST).toString(), leafIndex: 6, spent: false });
    expect(computePaymentCommitment(notes[0].nullifier, notes[0].trapdoor).toString()).toBe(notes[0].commitment);
    expect(BigInt('0x' + tx.data.slice(10)).toString()).toBe(notes[0].commitment);
    expect(getUnspentBalance()).toBe(4n * COST);
    expect(hasPendingGasReturns()).toBe(false);
    // a deposit, not a note received from an order
    expect(getRevenueSummary()).toEqual({ revenueCount: 0, revenueWei: '0' });
  });

  it('has saved the secrets and the signed transaction before the transaction leaves the browser', async () => {
    const node = setup(5n * COST);
    await send(node);
    const kept = node.provider.keptAtBroadcast;
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ order: '7', amount: (4n * COST).toString(), from: node.wallet.address, nonce: 9, rawTx: node.provider.received[0] });
    expect(computePaymentCommitment(kept[0].nullifier, kept[0].trapdoor).toString()).toBe(kept[0].commitment);
    expect(kept[0].leaf).toBe(computePaymentLeaf(kept[0].commitment, kept[0].amount).toString());
  });

  it('keeps for the ratings what they need', async () => {
    const node = setup(5n * COST);
    const result = await send(node, { unratedWorkers: 1 });
    expect(result.amount).toBe(4n * COST - BigInt(RATING_RESERVE_GAS) * PRICE);
  });

  it('sends nothing when the balance is not worth it any more', async () => {
    const node = setup(COST);
    const err = await send(node).catch((e) => e);
    expect(err.notWorth).toBe(true);
    expect(node.provider.received).toHaveLength(0);
    expect(pending()).toEqual([]);
    expect(getPaymentNotes()).toEqual([]);
  });

  it('forgets the record when the node refuses the transaction, and when it reverts', async () => {
    const refused = setup(5n * COST, { send: Object.assign(new Error('insufficient funds for gas * price + value'), { code: 'INSUFFICIENT_FUNDS' }) });
    expect((await send(refused).catch((e) => e)).notSent).toBe(true);
    expect(pending()).toEqual([]);

    const reverted = setup(5n * COST, { wait: Object.assign(new Error('transaction failed'), { receipt: { status: 0 } }) });
    await send(reverted).catch((e) => e);
    expect(pending()).toEqual([]);
    expect(getPaymentNotes()).toEqual([]);
  });

  it('keeps the secrets when the outcome is not known, and stores the note once it is in the tree', async () => {
    const node = setup(5n * COST, { send: Object.assign(new Error('timeout'), { code: 'TIMEOUT' }) });
    expect((await send(node).catch((e) => e)).notSent).toBe(false);
    expect(pending()).toHaveLength(1);
    expect(hasPendingGasReturns()).toBe(true);
    expect(getPaymentNotes()).toEqual([]);

    const record = pending()[0];
    // not mined yet: the record stays
    expect(reconcileGasReturns({ allLeaves: [1n, 2n] })).toBe(0);
    expect(pending()).toHaveLength(1);
    // mined: the note is stored with its place in the tree, once
    const tree = { allLeaves: [1n, 2n, BigInt(record.leaf)] };
    expect(reconcileGasReturns(tree)).toBe(1);
    expect(getPaymentNotes()).toEqual([{ nullifier: record.nullifier, trapdoor: record.trapdoor, amount: record.amount, leafIndex: 2, commitment: record.commitment, spent: false }]);
    expect(pending()).toEqual([]);
    expect(reconcileGasReturns(tree)).toBe(0);
    expect(getPaymentNotes()).toHaveLength(1);
  });
});
