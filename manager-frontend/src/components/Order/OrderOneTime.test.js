/* global BigInt */
import React from 'react';
import { render, screen, fireEvent, wait } from '@testing-library/react';

import OrderCard from './index';
import { storeStealthKey } from '../../utils/stealth';
import { ORDER_ACTORS_TOPIC } from '../../utils/orderRatings';
import { REPUTATION_ADDRESS, DEPLOY_BLOCK } from '../../services/config';
import { sendOneTime, oneTimeOverrides, sendFromWallet } from '../../utils/oneTimeSend';
import { quoteGasReturn, sendGasReturn } from '../../utils/gasReturn';
import { withdrawnTo, fundingNeeded, fundingPlan, recordedFunding, recordFunding } from '../../utils/orderFunding';
import { sendRecorded } from '../../utils/signedSend';
import { storePaymentNote, getUnspentBalance, fetchTreeState, generateMergeWithdrawProof, syncSpentNotes, getUnspentNotes } from '../../utils/zkWithdraw';
import { hasPendingCashouts } from '../../utils/cashout';

// The card of an order that has a one-time key in this browser. The network is a stand-in:
// no provider is opened, and what would be sent is recorded by the mocked senders.

jest.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { QR_CODE: 0 },
  Html5Qrcode: class { start() { return Promise.resolve(null); } stop() { return Promise.resolve(); } clear() {} },
}));

const mockNode = { gasPrice: '1000000000', order: null, orderAddress: '0x00000000000000000000000000000000000000aa' };
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  function JsonRpcProvider() {
    this.getGasPrice = async () => ({ toString: () => mockNode.gasPrice });
  }
  function Wallet(key, provider) {
    this.address = '0x00000000000000000000000000000000000000D7';
    this.provider = provider;
  }
  function Contract(address, abi, wallet) {
    this.address = address;
    this.signer = wallet;
    this.findAddress = async () => mockNode.orderAddress;
    this.getOrder = async () => mockNode.order;
  }
  return { ethers: Object.assign({}, actual.ethers, { providers: { JsonRpcProvider: JsonRpcProvider }, Wallet: Wallet, Contract: Contract }) };
});

jest.mock('../../utils/oneTimeSend', () => Object.assign({}, jest.requireActual('../../utils/oneTimeSend'), {
  sendOneTime: jest.fn(), oneTimeOverrides: jest.fn(), sendFromWallet: jest.fn(),
}));
jest.mock('../../utils/gasReturn', () => Object.assign({}, jest.requireActual('../../utils/gasReturn'), {
  quoteGasReturn: jest.fn(), sendGasReturn: jest.fn(),
}));
jest.mock('../../utils/orderFunding', () => Object.assign({}, jest.requireActual('../../utils/orderFunding'), { withdrawnTo: jest.fn() }));
jest.mock('../../utils/signedSend', () => Object.assign({}, jest.requireActual('../../utils/signedSend'), { sendRecorded: jest.fn() }));
jest.mock('../../utils/zkWithdraw', () => Object.assign({}, jest.requireActual('../../utils/zkWithdraw'), {
  fetchTreeState: jest.fn(), generateMergeWithdrawProof: jest.fn(), syncSpentNotes: jest.fn(),
}));

const ONE_TIME = '0x00000000000000000000000000000000000000D7';
const WORKER = '0x00000000000000000000000000000000000000b2';
const ZERO = '0x0000000000000000000000000000000000000000';
const FEE = '3000000000000000';
const ORDER_ADDRESS = mockNode.orderAddress;
const NOW = 1760000100;

function orderBlock(status, committed = WORKER) {
  // field 4 is hidden from the establishment; field 11 is the one-time address the page found
  return ['7', JSON.stringify({ items: [{ name: 'Tapioca', quantity: 1, price: 9 }], k: 'AAECAwQFBgcICQoLDA0ODw' }),
    FEE, status, ZERO, '0', '1760000000', String(NOW), committed, '0', '0', ONE_TIME];
}

let alerts;
let actorLogs;
let ratings;
const NOTHING = { outcome: '0', byClient: '0', byEstablishment: '0' };
const topicOf = (address) => '0x' + '0'.repeat(24) + address.slice(2).toLowerCase();
const cardWeb3 = {
  eth: {
    Contract: function () {
      this.methods = {
        workers: () => ({ call: () => new Promise(() => {}) }),
        orderRatings: (order, address) => ({ call: () => Promise.resolve(ratings[address.toLowerCase()] || NOTHING) }),
        reputationContract: () => ({ call: () => Promise.resolve(REPUTATION_ADDRESS) }),
        isKnownNoteRoot: () => ({ call: () => Promise.resolve(true) }),
      };
    },
    getPastLogs: () => Promise.resolve(actorLogs),
    getBlock: () => Promise.resolve({ timestamp: NOW + 7200 }),
  },
};
const chain = {
  options: { jsonInterface: [] },
  methods: { findAddress: () => ({ call: () => Promise.resolve(ORDER_ADDRESS) }) },
};

function card(block) {
  mockNode.order = block;
  return <OrderCard web3={cardWeb3} logWeb3={cardWeb3} chain={chain} orderBlock={block} total={0} />;
}

function shortOfGas() {
  const { isShortOfGasError } = jest.requireActual('../../utils/oneTimeSend');
  const error = new Error("The order's one-time address holds 0.001 ETH and this transaction needs up to 0.0016 ETH (a gas limit of 1600000 at the current gas price): 0.0006 ETH is missing. Nothing was sent.");
  error.shortOfGas = true;
  expect(isShortOfGasError(error)).toBe(true);
  return error;
}

let reload;
let realLocation;
beforeAll(() => {
  if (!window.crypto) window.crypto = require('crypto').webcrypto;
  realLocation = window.location;
  delete window.location;
  window.location = { reload: jest.fn() };
});
afterAll(() => { window.location = realLocation; });

beforeEach(() => {
  localStorage.clear();
  // a throwaway key, made for this run only
  storeStealthKey(ONE_TIME, '0x' + require('crypto').randomBytes(32).toString('hex'));
  alerts = [];
  actorLogs = [];
  ratings = {};
  mockNode.gasPrice = '1000000000';
  window.alert = (text) => { alerts.push(text); };
  window.ethereum = { request: () => Promise.resolve([ONE_TIME]) };
  reload = window.location.reload;
  reload.mockReset();
  [sendOneTime, oneTimeOverrides, sendFromWallet, quoteGasReturn, sendGasReturn, withdrawnTo, sendRecorded,
    fetchTreeState, generateMergeWithdrawProof, syncSpentNotes].forEach((mock) => mock.mockReset());
  sendOneTime.mockResolvedValue({ status: 1 });
  quoteGasReturn.mockResolvedValue({ offered: false, amount: 0n, cost: 0n, reserve: 0n });
  // the pool paid nothing to the one-time address, unless a test says otherwise
  withdrawnTo.mockResolvedValue(0n);
});

describe('what the card sends from the one-time address', () => {
  const sentCalls = () => sendOneTime.mock.calls.map((call) => [call[1], call[2], call[3]]);

  it('sends the cancellation of an accepted order with no gas limit of its own', async () => {
    render(card(orderBlock('PREPARATION', ZERO)));
    fireEvent.click(screen.getByText('Cancel'));
    await wait(() => expect(reload).toHaveBeenCalled());
    // the limit comes from the estimate inside sendOneTime: the card names none
    expect(sentCalls()).toEqual([['cancelOrder', [ORDER_ADDRESS], undefined]]);
    expect(sendFromWallet).not.toHaveBeenCalled();
  });

  it('does the same for a contested decision, a replacement and a rating', async () => {
    const { unmount } = render(card(orderBlock('DISPATCHED')));
    fireEvent.change(document.querySelector('input[maxlength="6"]'), { target: { value: 'true' } });
    fireEvent.click(screen.getByText('Contest order'));
    await wait(() => expect(sendOneTime).toHaveBeenCalledTimes(1));
    expect(sentCalls()[0]).toEqual(['contestOrder', [ORDER_ADDRESS, true], undefined]);
    unmount();

    const second = render(card(orderBlock('WAITING')));
    fireEvent.click(screen.getByText('Call other deliveryman'));
    await wait(() => expect(sendOneTime).toHaveBeenCalledTimes(2));
    expect(sentCalls()[1]).toEqual(['callSecondDeliveryman', [ORDER_ADDRESS], undefined]);
    second.unmount();

    actorLogs = [{ address: ORDER_ADDRESS, blockNumber: 20, logIndex: 0,
      topics: [ORDER_ACTORS_TOPIC, topicOf(ONE_TIME), topicOf(ONE_TIME), topicOf(WORKER)], data: '0x' + '0'.repeat(24) + ORDER_ADDRESS.slice(2) }];
    ratings[WORKER] = { outcome: '3', byClient: '0', byEstablishment: '0' };
    render(card(orderBlock('CONCLUDED')));
    fireEvent.click(await screen.findByLabelText(/ 4 of 5$/));
    await wait(() => expect(sendOneTime).toHaveBeenCalledTimes(3));
    expect(sentCalls()[2]).toEqual(['rateOrder', [ORDER_ADDRESS, WORKER, 4], undefined]);
  });

  it('says how much is missing when the address cannot pay, for every such call', async () => {
    sendOneTime.mockRejectedValue(shortOfGas());

    const first = render(card(orderBlock('PREPARATION', ZERO)));
    fireEvent.click(screen.getByText('Cancel'));
    await wait(() => expect(alerts).toHaveLength(1));
    first.unmount();

    const second = render(card(orderBlock('DISPATCHED')));
    fireEvent.click(screen.getByText('Contest order'));
    await wait(() => expect(alerts).toHaveLength(2));
    second.unmount();

    const third = render(card(orderBlock('WAITING')));
    fireEvent.click(screen.getByText('Call other deliveryman'));
    await wait(() => expect(alerts).toHaveLength(3));
    third.unmount();

    actorLogs = [{ address: ORDER_ADDRESS, blockNumber: 20, logIndex: 0,
      topics: [ORDER_ACTORS_TOPIC, topicOf(ONE_TIME), topicOf(ONE_TIME), topicOf(WORKER)], data: '0x' + '0'.repeat(24) + ORDER_ADDRESS.slice(2) }];
    ratings[WORKER] = { outcome: '3', byClient: '0', byEstablishment: '0' };
    render(card(orderBlock('CONCLUDED')));
    fireEvent.click(await screen.findByLabelText(/ 4 of 5$/));
    await wait(() => expect(alerts).toHaveLength(4));

    alerts.forEach((text) => expect(text).toMatch(/holds 0\.001 ETH and this transaction needs up to 0\.0016 ETH .* 0\.0006 ETH is missing\. Nothing was sent\./));
    expect(alerts[3]).toMatch(/The rating was not sent\.$/);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('accepting an order from its one-time address', () => {
  const PRICE = 1000000000n;
  const accept = () => fireEvent.click(screen.getByText('Accept order'));
  const prepareCalls = () => sendOneTime.mock.calls.filter((call) => call[1] === 'prepareOrder');

  // What the proof and the signed send answer in the tests that withdraw
  function poolAnswers() {
    syncSpentNotes.mockImplementation(async () => getUnspentNotes());
    fetchTreeState.mockResolvedValue({ root: 5n, allLeaves: [] });
    generateMergeWithdrawProof.mockImplementation(async (p) => ({
      publicSignals: ['1', '2', '3'],
      proof: { a: ['1', '2'], b: [['1', '2'], ['3', '4']], c: ['1', '2'] },
      changeNote: { amount: BigInt(p.note1.amount) + BigInt(p.note2.amount) - BigInt(p.withdrawAmount), commitment: 4242n },
    }));
    oneTimeOverrides.mockResolvedValue({ gasLimit: '1800000', gasPrice: PRICE.toString() });
    sendRecorded.mockImplementation(async (ethers, wallet, contract, method, args, overrides, onSigned) => {
      await onSigned({ txHash: '0xhash', nonce: 0, from: ONE_TIME, rawTx: '0xraw' });
      return { wait: async () => ({ status: 1, transactionHash: '0xhash', logs: [] }) };
    });
  }

  it('withdraws nothing when the chain says the pool already paid this address, whatever the balance', async () => {
    withdrawnTo.mockResolvedValue(fundingNeeded(FEE, PRICE));
    // the gas price rose by 40 % since the funding was mined: within the room
    mockNode.gasPrice = (PRICE * 14n / 10n).toString();
    render(card(orderBlock('ORDERED', ZERO)));
    accept();
    await wait(() => expect(reload).toHaveBeenCalled());
    expect(withdrawnTo.mock.calls[0].slice(1, 3)).toEqual([REPUTATION_ADDRESS, ONE_TIME]);
    expect(generateMergeWithdrawProof).not.toHaveBeenCalled();
    expect(sendRecorded).not.toHaveBeenCalled();
    expect(prepareCalls()).toHaveLength(1);
    expect(prepareCalls()[0][2].slice(0, 1)).toEqual([ORDER_ADDRESS]);
    // the collateral goes with the call; the gas limit is estimated inside sendOneTime
    expect(prepareCalls()[0][3]).toEqual({ value: FEE });
  });

  it('sends nothing when the pool payments cannot be read: funded or not is not guessed', async () => {
    withdrawnTo.mockRejectedValue(new Error('rate limited'));
    render(card(orderBlock('ORDERED', ZERO)));
    accept();
    await wait(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]).toMatch(/could not be read from the chain.*Nothing was sent/);
    expect(generateMergeWithdrawProof).not.toHaveBeenCalled();
    expect(sendOneTime).not.toHaveBeenCalled();
  });

  it('withdraws the fee plus the gas budget the first time, and keeps what was paid for the address', async () => {
    withdrawnTo.mockResolvedValue(0n);
    poolAnswers();
    storePaymentNote({ nullifier: '11', trapdoor: '12', amount: (10n ** 17n).toString(), leafIndex: 1, commitment: '77' });
    render(card(orderBlock('ORDERED', ZERO)));
    accept();
    await wait(() => expect(reload).toHaveBeenCalled(), { timeout: 9000 });

    const needed = fundingNeeded(FEE, PRICE);
    expect(needed).toBe(3000000000000000n + 4725000n * PRICE);
    expect(generateMergeWithdrawProof.mock.calls[0][0].withdrawAmount).toBe(needed.toString());
    expect(BigInt(generateMergeWithdrawProof.mock.calls[0][0].recipient)).toBe(BigInt(ONE_TIME));
    // the withdrawal's gas limit is the estimate with the margin, checked against the balance
    expect(oneTimeOverrides.mock.calls[0][1]).toBe('mergeWithdraw');
    expect(sendRecorded.mock.calls[0][5]).toEqual({ gasLimit: '1800000', gasPrice: PRICE.toString() });
    expect(recordedFunding(ONE_TIME)).toBe(needed);
    expect(getUnspentBalance()).toBe(10n ** 17n - needed);
    expect(hasPendingCashouts()).toBe(false);
    expect(prepareCalls()).toHaveLength(1);
  }, 15000);

  it('withdraws only what is missing when the gas price rose beyond the room since the funding', async () => {
    const paid = fundingNeeded(FEE, PRICE);
    withdrawnTo.mockResolvedValue(paid);
    mockNode.gasPrice = (PRICE * 2n).toString();
    poolAnswers();
    storePaymentNote({ nullifier: '11', trapdoor: '12', amount: (10n ** 17n).toString(), leafIndex: 1, commitment: '77' });
    render(card(orderBlock('ORDERED', ZERO)));
    accept();
    await wait(() => expect(reload).toHaveBeenCalled(), { timeout: 9000 });

    const missing = fundingPlan(paid, FEE, PRICE * 2n).withdraw;
    expect(generateMergeWithdrawProof).toHaveBeenCalledTimes(1);
    expect(generateMergeWithdrawProof.mock.calls[0][0].withdrawAmount).toBe(missing.toString());
    // far less than a second funding
    expect(missing < fundingNeeded(FEE, PRICE * 2n)).toBe(true);
    expect(prepareCalls()).toHaveLength(1);
  }, 15000);

  it('says what is missing when the stipend cannot pay for the withdrawal, and sends nothing', async () => {
    withdrawnTo.mockResolvedValue(0n);
    poolAnswers();
    oneTimeOverrides.mockRejectedValue(shortOfGas());
    storePaymentNote({ nullifier: '11', trapdoor: '12', amount: (10n ** 17n).toString(), leafIndex: 1, commitment: '77' });
    render(card(orderBlock('ORDERED', ZERO)));
    accept();
    await wait(() => expect(alerts).toHaveLength(1), { timeout: 9000 });
    expect(alerts[0]).toMatch(/0\.0006 ETH is missing\. Nothing was sent\. The gas stipend that came with the order does not cover the private withdrawal/);
    expect(sendRecorded).not.toHaveBeenCalled();
    expect(sendOneTime).not.toHaveBeenCalled();
    expect(hasPendingCashouts()).toBe(false);
  }, 15000);
});

describe('the unused gas money of an ended order', () => {
  const OFFER = { offered: true, balance: 5000000000000000n, amount: 3800000000000000n, cost: 1200000000000000n, reserve: 0n };
  const line = () => screen.queryByText(/Return unused gas money:/);
  // the pool funded the order's one-time address, as the chain tells
  beforeEach(() => withdrawnTo.mockResolvedValue(21599999980800000n));

  it('is not offered, and not even quoted, on an order the pool never funded', async () => {
    // refused, or cancelled before it was accepted: the address holds the customer's stipend alone
    withdrawnTo.mockResolvedValue(0n);
    quoteGasReturn.mockResolvedValue(OFFER);
    render(card(orderBlock('CANCELED BY RESTAURANT')));
    await wait(() => expect(withdrawnTo).toHaveBeenCalled());
    expect(withdrawnTo.mock.calls[0].slice(1)).toEqual([REPUTATION_ADDRESS, ONE_TIME, DEPLOY_BLOCK || 0]);
    await wait(() => {});
    expect(quoteGasReturn).not.toHaveBeenCalled();
    expect(line()).toBeNull();
    expect(screen.queryByText('Return unused gas money to the pool')).toBeNull();
  });

  it('is not offered when the pool\'s payments could not be read', async () => {
    withdrawnTo.mockRejectedValue(new Error('Too Many Requests'));
    quoteGasReturn.mockResolvedValue(OFFER);
    render(card(orderBlock('CANCELED BY CLIENT')));
    await wait(() => expect(withdrawnTo).toHaveBeenCalled());
    await wait(() => {});
    expect(quoteGasReturn).not.toHaveBeenCalled();
    expect(line()).toBeNull();
  });

  it('is offered from this browser\'s record of the funding without reading the pool\'s logs', async () => {
    withdrawnTo.mockResolvedValue(0n);
    recordFunding(ONE_TIME, '21599999980800000');
    quoteGasReturn.mockResolvedValue(OFFER);
    render(card(orderBlock('CONCLUDED')));
    await wait(() => expect(line()).not.toBeNull());
    expect(withdrawnTo).not.toHaveBeenCalled();
  });

  it('is offered on an ended order with one line that says what it does and what it costs', async () => {
    quoteGasReturn.mockResolvedValue(OFFER);
    render(card(orderBlock('CANCELED BY FIRST DELIVERYMAN')));
    await wait(() => expect(line()).not.toBeNull());
    expect(line().textContent).toBe("Return unused gas money: sends 0.0038 ETH left at this order's one-time address to the payment pool as a new note of yours; the transaction costs up to 0.0012 ETH, paid from that money.");
    expect(screen.getByText('Return unused gas money to the pool')).toBeTruthy();
    expect(quoteGasReturn.mock.calls[0][1]).toBe(0);
  });

  it('is not offered while the order is open, nor when it is not worth the cost', async () => {
    quoteGasReturn.mockResolvedValue(OFFER);
    const open = render(card(orderBlock('DISPATCHED')));
    await wait(() => {});
    expect(line()).toBeNull();
    expect(quoteGasReturn).not.toHaveBeenCalled();
    open.unmount();

    quoteGasReturn.mockResolvedValue(Object.assign({}, OFFER, { offered: false }));
    render(card(orderBlock('CONCLUDED')));
    await wait(() => expect(quoteGasReturn).toHaveBeenCalled());
    expect(line()).toBeNull();
    expect(screen.queryByText('Return unused gas money to the pool')).toBeNull();
  });

  it('keeps what the ratings still to give need, and says so', async () => {
    actorLogs = [{ address: ORDER_ADDRESS, blockNumber: 20, logIndex: 0,
      topics: [ORDER_ACTORS_TOPIC, topicOf(ONE_TIME), topicOf(ONE_TIME), topicOf(WORKER)], data: '0x' + '0'.repeat(24) + ORDER_ADDRESS.slice(2) }];
    ratings[WORKER] = { outcome: '3', byClient: '0', byEstablishment: '0' };
    quoteGasReturn.mockResolvedValue(Object.assign({}, OFFER, { reserve: 150000000000000n }));
    render(card(orderBlock('CONCLUDED')));
    await wait(() => expect(line()).not.toBeNull());
    expect(quoteGasReturn.mock.calls[0][1]).toBe(1);
    expect(line().textContent).toMatch(/paid from that money, and 0\.00015 ETH stays there for the ratings you can still give\.$/);
  });

  it('returns it with one press and says what came back', async () => {
    quoteGasReturn.mockResolvedValue(OFFER);
    sendGasReturn.mockResolvedValue({ amount: 3800000000000000n, cost: 1200000000000000n, txHash: '0xabc' });
    render(card(orderBlock('CANCELED BY RESTAURANT')));
    fireEvent.click(await screen.findByText('Return unused gas money to the pool'));
    await screen.findByText('0.0038 ETH of unused gas money is back in the payment pool as a new note of yours.');
    expect(sendGasReturn).toHaveBeenCalledTimes(1);
    expect(sendGasReturn.mock.calls[0][0]).toMatchObject({ orderId: '7', unratedWorkers: 0 });
    expect(sendGasReturn.mock.calls[0][0].wallet.address).toBe(ONE_TIME);
    expect(sendGasReturn.mock.calls[0][0].reputation.address).toBe(REPUTATION_ADDRESS);
    expect(screen.queryByText('Return unused gas money to the pool')).toBeNull();
  });

  it('says that nothing is lost when the outcome is not known', async () => {
    quoteGasReturn.mockResolvedValue(OFFER);
    sendGasReturn.mockRejectedValue(Object.assign(new Error('timeout'), { notSent: false }));
    render(card(orderBlock('CONCLUDED')));
    fireEvent.click(await screen.findByText('Return unused gas money to the pool'));
    await screen.findByText(/its note's secrets are kept and the note is recorded when the Orders page finds it in the pool/);
  });
});
