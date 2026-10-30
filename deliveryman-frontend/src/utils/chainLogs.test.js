import Web3 from 'web3';
import { ethers } from 'ethers';
import {
  MAX_BLOCK_SPAN,
  ADDRESS_BATCH,
  getLogsChunked,
  chainOrderAddresses,
  logsOfOrders,
  chainOrderLogs,
} from './chainLogs';
import { ORDER_ACTORS_TOPIC, addressTopic } from './orderLogs';
import { CHAIN_ABI } from '../services/config';

const web3 = new Web3();

const CHAIN = '0x21F713C3388f4b3A395c1cAB2d8ffa2D5011DEC2';
const OTHER_CONTRACT = '0x00000000000000000000000000000000000000c2';
const WORKER = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const DEPLOY_BLOCK = 3835137;
const ZONE_TOPIC = ethers.utils.id('OrderZone(address,string)');
const WORKER_TOPICS = [ORDER_ACTORS_TOPIC, null, null, addressTopic(WORKER)];

// The address of order number n, in lower case as a node writes it
function order(n) {
  return '0x' + n.toString(16).padStart(40, '0');
}

// An OrderZone log as Chain emits it: the order in topic 1, the zone as data
function zoneLog(orderAddress, zone, emitter = CHAIN) {
  return {
    address: emitter,
    topics: [ZONE_TOPIC, addressTopic(orderAddress)],
    data: web3.eth.abi.encodeParameter('string', zone),
  };
}

// A log provider that records each filter it gets and answers with answer(filter).
// head is the block number it reports, or an Error for a node that cannot report it.
function fakeLogWeb3({ head, answer = () => [] } = {}) {
  const queries = [];
  const headReads = [];
  const logWeb3 = {
    utils: web3.utils,
    eth: {
      getBlockNumber: () => {
        headReads.push(head);
        return head instanceof Error ? Promise.reject(head) : Promise.resolve(head);
      },
      getPastLogs: (filter) => {
        queries.push(filter);
        return new Promise((resolve) => resolve(answer(filter)));
      },
    },
  };
  return { logWeb3, queries, headReads };
}

describe('the limits of a query', () => {
  it('stay under the 50,000 blocks and the 10 addresses that publicnode allows', () => {
    expect(MAX_BLOCK_SPAN).toBe(45000);
    expect(MAX_BLOCK_SPAN).toBeLessThan(50000);
    expect(ADDRESS_BATCH).toBe(10);
  });
});

describe('a query in windows of blocks', () => {
  it('makes one query with the filter as given when the range fits in one window', async () => {
    const found = [{ blockNumber: DEPLOY_BLOCK + 5 }];
    const { logWeb3, queries } = fakeLogWeb3({ head: DEPLOY_BLOCK + 38763, answer: () => found });
    const filter = { address: CHAIN, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ZONE_TOPIC] };
    const copy = JSON.parse(JSON.stringify(filter));

    expect(await getLogsChunked(logWeb3, filter)).toBe(found);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toBe(filter);
    expect(filter).toEqual(copy);
  });

  it('makes one query for exactly MAX_BLOCK_SPAN blocks and two for one block more', async () => {
    const filter = { address: CHAIN, fromBlock: 1000, toBlock: 'latest', topics: [ZONE_TOPIC] };
    const fits = fakeLogWeb3({ head: 1000 + MAX_BLOCK_SPAN - 1 });
    await getLogsChunked(fits.logWeb3, filter);
    expect(fits.queries).toEqual([filter]);

    const over = fakeLogWeb3({ head: 1000 + MAX_BLOCK_SPAN });
    await getLogsChunked(over.logWeb3, filter);
    expect(over.queries.map((q) => [q.fromBlock, q.toBlock])).toEqual([[1000, 1000 + MAX_BLOCK_SPAN - 1], [1000 + MAX_BLOCK_SPAN, 'latest']]);
  });

  it('splits 100,000 blocks into three windows, the last one ending at latest', async () => {
    const { logWeb3, queries } = fakeLogWeb3({
      head: 1099999,
      answer: (filter) => [{ blockNumber: filter.fromBlock }],
    });
    const filter = { address: [order(1), order(2)], fromBlock: 1000000, toBlock: 'latest', topics: WORKER_TOPICS };
    const copy = JSON.parse(JSON.stringify(filter));

    const logs = await getLogsChunked(logWeb3, filter);
    expect(queries).toEqual([
      { address: [order(1), order(2)], fromBlock: 1000000, toBlock: 1044999, topics: WORKER_TOPICS },
      { address: [order(1), order(2)], fromBlock: 1045000, toBlock: 1089999, topics: WORKER_TOPICS },
      { address: [order(1), order(2)], fromBlock: 1090000, toBlock: 'latest', topics: WORKER_TOPICS },
    ]);
    // the logs of all windows, in order
    expect(logs).toEqual([{ blockNumber: 1000000 }, { blockNumber: 1045000 }, { blockNumber: 1090000 }]);
    // the caller's filter is not changed
    expect(filter).toEqual(copy);
  });

  it('treats a filter without toBlock as one up to latest', async () => {
    const { logWeb3, queries } = fakeLogWeb3({ head: 1099999 });
    await getLogsChunked(logWeb3, { address: CHAIN, fromBlock: 1000000, topics: [ZONE_TOPIC] });
    expect(queries.map((q) => [q.fromBlock, q.toBlock])).toEqual([[1000000, 1044999], [1045000, 1089999], [1090000, 'latest']]);
  });

  it('stops at an explicit numeric toBlock without reading the head', async () => {
    const { logWeb3, queries, headReads } = fakeLogWeb3({ head: 5000000 });
    await getLogsChunked(logWeb3, { address: CHAIN, fromBlock: 1000000, toBlock: 1099999, topics: [ZONE_TOPIC] });
    expect(queries).toEqual([
      { address: CHAIN, fromBlock: 1000000, toBlock: 1044999, topics: [ZONE_TOPIC] },
      { address: CHAIN, fromBlock: 1045000, toBlock: 1089999, topics: [ZONE_TOPIC] },
      { address: CHAIN, fromBlock: 1090000, toBlock: 1099999, topics: [ZONE_TOPIC] },
    ]);
    expect(headReads).toHaveLength(0);

    // a short explicit range is one query with the filter as given
    const short = fakeLogWeb3({ head: 5000000 });
    const filter = { address: CHAIN, fromBlock: 1000000, toBlock: 1000100, topics: [ZONE_TOPIC] };
    await getLogsChunked(short.logWeb3, filter);
    expect(short.queries).toHaveLength(1);
    expect(short.queries[0]).toBe(filter);
  });

  it('makes one query with the filter as given when the head cannot be read', async () => {
    const found = [{ blockNumber: 7 }];
    const { logWeb3, queries } = fakeLogWeb3({ head: new Error('rate limit'), answer: () => found });
    const filter = { address: CHAIN, fromBlock: 0, toBlock: 'latest', topics: [ZONE_TOPIC] };
    expect(await getLogsChunked(logWeb3, filter)).toBe(found);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toBe(filter);

    // also with a provider that has no getBlockNumber at all
    const bare = fakeLogWeb3({ answer: () => found });
    delete bare.logWeb3.eth.getBlockNumber;
    expect(await getLogsChunked(bare.logWeb3, filter)).toBe(found);
    expect(bare.queries).toEqual([filter]);
  });

  it('fails when one window fails, so that the caller can fall back', async () => {
    const { logWeb3 } = fakeLogWeb3({ head: 1099999 });
    logWeb3.eth.getPastLogs = (filter) => (filter.fromBlock === 1045000
      ? Promise.reject(new Error('exceed maximum block range: 50000'))
      : Promise.resolve([]));
    await expect(getLogsChunked(logWeb3, { address: CHAIN, fromBlock: 1000000, toBlock: 'latest', topics: [ZONE_TOPIC] }))
      .rejects.toThrow('exceed maximum block range');
  });
});

describe('the orders of Chain', () => {
  it('reads OrderZone, the event of the Chain ABI', () => {
    const event = CHAIN_ABI.find((entry) => entry.type === 'event' && entry.name === 'OrderZone');
    expect(event.name + '(' + event.inputs.map((input) => input.type).join(',') + ')').toBe('OrderZone(address,string)');
    expect(event.inputs[0].indexed).toBe(true);
  });

  it('reads topic 1 of the OrderZone logs of Chain, drops other emitters and malformed logs, and lists each order once', async () => {
    const zoneLogs = [
      zoneLog(order(1), 'Recife'),
      // Chain's address in lower case is still Chain
      zoneLog(order(0xab), 'Olinda', CHAIN.toLowerCase()),
      // a log of another contract
      zoneLog(order(3), 'Recife', OTHER_CONTRACT),
      // malformed logs
      { address: CHAIN, topics: [ZONE_TOPIC], data: '0x' },
      { address: CHAIN, data: '0x' },
      null,
      // the same orders again, one with its topic in capitals
      zoneLog(order(1), 'Recife'),
      { address: CHAIN, topics: [ZONE_TOPIC, addressTopic(order(0xab)).toUpperCase().replace('0X', '0x')], data: '0x' },
      zoneLog(order(4), 'Paulista'),
    ];
    const { logWeb3, queries } = fakeLogWeb3({ head: DEPLOY_BLOCK + 38763, answer: () => zoneLogs });

    expect(await chainOrderAddresses(logWeb3, CHAIN, DEPLOY_BLOCK)).toEqual([order(1), order(0xab), order(4)]);
    expect(queries).toEqual([{ address: CHAIN, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ZONE_TOPIC] }]);
  });

  it('lists no order when the node answers nothing', async () => {
    const { logWeb3 } = fakeLogWeb3({ head: DEPLOY_BLOCK + 10, answer: () => null });
    expect(await chainOrderAddresses(logWeb3, CHAIN, DEPLOY_BLOCK)).toEqual([]);
  });
});

describe('the logs of orders', () => {
  it('asks for 25 orders in batches of 10, 10 and 5', async () => {
    const orders = Array.from({ length: 25 }, (_, i) => order(i + 1));
    const { logWeb3, queries } = fakeLogWeb3({
      head: DEPLOY_BLOCK + 38763,
      answer: (filter) => filter.address.map((address) => ({ address })),
    });

    const logs = await logsOfOrders(logWeb3, orders, DEPLOY_BLOCK, WORKER_TOPICS);
    expect(queries).toEqual([
      { address: orders.slice(0, 10), fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: WORKER_TOPICS },
      { address: orders.slice(10, 20), fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: WORKER_TOPICS },
      { address: orders.slice(20, 25), fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: WORKER_TOPICS },
    ]);
    expect(logs.map((log) => log.address)).toEqual(orders);
  });

  it('splits each batch into windows of blocks', async () => {
    const orders = Array.from({ length: 15 }, (_, i) => order(i + 1));
    const { logWeb3, queries } = fakeLogWeb3({ head: 1099999 });
    await logsOfOrders(logWeb3, orders, 1000000, [ORDER_ACTORS_TOPIC]);
    expect(queries.map((q) => [q.address.length, q.fromBlock, q.toBlock])).toEqual([
      [10, 1000000, 1044999], [10, 1045000, 1089999], [10, 1090000, 'latest'],
      [5, 1000000, 1044999], [5, 1045000, 1089999], [5, 1090000, 'latest'],
    ]);
  });

  it('makes no query for no order', async () => {
    const { logWeb3, queries } = fakeLogWeb3({ head: DEPLOY_BLOCK + 10 });
    expect(await logsOfOrders(logWeb3, [], DEPLOY_BLOCK, [ORDER_ACTORS_TOPIC])).toEqual([]);
    expect(queries).toHaveLength(0);
  });
});

describe('the logs of every order of Chain', () => {
  // OrderActors logs of two orders of Chain, as each order emits them
  const actorsLogs = [order(1), order(2)].map((address) => ({
    address,
    topics: WORKER_TOPICS.map((topic) => topic || addressTopic(OTHER_CONTRACT)),
    data: web3.eth.abi.encodeParameter('address', address),
  }));

  // A node that filters by address, as publicnode does, and refuses a query without one or
  // with more than 10 addresses
  function node(filter) {
    if (Array.isArray(filter.address) && filter.address.length > 10) throw new Error('A maximum of 10 addresses is allowed');
    if (filter.address === CHAIN && filter.topics[0] === ZONE_TOPIC) {
      return [zoneLog(order(1), 'Recife'), zoneLog(order(2), 'Olinda'), zoneLog(order(1), 'Recife')];
    }
    if (Array.isArray(filter.address) && filter.topics[0] === ORDER_ACTORS_TOPIC) {
      return actorsLogs.filter((log) => filter.address.includes(log.address));
    }
    throw new Error('Please specify an address in your request');
  }

  it('reads the orders from the OrderZone logs, then the logs of those orders by their addresses', async () => {
    const { logWeb3, queries } = fakeLogWeb3({ head: DEPLOY_BLOCK + 38763, answer: node });

    expect(await chainOrderLogs(logWeb3, CHAIN, DEPLOY_BLOCK, WORKER_TOPICS)).toEqual(actorsLogs);
    expect(queries).toEqual([
      { address: CHAIN, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ZONE_TOPIC] },
      { address: [order(1), order(2)], fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: WORKER_TOPICS },
    ]);
  });

  it('makes only the OrderZone query when Chain has no order', async () => {
    const { logWeb3, queries } = fakeLogWeb3({ head: DEPLOY_BLOCK + 38763, answer: () => [] });
    expect(await chainOrderLogs(logWeb3, CHAIN, DEPLOY_BLOCK, WORKER_TOPICS)).toEqual([]);
    expect(queries).toEqual([{ address: CHAIN, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ZONE_TOPIC] }]);
  });
});
