import React from 'react';
import { render, wait } from '@testing-library/react';
import { keccak256 } from 'web3-utils';
import Orders from './index';
import { useWeb3 } from '../../services/getWeb3';
import { CHAIN_ADDRESS, DEPLOY_BLOCK } from '../../services/config';
import { ORDER_ACTORS_TOPIC } from '../../utils/orderSecrets';

jest.mock('../../services/getWeb3');
jest.mock('../../services/api', () => ({ __esModule: true, default: { get: () => Promise.resolve({ data: { restaurants: [] } }) } }));
jest.mock('../../Components/Header', () => () => null);
jest.mock('../../Components/PastOrder', () => {
  const mockReact = require('react');
  return function PastOrder(props) {
    return mockReact.createElement('div', { 'data-testid': 'order' },
      props.orderAddress + '|' + props.orderBlock[0] + '|' + props.orderBlock[3] + '|' + JSON.stringify(props.commitments));
  };
});

// the order placed on Hoodi in block 3873893, its customer and its one-time address
const ORDER = '0x6433d4798Cf86D870b461795299D1B643689dB47';
const CUSTOMER = '0x82fD55a5eDc8F4242480dde230fe3Aa492eB156d';
const ONE_TIME = '0xd49c26b255371c79b266b9e6d14096c716b3ce41';
const OTHER_ORDER = '0x00000000000000000000000000000000000000A1';
const OTHER_CUSTOMER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const ZERO = '0x0000000000000000000000000000000000000000';
const ZONE_TOPIC = keccak256('OrderZone(address,string)');
function topicOf(a) { return '0x' + '0'.repeat(24) + a.slice(2).toLowerCase(); }

// A node with the limits of publicnode: a query without an address over more than one
// block is refused, and so is any query over more than 50,000 blocks or with more than
// 10 addresses.
function publicnodeLike(logs, head) {
  return (filter) => {
    const from = Number(filter.fromBlock);
    const to = filter.toBlock === 'latest' || filter.toBlock === undefined ? head : Number(filter.toBlock);
    const addresses = [].concat(filter.address || []).map(a => String(a).toLowerCase());
    if (addresses.length === 0 && to - from + 1 > 1) throw new Error('Please specify an address in your request');
    if (addresses.length > 10) throw new Error('A maximum of 10 addresses is allowed');
    if (to - from + 1 > 50000) throw new Error('exceed maximum block range: 50000');
    return logs.filter(log => addresses.indexOf(log.address.toLowerCase()) !== -1
      && (filter.topics || []).every((topic, i) => topic === null || String(log.topics[i]).toLowerCase() === String(topic).toLowerCase())
      && log.blockNumber >= from && log.blockNumber <= to);
  };
}

function setup(head) {
  const held = [
    { address: ORDER, topics: [ORDER_ACTORS_TOPIC, topicOf(CUSTOMER), topicOf(ZERO), topicOf(ZERO)], data: topicOf(ORDER), blockNumber: 3873893, logIndex: 1 },
    { address: CHAIN_ADDRESS, topics: [ZONE_TOPIC, topicOf(ORDER)], data: '0x', blockNumber: 3873893, logIndex: 2 },
    { address: OTHER_ORDER, topics: [ORDER_ACTORS_TOPIC, topicOf(OTHER_CUSTOMER), topicOf(ZERO), topicOf(ZERO)], data: topicOf(OTHER_ORDER), blockNumber: 3873895, logIndex: 1 },
    { address: CHAIN_ADDRESS, topics: [ZONE_TOPIC, topicOf(OTHER_ORDER)], data: '0x', blockNumber: 3873895, logIndex: 2 },
  ];
  const node = publicnodeLike(held, head);
  const trace = { asked: [], refused: [], isOrder: [], getOrder: [] };
  const logWeb3 = {
    utils: { keccak256 },
    eth: {
      getBlockNumber: async () => head,
      getPastLogs: async (filter) => {
        trace.asked.push(JSON.parse(JSON.stringify(filter)));
        try { return node(filter); } catch (e) { trace.refused.push(e.message); throw e; }
      },
    },
  };
  const chain = { methods: {
    isOrder: (a) => ({ call: async () => { trace.isOrder.push(a); return [ORDER, OTHER_ORDER].some(o => o.toLowerCase() === a.toLowerCase()); } }),
    getOrder: (a) => ({ call: async () => { trace.getOrder.push(a); return { 0: '1', 1: '0x7b7d', 2: '0', 3: 'ORDERED', 4: ONE_TIME, 5: '0', 6: '0', 7: '0', 8: ZERO, 9: '0', 10: '0' }; } }),
  } };
  useWeb3.mockReturnValue({ web3: logWeb3, logWeb3, chain, storage: { methods: {} }, reputation: null });
  window.ethereum = { request: async ({ method }) => (method === 'eth_chainId' ? '0x88bb0' : [CUSTOMER]) };
  return trace;
}

let logSpy;
beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { logSpy.mockRestore(); delete window.ethereum; localStorage.clear(); });

[
  ['with the head at block 3,873,900 (one window)', 3873900, 1],
  ['with the head at block 3,900,000, more than 45,000 blocks after the deployment (two windows)', 3900000, 2],
].forEach(([name, head, windows]) => {
  it('shows the customer\'s order ' + name, async () => {
    const trace = setup(head);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { findAllByTestId } = render(<Orders />);
    const cards = await findAllByTestId('order');
    errSpy.mockRestore();
    expect(cards.map(c => c.textContent)).toEqual([ORDER + '|1|ORDERED|[]']);
    expect(trace.refused).toEqual([]);
    // every query names an address
    trace.asked.forEach(f => expect(f.address === CHAIN_ADDRESS || (Array.isArray(f.address) && f.address.length > 0)).toBe(true));
    const zone = trace.asked.filter(f => f.address === CHAIN_ADDRESS);
    const actors = trace.asked.filter(f => Array.isArray(f.address));
    expect(zone).toHaveLength(windows);
    expect(actors).toHaveLength(windows);
    zone.forEach(f => expect(f.topics).toEqual([ZONE_TOPIC]));
    actors.forEach(f => {
      expect(f.address).toEqual([ORDER.toLowerCase(), OTHER_ORDER.toLowerCase()]);
      expect(f.topics).toEqual([ORDER_ACTORS_TOPIC, topicOf(CUSTOMER)]);
    });
    expect(zone[0].fromBlock).toBe(DEPLOY_BLOCK);
    expect(trace.isOrder).toEqual([ORDER]);
    expect(trace.getOrder).toEqual([ORDER]);
  });
});

it('shows the empty list, as before, when the node cannot be read', async () => {
  const trace = setup(3873900);
  const { useWeb3: mocked } = require('../../services/getWeb3');
  const value = mocked();
  value.logWeb3.eth.getPastLogs = async () => { throw new Error('rpc down'); };
  const written = [];
  const errSpy = jest.spyOn(console, 'error').mockImplementation((...args) => { written.push(args); });
  const { container } = render(<Orders />);
  await wait(() => expect(written.some(a => a[0] === 'Could not read the order logs:')).toBe(true));
  errSpy.mockRestore();
  await wait(() => expect(container.textContent).toContain('Orders'));
  expect(container.querySelectorAll('[data-testid="order"]')).toHaveLength(0);
  expect(trace.getOrder).toEqual([]);
});
