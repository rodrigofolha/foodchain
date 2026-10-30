import React from 'react';
import { render, screen, wait } from '@testing-library/react';
import Web3 from 'web3';

import Orders from './index';
import { useWeb3 } from '../../services/getWeb3';
import { CHAIN_ADDRESS, DEPLOY_BLOCK } from '../../services/config';
import { ORDER_ACTORS_TOPIC } from '../../utils/orderRatings';

// The orders page of the establishment: the log queries it makes to the read-only node, and the
// orders it shows. The wallet, the node, the announcements and the one-time keys are stand-ins:
// nothing is signed or sent.

jest.mock('../../services/getWeb3', () => ({ useWeb3: jest.fn() }));
jest.mock('../../services/api', () => ({ get: () => Promise.resolve({ data: {} }) }));
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/Navigation', () => () => null);
jest.mock('../../components/Order', () => (props) => (
  <div data-testid="order">{props.orderBlock[0] + '|' + props.orderBlock[3] + '|' + props.orderBlock[11]}</div>
));

// The one-time addresses of the establishment that its announcements give, with their keys
const mockMatches = [];
jest.mock('../../utils/stealth', () => ({
  getOrCreateSpendKey: () => ({ privateKey: 'spend key', viewPrivateKey: 'view key' }),
  scanAnnouncements: () => Promise.resolve(mockMatches),
  storeStealthKey: () => {},
}));

// Chain.getOrder as each one-time wallet calls it: the items of an order are given to its
// establishment only, as Order.getItems does
const mockChain = { views: {}, walletOf: {}, asked: [] };
jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  function JsonRpcProvider() {}
  function Wallet(key) { this.address = mockChain.walletOf[key]; }
  function Contract(address, abi, signer) {
    this.getOrder = async (orderAddress) => {
      mockChain.asked.push(orderAddress);
      const order = mockChain.views[orderAddress.toLowerCase()];
      if (order && signer && signer.address === order.establishment) return order.view;
      return { 0: order ? order.view[0] : '0', 1: '', 2: '0', 3: '', 4: '0x' + '0'.repeat(40), 5: '0', 6: '0', 7: '0', 8: '0x' + '0'.repeat(40), 9: '0', 10: '0' };
    };
  }
  return {
    ethers: Object.assign({}, actual.ethers, {
      providers: Object.assign({}, actual.ethers.providers, { JsonRpcProvider: JsonRpcProvider }),
      Wallet: Wallet,
      Contract: Contract,
    }),
  };
});

const ZONE_TOPIC = Web3.utils.keccak256('OrderZone(address,string)');
const ZERO = '0x' + '0'.repeat(40);
const addressOf = (n) => '0x' + n.toString(16).padStart(40, '0');
const topicOf = (address) => '0x' + '0'.repeat(24) + address.slice(2).toLowerCase();

const ACCOUNT = addressOf(0xa0);
const CLIENT = addressOf(0xc1);
// the one-time address of an order not accepted yet, and the one of an accepted order
const ONE_TIME = addressOf(0xe1);
const ONE_TIME_KEY = '0x' + '01'.repeat(32);
const ACCEPTED_ONE_TIME = addressOf(0xe2);
const ACCEPTED_ONE_TIME_KEY = '0x' + '02'.repeat(32);
// the one-time address of another establishment
const OTHER_SHOP = addressOf(0xe9);

const NEW_ORDER = addressOf(0xa1);
const OTHER_ORDER = addressOf(0xa2);
const ACCEPTED_ORDER = addressOf(0xa3);

function view(id, status) {
  return { 0: String(id), 1: '0x7b7d', 2: '1000', 3: status, 4: ZERO, 5: '0', 6: '0', 7: '0', 8: ZERO, 9: '0', 10: '0' };
}
const zoneLog = (order, blockNumber) => ({ address: CHAIN_ADDRESS, topics: [ZONE_TOPIC, topicOf(order)], data: '0x', blockNumber: blockNumber });
const actorsLog = (order, establishment, blockNumber) => ({
  address: order,
  topics: [ORDER_ACTORS_TOPIC, topicOf(CLIENT), topicOf(establishment), topicOf(ZERO)],
  data: topicOf(order),
  blockNumber: blockNumber,
});

// A node with the limits of publicnode: a query without an address over more than one block
// is refused, and so is any query over more than 50,000 blocks or with more than 10 addresses.
// Otherwise it gives the logs of the addresses named, with the topics given, in the range.
// A node that is down fails every query.
function publicnodeLike(held, head, trace, down) {
  return {
    utils: { keccak256: Web3.utils.keccak256 },
    eth: {
      getBlockNumber: async () => head,
      getPastLogs: async (filter) => {
        trace.asked.push(JSON.parse(JSON.stringify(filter)));
        if (down) throw new Error('rpc down');
        const from = Number(filter.fromBlock);
        const to = filter.toBlock === undefined || filter.toBlock === 'latest' ? head : Number(filter.toBlock);
        const addresses = [].concat(filter.address || []).map((address) => String(address).toLowerCase());
        let refusal = null;
        if (addresses.length === 0 && to - from + 1 > 1) refusal = 'Please specify an address in your request ...';
        else if (addresses.length > 10) refusal = 'A maximum of 10 addresses is allowed. ...';
        else if (to - from + 1 > 50000) refusal = 'exceed maximum block range: 50000';
        if (refusal) {
          trace.refused.push(refusal);
          throw new Error(refusal);
        }
        return held.filter((log) => addresses.indexOf(log.address.toLowerCase()) >= 0 &&
          log.blockNumber >= from && log.blockNumber <= to &&
          (filter.topics || []).every((topic, i) => topic === null || topic === log.topics[i]));
      },
    },
  };
}

// The page on a node that holds `held`, with `orders` (address -> { establishment, view })
// as the orders of Chain
function setup({ held, head, orders, down }) {
  const trace = { asked: [], refused: [], isOrder: [] };
  Object.keys(orders).forEach((address) => { mockChain.views[address.toLowerCase()] = orders[address]; });
  const logWeb3 = publicnodeLike(held, head, trace, down);
  const chain = {
    options: { jsonInterface: [] },
    methods: {
      isOrder: (address) => ({
        call: async () => {
          trace.isOrder.push(address);
          return Object.keys(orders).some((order) => order.toLowerCase() === address.toLowerCase());
        },
      }),
    },
  };
  useWeb3.mockReturnValue({ web3: logWeb3, interact: null, chain: chain, logWeb3: logWeb3 });
  return trace;
}

// [address, fromBlock, toBlock] of each query, with the number of addresses of a list
const shapes = (asked) => asked.map((filter) => [
  Array.isArray(filter.address) ? filter.address.length : filter.address, filter.fromBlock, filter.toBlock,
]);
const cardsText = async () => (await screen.findAllByTestId('order')).map((card) => card.textContent);

let logged;
let warned;
beforeEach(() => {
  mockChain.views = {};
  mockChain.walletOf = { [ONE_TIME_KEY]: ONE_TIME, [ACCEPTED_ONE_TIME_KEY]: ACCEPTED_ONE_TIME };
  mockChain.asked = [];
  mockMatches.length = 0;
  mockMatches.push(
    { stealthAddress: ONE_TIME, stealthPrivateKey: ONE_TIME_KEY },
    { stealthAddress: ACCEPTED_ONE_TIME, stealthPrivateKey: ACCEPTED_ONE_TIME_KEY },
  );
  logged = [];
  warned = [];
  jest.spyOn(console, 'log').mockImplementation((...args) => { logged.push(args); });
  jest.spyOn(console, 'warn').mockImplementation((...args) => { warned.push(args); });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  window.ethereum = { request: async () => [ACCOUNT] };
});
afterEach(() => {
  console.log.mockRestore();
  console.warn.mockRestore();
  console.error.mockRestore();
  delete window.ethereum;
  localStorage.clear();
});

describe('the orders of the establishment', () => {
  const ORDERS = {
    [NEW_ORDER]: { establishment: ONE_TIME, view: view(1, 'ORDERED') },
    [OTHER_ORDER]: { establishment: OTHER_SHOP, view: view(2, 'ORDERED') },
    [ACCEPTED_ORDER]: { establishment: ACCEPTED_ONE_TIME, view: view(3, 'PREPARATION') },
  };

  it('reads the OrderActors logs by the addresses of the orders that Chain names', async () => {
    const trace = setup({
      head: DEPLOY_BLOCK + 38763,
      orders: ORDERS,
      held: [
        zoneLog(NEW_ORDER, DEPLOY_BLOCK + 10), actorsLog(NEW_ORDER, ZERO, DEPLOY_BLOCK + 10),
        zoneLog(OTHER_ORDER, DEPLOY_BLOCK + 11), actorsLog(OTHER_ORDER, ZERO, DEPLOY_BLOCK + 11),
        zoneLog(ACCEPTED_ORDER, DEPLOY_BLOCK + 12), actorsLog(ACCEPTED_ORDER, ZERO, DEPLOY_BLOCK + 12),
        actorsLog(ACCEPTED_ORDER, ACCEPTED_ONE_TIME, DEPLOY_BLOCK + 20),
      ],
    });
    render(<Orders />);
    expect(await cardsText()).toEqual(['1|ORDERED|' + ONE_TIME, '3|PREPARATION|' + ACCEPTED_ONE_TIME]);
    expect(trace.asked).toEqual([
      { address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ZONE_TOPIC] },
      { address: [NEW_ORDER, OTHER_ORDER, ACCEPTED_ORDER], fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ACTORS_TOPIC] },
    ]);
    expect(trace.refused).toEqual([]);
    expect(trace.isOrder).toEqual([NEW_ORDER, OTHER_ORDER, ACCEPTED_ORDER]);
    expect(warned).toEqual([]);
  });

  it('splits both queries into windows of at most 45,000 blocks', async () => {
    const trace = setup({
      head: DEPLOY_BLOCK + 99999,
      orders: ORDERS,
      held: [
        zoneLog(NEW_ORDER, DEPLOY_BLOCK + 10), actorsLog(NEW_ORDER, ZERO, DEPLOY_BLOCK + 10),
        zoneLog(OTHER_ORDER, DEPLOY_BLOCK + 11), actorsLog(OTHER_ORDER, ZERO, DEPLOY_BLOCK + 11),
        zoneLog(ACCEPTED_ORDER, DEPLOY_BLOCK + 12), actorsLog(ACCEPTED_ORDER, ZERO, DEPLOY_BLOCK + 12),
        actorsLog(ACCEPTED_ORDER, ACCEPTED_ONE_TIME, DEPLOY_BLOCK + 60000),
      ],
    });
    render(<Orders />);
    expect(await cardsText()).toEqual(['1|ORDERED|' + ONE_TIME, '3|PREPARATION|' + ACCEPTED_ONE_TIME]);
    expect(shapes(trace.asked)).toEqual([
      [CHAIN_ADDRESS, DEPLOY_BLOCK, DEPLOY_BLOCK + 44999],
      [CHAIN_ADDRESS, DEPLOY_BLOCK + 45000, DEPLOY_BLOCK + 89999],
      [CHAIN_ADDRESS, DEPLOY_BLOCK + 90000, 'latest'],
      [3, DEPLOY_BLOCK, DEPLOY_BLOCK + 44999],
      [3, DEPLOY_BLOCK + 45000, DEPLOY_BLOCK + 89999],
      [3, DEPLOY_BLOCK + 90000, 'latest'],
    ]);
    expect(trace.refused).toEqual([]);
  });

  it('asks for the logs of more than 10 orders 10 addresses at a time', async () => {
    const others = Array.from({ length: 11 }, (_, i) => addressOf(0xb0 + i));
    const orders = { [NEW_ORDER]: { establishment: ONE_TIME, view: view(1, 'ORDERED') } };
    const held = [zoneLog(NEW_ORDER, DEPLOY_BLOCK + 10), actorsLog(NEW_ORDER, ZERO, DEPLOY_BLOCK + 10)];
    others.forEach((order, i) => {
      orders[order] = { establishment: OTHER_SHOP, view: view(i + 2, 'ORDERED') };
      held.push(zoneLog(order, DEPLOY_BLOCK + 20 + i), actorsLog(order, ZERO, DEPLOY_BLOCK + 20 + i));
    });
    const trace = setup({ head: DEPLOY_BLOCK + 38763, orders: orders, held: held });
    render(<Orders />);
    expect(await cardsText()).toEqual(['1|ORDERED|' + ONE_TIME]);
    expect(shapes(trace.asked)).toEqual([
      [CHAIN_ADDRESS, DEPLOY_BLOCK, 'latest'],
      [10, DEPLOY_BLOCK, 'latest'],
      [2, DEPLOY_BLOCK, 'latest'],
    ]);
    expect(trace.asked[1].address.concat(trace.asked[2].address)).toEqual([NEW_ORDER].concat(others));
    expect(trace.refused).toEqual([]);
  });

  it('shows no order, as before, when the node cannot be read', async () => {
    const trace = setup({ head: DEPLOY_BLOCK + 38763, orders: ORDERS, held: [zoneLog(NEW_ORDER, DEPLOY_BLOCK + 10)], down: true });
    const { container } = render(<Orders />);
    await wait(() => expect(logged).toContainEqual(['[Orders] Candidate orders:', 0]));
    await wait(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(container.querySelectorAll('[data-testid="order"]')).toHaveLength(0);
    // the OrderZone query failed: no other query was made
    expect(trace.asked).toHaveLength(1);
    expect(trace.isOrder).toEqual([]);
    expect(mockChain.asked).toEqual([]);
  });
});
