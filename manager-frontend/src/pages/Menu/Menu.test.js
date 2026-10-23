/* global BigInt */
import React from 'react';
import { render, fireEvent, screen, wait } from '@testing-library/react';

import Menu from './index';
import { useWeb3 } from '../../services/getWeb3';
import { deploymentKey } from '../../utils/deploymentStorage';
import { computePaymentLeaf, computePaymentCommitment, getPaymentNotes, NOTE_ADDED_TOPIC } from '../../utils/zkWithdraw';

// The pool deposit of the Menu page. The wallet and the node are stand-ins.

jest.mock('../../services/api', () => ({ get: jest.fn(() => Promise.resolve({ data: { name: 'An establishment' } })) }));
jest.mock('../../services/getWeb3', () => ({ useWeb3: jest.fn() }));
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/Navigation', () => () => null);
jest.mock('../../components/Item', () => () => null);
jest.mock('../../components/CreateItem', () => () => null);
jest.mock('../../components/UpdateInformations', () => () => null);
jest.mock('../../components/PoolCashout', () => (props) => <span data-testid="cashout">{String(props.refreshKey)}</span>);

const ACCOUNT = '0x00000000000000000000000000000000000000a1';
const word = (x) => BigInt(x).toString(16).padStart(64, '0');
const pending = () => JSON.parse(localStorage.getItem(deploymentKey('poolDeposits')) || '[]');

let node;
let alerts;

// behaviour.send: the error the wallet gives after the transaction left it
function useNode(behaviour = {}) {
  node = { sent: [], keptAtSend: null, logs: [] };
  const web3 = {
    utils: { toWei: (eth) => (BigInt(Math.round(Number(eth) * 1e6)) * 10n ** 12n).toString(), fromWei: (wei) => (Number(wei) / 1e18).toString() },
    eth: {
      Contract: function () {
        this.methods = {
          depositPayment: (commitment) => ({
            estimateGas: async () => 965202,
            send: async (options) => {
              // what the browser kept when the wallet was asked to send
              node.keptAtSend = pending();
              node.sent.push({ commitment: commitment, options: options });
              const leaf = computePaymentLeaf(commitment, options.value);
              const log = { topics: [NOTE_ADDED_TOPIC], data: '0x' + word(1) + word(leaf) };
              node.logs.push(log);
              if (behaviour.send) throw behaviour.send;
              return { status: true, logs: [log] };
            },
          }),
        };
      },
    },
  };
  const logWeb3 = { eth: { getPastLogs: jest.fn(async () => node.logs) } };
  useWeb3.mockReturnValue({ web3: web3, logWeb3: logWeb3 });
  return logWeb3;
}

const depositOf = (amount) => {
  fireEvent.change(screen.getByPlaceholderText('Amount in ETH'), { target: { value: amount } });
  fireEvent.click(screen.getByText('Deposit'));
};
const balanceLine = () => screen.getByText('Pool balance:').parentElement.textContent;

beforeAll(() => {
  if (!window.crypto) window.crypto = require('crypto').webcrypto;
});
beforeEach(() => {
  localStorage.clear();
  alerts = [];
  window.alert = (text) => { alerts.push(text); };
  window.ethereum = { request: () => Promise.resolve([ACCOUNT]) };
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { console.error.mockRestore(); });

describe('the pool deposit of the Menu page', () => {
  it('has the secrets of the note in storage when the wallet is asked to send', async () => {
    useNode();
    render(<Menu />);
    depositOf('0.05');
    await wait(() => expect(alerts).toEqual(['Deposited 0.05 ETH into privacy pool!']));
    expect(node.keptAtSend).toHaveLength(1);
    expect(computePaymentCommitment(node.keptAtSend[0].nullifier, node.keptAtSend[0].trapdoor).toString()).toBe(node.sent[0].commitment);
    expect(node.sent[0].options).toEqual({ from: ACCOUNT, value: '50000000000000000', gas: '1158243' });
    expect(getPaymentNotes()).toHaveLength(1);
    expect(pending()).toHaveLength(0);
    await wait(() => expect(balanceLine()).toBe('Pool balance: 0.05 ETH'));
  });

  it('does not lose a deposit whose receipt never arrives: the next load of the page stores its note', async () => {
    const logWeb3 = useNode({ send: new Error('Transaction was not mined within 750 seconds, please make sure your transaction was properly sent.') });
    const first = render(<Menu />);
    expect(logWeb3.eth.getPastLogs).not.toHaveBeenCalled();
    depositOf('0.05');
    await wait(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]).toMatch(/^Deposit failed: .*the deposit is not lost: its note's secrets are kept in this browser/);
    expect(getPaymentNotes()).toHaveLength(0);
    expect(pending()).toHaveLength(1);
    expect(balanceLine()).toBe('Pool balance: 0 ETH');
    first.unmount();

    render(<Menu />);
    await wait(() => expect(balanceLine()).toBe('Pool balance: 0.05 ETH'));
    const notes = getPaymentNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ amount: '50000000000000000', leafIndex: 1, commitment: node.sent[0].commitment, spent: false });
    expect(computePaymentCommitment(notes[0].nullifier, notes[0].trapdoor).toString()).toBe(node.sent[0].commitment);
    expect(pending()).toHaveLength(0);
    // the cash-out box is told to read the notes again
    expect(screen.getByTestId('cashout').textContent).toBe('false1');
  });

  it('keeps nothing when the person refuses in the wallet', async () => {
    useNode({ send: Object.assign(new Error('MetaMask Tx Signature: User denied transaction signature.'), { code: 4001 }) });
    node.logs = [];
    render(<Menu />);
    depositOf('0.05');
    await wait(() => expect(alerts).toEqual(['Deposit failed: Transaction was rejected in MetaMask.']));
    expect(pending()).toHaveLength(0);
    expect(getPaymentNotes()).toHaveLength(0);
  });
});
