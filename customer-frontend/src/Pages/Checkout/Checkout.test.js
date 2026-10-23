import React from 'react';
import { render as renderElement, fireEvent, wait } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Checkout from './index';
import { useWeb3 } from '../../services/getWeb3';
import { REPUTATION_ADDRESS, STEALTH_ADDRESS } from '../../services/config';
import { setDeployment, deploymentKey } from '../../utils/deploymentStorage';

jest.mock('../../services/getWeb3');
jest.mock('../../Components/Header', () => () => null);

const nodeCrypto = require('crypto');
const sigUtil = require('eth-sig-util');
const { ethers } = require('ethers');

const CUSTOMER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const CHAIN_ID = '0x7a69';
const GAS_PRICE = '1000000000';
// the stipend the page computes: 1.6M gas at 1.5 times the gas price
const STIPEND = '2400000000000000';

// The establishment of the basket: an encryption key and the two stealth keys
const establishment = {
  id: 12,
  name: 'Cantina',
  restaurant_name: 'Cantina',
  restaurant_address: 'Rua A, 1',
  delivery: 3,
  city: 'zone-1',
  public_key: sigUtil.getEncryptionPublicKey('22'.repeat(32)),
  spend_public_key: new ethers.utils.SigningKey('0x' + '33'.repeat(32)).compressedPublicKey,
  view_public_key: new ethers.utils.SigningKey('0x' + '44'.repeat(32)).compressedPublicKey,
};

// Stand-ins for the wallet's web3 and the Chain contract. `answers.estimate(name)` is
// what the node answers to an estimate; every estimate and send is noted in `trace`.
function fakeWeb3(trace, answers) {
  const method = (name, args) => ({
    estimateGas: async (options) => { trace.push(['estimate ' + name, options]); return answers.estimate(name); },
    send: (options) => {
      trace.push([name, args, options]);
      const sent = {
        on: (event, handler) => {
          if (event === 'receipt') setTimeout(() => handler({}), 0);
          return sent;
        },
        then: (resolve) => resolve({}),
      };
      return sent;
    },
  });
  const web3 = {
    eth: {
      getGasPrice: async () => GAS_PRICE,
      getBalance: async () => '0',
      Contract: function (abi, address) {
        trace.push(['contract', address]);
        this.methods = { announce: (...args) => method('announce', args) };
      },
    },
    utils: { fromWei: () => '0' },
  };
  const chain = {
    options: { address: '0x00000000000000000000000000000000000000C0' },
    methods: {
      getIndex: () => ({ call: async () => '4' }),
      findAddress: () => ({ call: async () => '0x0000000000000000000000000000000000000000' }),
      makeOrder: (...args) => method('makeOrder', args),
    },
  };
  return { web3, chain };
}

function pending() {
  return JSON.parse(localStorage.getItem(deploymentKey('pendingOrders')) || '{}');
}

const render = (element) => renderElement(<MemoryRouter>{element}</MemoryRouter>);

let logSpy;

beforeEach(() => {
  window.crypto = { getRandomValues: (bytes) => nodeCrypto.randomFillSync(bytes) };
  window.ethereum = {
    request: async ({ method }) => {
      if (method === 'eth_chainId') return CHAIN_ID;
      if (method === 'eth_getEncryptionPublicKey') return sigUtil.getEncryptionPublicKey('55'.repeat(32));
      return [CUSTOMER];
    },
  };
  window.alert = jest.fn();
  localStorage.setItem('basket', JSON.stringify([{ name: 'Tea', price: '20.00' }]));
  localStorage.setItem('restaurantInfo', JSON.stringify(establishment));
  setDeployment(null);
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  delete window.ethereum;
  localStorage.clear();
});

describe('Checkout: placing an order', () => {
  it('sends the announcement and makeOrder with the node\'s estimate and its margin, not a fixed limit', async () => {
    const trace = [];
    // makeOrder on Sepolia's schedule: above 5,000,000 gas
    useWeb3.mockReturnValue(fakeWeb3(trace, { estimate: (name) => (name === 'makeOrder' ? 6045576 : 29592) }));
    const history = { push: jest.fn() };
    const { getByText } = render(<Checkout history={history} />);
    fireEvent.click(getByText('Place order'));
    await wait(() => expect(history.push).toHaveBeenCalledWith('/user'));

    expect(trace).toContainEqual(['contract', STEALTH_ADDRESS]);
    const announce = trace.find(entry => entry[0] === 'announce');
    expect(announce[2]).toEqual({ from: CUSTOMER, gas: 36990 });

    // the order: U$20 of items and U$3 of delivery, with the stipend taken from the items
    const value = '23000000000000000';
    expect(trace).toContainEqual(['estimate makeOrder', { from: CUSTOMER, value: value }]);
    const order = trace.find(entry => entry[0] === 'makeOrder');
    expect(order[2]).toEqual({ from: CUSTOMER, value: value, gas: 7556970 });
    expect(order[1][1]).toBe('3000000000000000');
    expect(order[1][2]).toBe('20000000000000000');
    expect(order[1][5]).toBe(REPUTATION_ADDRESS);
    expect(order[1][7]).toBe(STIPEND);
    // estimated before it is sent
    expect(trace.findIndex(entry => entry[0] === 'estimate makeOrder')).toBeLessThan(trace.indexOf(order));

    // The order could not be matched to its number here: its pickup secret waits under
    // its stealth address, in the store of this chain and Chain contract.
    const stealth = order[1][0];
    expect(Object.keys(pending())).toEqual([stealth.toLowerCase()]);
    expect(pending()[stealth.toLowerCase()].secrets.pickupSecret).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(localStorage.getItem('pendingOrders')).toBeNull();
    expect(localStorage.getItem('orderSecrets')).toBeNull();
    expect(deploymentKey('pendingOrders')).toMatch(/^pendingOrders@31337:0x[0-9a-f]{40}$/);
  });

  it('sends no order, keeps nothing pending and shows the contract\'s reason when the estimate reverts', async () => {
    const trace = [];
    const revert = new Error("VM Exception while processing transaction: reverted with reason string 'Unknown reputation contract'");
    useWeb3.mockReturnValue(fakeWeb3(trace, { estimate: (name) => { if (name === 'makeOrder') throw revert; return 29592; } }));
    const errors = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args); });
    const history = { push: jest.fn() };
    const { getByText } = render(<Checkout history={history} />);
    fireEvent.click(getByText('Place order'));
    await wait(() => expect(window.alert).toHaveBeenCalledTimes(1));
    spy.mockRestore();

    expect(window.alert).toHaveBeenCalledWith('This page is set up for other contracts than the ones deployed. The order was not placed.');
    expect(errors).toEqual([['Order failed:', 'This page is set up for other contracts than the ones deployed. The order was not placed.']]);
    expect(trace.filter(entry => entry[0] === 'makeOrder')).toEqual([]);
    expect(pending()).toEqual({});
    expect(history.push).not.toHaveBeenCalled();
    // the button is back
    await wait(() => expect(getByText('Place order')).toBeTruthy());
  });

  it('sends nothing at all when the network of the wallet cannot be read', async () => {
    const trace = [];
    useWeb3.mockReturnValue(fakeWeb3(trace, { estimate: () => 100000 }));
    const request = window.ethereum.request;
    window.ethereum.request = async (call) => (call.method === 'eth_chainId' ? null : request(call));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { getByText } = render(<Checkout history={{ push: jest.fn() }} />);
    fireEvent.click(getByText('Place order'));
    await wait(() => expect(window.alert).toHaveBeenCalledTimes(1));
    spy.mockRestore();
    expect(window.alert.mock.calls[0][0]).toMatch(/The network of the wallet could not be read\. Nothing was sent\./);
    expect(trace.filter(entry => entry[0] === 'announce' || entry[0] === 'makeOrder')).toEqual([]);
  });
});
