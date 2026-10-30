import { keccak256 } from 'web3-utils';
import {
  MAX_BLOCK_SPAN,
  ADDRESS_BATCH,
  getLogsChunked,
  chainOrderAddresses,
  logsOfOrders,
  chainOrderLogs,
} from './chainLogs';
import { ORDER_ACTORS_TOPIC } from './orderSecrets';
import { CHAIN_ABI, CHAIN_ADDRESS, DEPLOY_BLOCK } from '../services/config';

const ORDER_ZONE_TOPIC = keccak256('OrderZone(address,string)');
const CUSTOMER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const OTHER_CUSTOMER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const ZERO = '0x0000000000000000000000000000000000000000';
const ORDER_A = '0x00000000000000000000000000000000000000A1';
const ORDER_B = '0x00000000000000000000000000000000000000b2';
const ORDER_C = '0x00000000000000000000000000000000000000c3';
const OTHER = '0x00000000000000000000000000000000000000Fa';

function topicOf(address) {
  return '0x' + '0'.repeat(24) + address.slice(2).toLowerCase();
}

// An OrderZone log of `emitter` that names `order`, as eth_getLogs gives it.
function zoneLog(emitter, order, blockNumber) {
  return { address: emitter, topics: [ORDER_ZONE_TOPIC, topicOf(order)], data: '0x', blockNumber: blockNumber || DEPLOY_BLOCK + 1, logIndex: 0 };
}

// The OrderActors log that an order emits when it is created for `client`.
function actorsLog(order, client, blockNumber) {
  return { address: order, topics: [ORDER_ACTORS_TOPIC, topicOf(client), topicOf(ZERO), topicOf(ZERO)], data: topicOf(order), blockNumber: blockNumber, logIndex: 1 };
}

// `count` distinct order addresses.
function manyOrders(count) {
  const orders = [];
  for (let i = 0; i < count; i++) orders.push('0x' + (0x1000 + i).toString(16).padStart(40, '0'));
  return orders;
}

// The read-only web3 as the helpers use it. `head` is the chain head, or an Error that
// getBlockNumber throws; `answer(filter)` gives the logs of one query. Every call is
// noted in `asked`.
function fakeLogWeb3(head, answer, asked) {
  return {
    utils: { keccak256: keccak256 },
    eth: {
      getBlockNumber: async () => {
        asked.push(['getBlockNumber']);
        if (head instanceof Error) throw head;
        return head;
      },
      getPastLogs: async (filter) => {
        asked.push(['getPastLogs', filter]);
        return answer ? answer(filter) : [];
      },
    },
  };
}

// The filters of the eth_getLogs queries that were made.
function queriesOf(asked) {
  return asked.filter(entry => entry[0] === 'getPastLogs').map(entry => entry[1]);
}

// The last block of a query, with 'latest' (or no toBlock) read as the head.
function lastBlockOf(filter, head) {
  return filter.toBlock === 'latest' || filter.toBlock === undefined ? head : Number(filter.toBlock);
}

// A node that holds `logs` and has the limits of publicnode: a query without an
// address over more than one block is refused, and so is any query over more than
// 50,000 blocks or with more than 10 addresses. Otherwise it gives the logs of the
// addresses named, with the topics given (by position), in the block range of the query.
function publicnodeLike(logs, head) {
  return (filter) => {
    const from = Number(filter.fromBlock);
    const to = lastBlockOf(filter, head);
    const addresses = [].concat(filter.address || []).map(a => String(a).toLowerCase());
    if (addresses.length === 0 && to - from + 1 > 1) throw new Error('Please specify an address in your request');
    if (addresses.length > 10) throw new Error('A maximum of 10 addresses is allowed');
    if (to - from + 1 > 50000) throw new Error('exceed maximum block range: 50000');
    return logs.filter(log => addresses.indexOf(log.address.toLowerCase()) !== -1
      && (filter.topics || []).every((topic, i) => topic === null || String(log.topics[i]).toLowerCase() === String(topic).toLowerCase())
      && log.blockNumber >= from && log.blockNumber <= to);
  };
}

describe('getLogsChunked', () => {
  it('makes one query with the filter as given when the range fits in one window', async () => {
    const asked = [];
    const filter = { address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ZONE_TOPIC] };
    // from DEPLOY_BLOCK to the head is exactly MAX_BLOCK_SPAN blocks
    const logWeb3 = fakeLogWeb3(DEPLOY_BLOCK + MAX_BLOCK_SPAN - 1, () => [zoneLog(CHAIN_ADDRESS, ORDER_A)], asked);
    await expect(getLogsChunked(logWeb3, filter)).resolves.toEqual([zoneLog(CHAIN_ADDRESS, ORDER_A)]);
    expect(asked).toEqual([
      ['getBlockNumber'],
      ['getPastLogs', { address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ZONE_TOPIC] }],
    ]);
    expect(queriesOf(asked)[0]).toBe(filter);
  });

  it('splits 100,000 blocks into three windows, the last one ending at latest', async () => {
    const asked = [];
    const head = DEPLOY_BLOCK + 99999;
    const filter = { address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ZONE_TOPIC] };
    // logs at the first and last block of every window
    const orders = manyOrders(6);
    const held = [0, 44999, 45000, 89999, 90000, 99999].map((offset, i) => zoneLog(CHAIN_ADDRESS, orders[i], DEPLOY_BLOCK + offset));
    const logWeb3 = fakeLogWeb3(head, publicnodeLike(held, head), asked);
    const logs = await getLogsChunked(logWeb3, filter);
    const queries = queriesOf(asked);
    expect(queries.map(q => [q.fromBlock, q.toBlock])).toEqual([
      [DEPLOY_BLOCK, DEPLOY_BLOCK + 44999],
      [DEPLOY_BLOCK + 45000, DEPLOY_BLOCK + 89999],
      [DEPLOY_BLOCK + 90000, 'latest'],
    ]);
    queries.forEach(q => {
      expect(q.address).toBe(CHAIN_ADDRESS);
      expect(q.topics).toEqual([ORDER_ZONE_TOPIC]);
      expect(lastBlockOf(q, head) - q.fromBlock + 1).toBeLessThanOrEqual(MAX_BLOCK_SPAN);
    });
    // every log once, in block order: the windows leave no gap and do not overlap
    expect(logs).toEqual(held);
    // the caller's filter is left as it was
    expect(filter).toEqual({ address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ZONE_TOPIC] });
  });

  it('opens a second window one block after a full one, also for a filter without toBlock', async () => {
    const asked = [];
    const logWeb3 = fakeLogWeb3(1000 + MAX_BLOCK_SPAN, () => [], asked);
    await getLogsChunked(logWeb3, { address: CHAIN_ADDRESS, fromBlock: 1000 });
    expect(queriesOf(asked).map(q => [q.fromBlock, q.toBlock])).toEqual([
      [1000, 1000 + MAX_BLOCK_SPAN - 1],
      [1000 + MAX_BLOCK_SPAN, 'latest'],
    ]);
  });

  it('ends the last window at an explicit numeric toBlock, without reading the head', async () => {
    const asked = [];
    const logWeb3 = fakeLogWeb3(new Error('the head is not needed'), () => [], asked);
    await getLogsChunked(logWeb3, { address: CHAIN_ADDRESS, fromBlock: 1000, toBlock: 100999, topics: [ORDER_ZONE_TOPIC] });
    expect(asked.map(entry => entry[0] === 'getPastLogs' ? [entry[1].fromBlock, entry[1].toBlock] : entry[0])).toEqual([
      [1000, 45999],
      [46000, 90999],
      [91000, 100999],
    ]);
    // an explicit range of one window is one query, as given
    asked.length = 0;
    const short = { address: CHAIN_ADDRESS, fromBlock: 1000, toBlock: 45999 };
    await getLogsChunked(logWeb3, short);
    expect(asked).toEqual([['getPastLogs', short]]);
    expect(queriesOf(asked)[0]).toBe(short);
  });

  it('makes one query with the filter as given when the head cannot be read', async () => {
    const asked = [];
    const filter = { address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ZONE_TOPIC] };
    const logWeb3 = fakeLogWeb3(new Error('rpc down'), () => [zoneLog(CHAIN_ADDRESS, ORDER_A)], asked);
    await expect(getLogsChunked(logWeb3, filter)).resolves.toEqual([zoneLog(CHAIN_ADDRESS, ORDER_A)]);
    expect(asked).toEqual([['getBlockNumber'], ['getPastLogs', filter]]);
    expect(queriesOf(asked)[0]).toBe(filter);
    // the same for a reader that has no getBlockNumber
    const plain = [];
    await getLogsChunked({ eth: { getPastLogs: async (f) => { plain.push(f); return []; } } }, filter);
    expect(plain).toEqual([filter]);
  });

  it('lets a failed window reach the caller', async () => {
    const logWeb3 = fakeLogWeb3(DEPLOY_BLOCK + 99999, (filter) => {
      if (filter.fromBlock > DEPLOY_BLOCK) throw new Error('rpc down');
      return [];
    }, []);
    await expect(getLogsChunked(logWeb3, { address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest' })).rejects.toThrow('rpc down');
  });
});

describe('chainOrderAddresses', () => {
  it('uses the topic of the OrderZone event of Chain', () => {
    const event = CHAIN_ABI.find(entry => entry.type === 'event' && entry.name === 'OrderZone');
    expect(keccak256(event.name + '(' + event.inputs.map(input => input.type).join(',') + ')')).toBe(ORDER_ZONE_TOPIC);
    // the order is the first indexed argument: topics[1]
    expect(event.inputs[0]).toMatchObject({ type: 'address', name: 'orderAddress', indexed: true });
  });

  it('asks Chain for its OrderZone logs, from the given block', async () => {
    const asked = [];
    await chainOrderAddresses(fakeLogWeb3(DEPLOY_BLOCK + 10, () => [], asked), CHAIN_ADDRESS, DEPLOY_BLOCK);
    expect(queriesOf(asked)).toEqual([{ address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ZONE_TOPIC] }]);
  });

  it('reads each order from topics[1], once, and drops the logs of other emitters and malformed logs', async () => {
    const shouting = zoneLog(CHAIN_ADDRESS, ORDER_A);
    shouting.topics[1] = '0x' + '0'.repeat(24) + ORDER_A.slice(2).toUpperCase();
    const logs = [
      zoneLog(CHAIN_ADDRESS, ORDER_A),
      // another contract
      zoneLog(OTHER, ORDER_C),
      // Chain, written in lower case
      zoneLog(CHAIN_ADDRESS.toLowerCase(), ORDER_B),
      // the same order again, and in upper case
      zoneLog(CHAIN_ADDRESS, ORDER_A),
      shouting,
      null,
      {},
      { address: CHAIN_ADDRESS, topics: [ORDER_ZONE_TOPIC] },
      { address: CHAIN_ADDRESS },
    ];
    const orders = await chainOrderAddresses(fakeLogWeb3(DEPLOY_BLOCK + 10, () => logs, []), CHAIN_ADDRESS, DEPLOY_BLOCK);
    expect(orders).toEqual([ORDER_A.toLowerCase(), ORDER_B.toLowerCase()]);
  });

  it('gives no order when the node gives no log', async () => {
    await expect(chainOrderAddresses(fakeLogWeb3(DEPLOY_BLOCK + 10, () => null, []), CHAIN_ADDRESS, DEPLOY_BLOCK)).resolves.toEqual([]);
    await expect(chainOrderAddresses(fakeLogWeb3(DEPLOY_BLOCK + 10, () => [], []), CHAIN_ADDRESS, DEPLOY_BLOCK)).resolves.toEqual([]);
  });
});

describe('logsOfOrders', () => {
  const TOPICS = [ORDER_ACTORS_TOPIC, topicOf(CUSTOMER)];

  it('asks for the logs of 125 orders in batches of 10 addresses, the last one of 5', async () => {
    const asked = [];
    const orders = manyOrders(125);
    const logWeb3 = fakeLogWeb3(DEPLOY_BLOCK + 10, (filter) => [{ first: filter.address[0] }], asked);
    const logs = await logsOfOrders(logWeb3, orders, DEPLOY_BLOCK, TOPICS);
    const queries = queriesOf(asked);
    // publicnode refuses an eth_getLogs that names more than 10 addresses
    expect(ADDRESS_BATCH).toBe(10);
    expect(queries.map(q => q.address.length)).toEqual([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 5]);
    expect([].concat(...queries.map(q => q.address))).toEqual(orders);
    queries.forEach(q => expect(q).toEqual({ address: q.address, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: TOPICS }));
    // the logs of every batch, in the order of the batches
    expect(logs).toEqual(orders.filter((_, i) => i % 10 === 0).map(first => ({ first })));
  });

  it('makes no query when there is no order', async () => {
    const asked = [];
    await expect(logsOfOrders(fakeLogWeb3(DEPLOY_BLOCK + 10, () => [], asked), [], DEPLOY_BLOCK, TOPICS)).resolves.toEqual([]);
    expect(asked).toEqual([]);
  });
});

describe('chainOrderLogs', () => {
  const TOPICS = [ORDER_ACTORS_TOPIC, topicOf(CUSTOMER)];

  it('reads the orders of Chain, then the logs of those orders that match the topics', async () => {
    const asked = [];
    const held = [
      zoneLog(CHAIN_ADDRESS, ORDER_A, DEPLOY_BLOCK + 3),
      actorsLog(ORDER_A, CUSTOMER, DEPLOY_BLOCK + 3),
      zoneLog(CHAIN_ADDRESS, ORDER_B, DEPLOY_BLOCK + 7),
      actorsLog(ORDER_B, OTHER_CUSTOMER, DEPLOY_BLOCK + 7),
      // a contract that Chain did not create, with a log that names the customer
      actorsLog(OTHER, CUSTOMER, DEPLOY_BLOCK + 8),
    ];
    const logWeb3 = fakeLogWeb3(DEPLOY_BLOCK + 10, publicnodeLike(held, DEPLOY_BLOCK + 10), asked);
    await expect(chainOrderLogs(logWeb3, CHAIN_ADDRESS, DEPLOY_BLOCK, TOPICS)).resolves.toEqual([held[1]]);
    expect(queriesOf(asked)).toEqual([
      { address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ZONE_TOPIC] },
      { address: [ORDER_A.toLowerCase(), ORDER_B.toLowerCase()], fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: TOPICS },
    ]);
  });

  it('makes no OrderActors query when Chain created no order', async () => {
    const asked = [];
    await expect(chainOrderLogs(fakeLogWeb3(DEPLOY_BLOCK + 10, () => [], asked), CHAIN_ADDRESS, DEPLOY_BLOCK, TOPICS)).resolves.toEqual([]);
    expect(queriesOf(asked)).toEqual([{ address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ZONE_TOPIC] }]);
  });

  it('finds the orders of a customer over 100,000 blocks on a node with the limits of publicnode', async () => {
    const asked = [];
    const head = DEPLOY_BLOCK + 99999;
    // 60 orders, the customer's at both ends of the range and in between
    const orders = manyOrders(60);
    const held = [];
    orders.forEach((order, i) => {
      const block = DEPLOY_BLOCK + Math.floor(i * 99999 / 59);
      held.push(zoneLog(CHAIN_ADDRESS, order, block));
      held.push(actorsLog(order, i % 20 === 0 || i === 59 ? CUSTOMER : OTHER_CUSTOMER, block));
    });
    const logWeb3 = fakeLogWeb3(head, publicnodeLike(held, head), asked);
    const found = await chainOrderLogs(logWeb3, CHAIN_ADDRESS, DEPLOY_BLOCK, TOPICS);
    expect(found.map(log => log.address)).toEqual([orders[0], orders[20], orders[40], orders[59]]);
    // OrderZone in three windows, then six batches of 10 addresses in three windows each
    const queries = queriesOf(asked);
    expect(queries).toHaveLength(21);
    queries.forEach(q => {
      expect(q.address === CHAIN_ADDRESS || (Array.isArray(q.address) && q.address.length > 0 && q.address.length <= 10)).toBe(true);
      expect(lastBlockOf(q, head) - q.fromBlock + 1).toBeLessThanOrEqual(MAX_BLOCK_SPAN);
    });
    // the address-less query that the orders page made before is refused by such a node
    expect(() => publicnodeLike(held, head)({ fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: TOPICS })).toThrow('Please specify an address');
  });

  it('lets a failed read reach the caller', async () => {
    const logWeb3 = fakeLogWeb3(DEPLOY_BLOCK + 10, () => { throw new Error('rpc down'); }, []);
    await expect(chainOrderLogs(logWeb3, CHAIN_ADDRESS, DEPLOY_BLOCK, TOPICS)).rejects.toThrow('rpc down');
  });
});
