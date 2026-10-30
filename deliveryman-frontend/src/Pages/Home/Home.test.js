import React from 'react';
import { render, screen } from '@testing-library/react';

import Home from './index';
import { CHAIN_ADDRESS, DEPLOY_BLOCK } from '../../services/config';

const mockOrders = {};
const mockAsked = [];
const mockQueries = [];
let mockHead = 0;
let mockFail = null;

const ACTORS_TOPIC = '0x3aab3448479337ae16f6a4a2ab87a664e7aad6b0c280f483bf1be0c16f888643';
const ZONE_TOPIC = '0x7ebe63c523646e66b7a4845a7ba5641c709ffccfda4c8ed3b9272207f6ac92f6';
const O1 = '0x00000000000000000000000000000000000000b1';
const O2 = '0x00000000000000000000000000000000000000b2';
const O3 = '0x00000000000000000000000000000000000000b3';
const LOOK_ALIKE = '0x00000000000000000000000000000000000000ff';
const WORKER = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';

jest.mock('../../services/getWeb3', () => {
  const Web3 = require('web3');
  const { CHAIN_ADDRESS, DEPLOY_BLOCK } = require('../../services/config');
  const { addressTopic } = require('../../utils/orderLogs');
  const web3 = new Web3();
  const zoneTopic = web3.utils.keccak256('OrderZone(address,string)');
  const actorsTopic = web3.utils.keccak256('OrderActors(address,address,address,address)');
  const zone = (order, name) => ({ address: CHAIN_ADDRESS, blockNumber: 1, topics: [zoneTopic, addressTopic(order)], data: web3.eth.abi.encodeParameter('string', name) });
  const actors = (order) => ({
    address: order, blockNumber: 2,
    topics: [actorsTopic, addressTopic('0x00000000000000000000000000000000000000d1'), addressTopic('0x0000000000000000000000000000000000000000'), addressTopic('0x0000000000000000000000000000000000000000')],
    data: web3.eth.abi.encodeParameter('address', order),
  });
  const contracts = {
    web3: {
      eth: { getBalance: () => Promise.resolve('1000000000000000000') },
      utils: web3.utils,
    },
    chain: {
      methods: {
        getWorkerReputation: () => ({ call: () => Promise.resolve({ 0: '0', 1: '0', 2: '0' }) }),
        isOrder: (address) => ({ call: () => Promise.resolve(!!mockOrders[address]) }),
        getOrder: (address) => ({ call: () => { mockAsked.push(address); return Promise.resolve(mockOrders[address]); } }),
      },
    },
    logWeb3: {
      utils: web3.utils,
      eth: {
        abi: web3.eth.abi,
        getBlockNumber: () => Promise.resolve(mockHead),
        getPastLogs: (filter) => {
          mockQueries.push(filter);
          if (mockFail && mockFail(filter)) return Promise.reject(new Error('node error'));
          if (filter.address === CHAIN_ADDRESS && filter.topics[0] === zoneTopic) {
            // the events are in the first window
            if (filter.fromBlock !== DEPLOY_BLOCK) return Promise.resolve([]);
            return Promise.resolve([zone(O1, 'Recife'), zone(O2, 'Olinda'), zone(O3, 'Recife'), zone(O1, 'Recife')]);
          }
          if (Array.isArray(filter.address) && filter.topics[0] === actorsTopic && filter.topics.length === 1) {
            if (filter.fromBlock !== DEPLOY_BLOCK) return Promise.resolve([]);
            // a node is not trusted: it also returns a log of a contract it was not asked about
            return Promise.resolve([actors(O1), actors(O2), actors(O3), actors(LOOK_ALIKE)]);
          }
          return Promise.reject(new Error('Please specify an address in your request'));
        },
      },
    },
  };
  return { useWeb3: () => contracts };
});

jest.mock('../../Components/Header', () => () => null);
jest.mock('../../Components/OrderItem', () => ({ order, zone }) => <div>order {order[0]} in {zone}</div>);

function view(id, status) {
  return { 0: String(id), 1: '', 2: '1000', 3: status, 4: '0x0', 5: '0', 6: '0', 7: '0', 8: '0x0', 9: '0', 10: '0' };
}

beforeEach(() => {
  Object.keys(mockOrders).forEach((key) => delete mockOrders[key]);
  mockAsked.length = 0;
  mockQueries.length = 0;
  mockHead = DEPLOY_BLOCK + 38763;
  mockFail = null;
  mockOrders[O1] = view(1, 'PREPARATION');
  mockOrders[O2] = view(2, 'WAITING');
  mockOrders[O3] = view(3, 'PREPARATION');
  window.ethereum = {
    request: ({ method }) => (method === 'eth_accounts' ? Promise.resolve([WORKER]) : Promise.reject(new Error('unexpected ' + method))),
    on: () => {},
    removeListener: () => {},
  };
});

describe('the open orders', () => {
  it('reads OrderZone once, then the OrderActors events of those orders by address', async () => {
    render(<Home history={{}} />);
    await screen.findByText('order 1 in Recife');
    expect(screen.getByText('order 3 in Recife')).toBeTruthy();
    expect(screen.queryByText(/order 2 in/)).toBeNull();
    expect(screen.getByText('2 orders ready to pick up')).toBeTruthy();
    expect(mockQueries).toEqual([
      { address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ZONE_TOPIC] },
      { address: [O1, O2, O3], fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ACTORS_TOPIC] },
    ]);
    expect(mockAsked).not.toContain(LOOK_ALIKE);
    expect(mockAsked.slice().sort()).toEqual([O1, O2, O3]);
  });

  it('splits both queries into windows when the range is long', async () => {
    mockHead = DEPLOY_BLOCK + 99999;
    render(<Home history={{}} />);
    await screen.findByText('order 1 in Recife');
    expect(screen.getByText('order 3 in Recife')).toBeTruthy();
    expect(mockQueries.map((q) => [Array.isArray(q.address) ? q.address.length : q.address, q.fromBlock, q.toBlock])).toEqual([
      [CHAIN_ADDRESS, DEPLOY_BLOCK, DEPLOY_BLOCK + 44999],
      [CHAIN_ADDRESS, DEPLOY_BLOCK + 45000, DEPLOY_BLOCK + 89999],
      [CHAIN_ADDRESS, DEPLOY_BLOCK + 90000, 'latest'],
      [3, DEPLOY_BLOCK, DEPLOY_BLOCK + 44999],
      [3, DEPLOY_BLOCK + 45000, DEPLOY_BLOCK + 89999],
      [3, DEPLOY_BLOCK + 90000, 'latest'],
    ]);
  });

  it('shows no order, and makes no other query, when the OrderZone query fails', async () => {
    mockFail = (filter) => filter.address === CHAIN_ADDRESS;
    render(<Home history={{}} />);
    await screen.findByText('No deliveries available right now');
    expect(mockQueries).toHaveLength(1);
    expect(mockAsked).toHaveLength(0);
  });

  it('shows no order when the OrderActors query fails', async () => {
    mockFail = (filter) => Array.isArray(filter.address);
    render(<Home history={{}} />);
    await screen.findByText('No deliveries available right now');
    expect(mockQueries).toHaveLength(2);
    expect(mockAsked).toHaveLength(0);
  });
});
