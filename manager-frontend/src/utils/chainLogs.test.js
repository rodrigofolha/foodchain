import Web3 from 'web3';
import { ethers } from 'ethers';

import { MAX_BLOCK_SPAN, ADDRESS_BATCH, getLogsChunked, chainOrderAddresses, logsOfOrders, chainOrderLogs } from './chainLogs';
import { CHAIN_ADDRESS, DEPLOY_BLOCK, REPUTATION_ADDRESS } from '../services/config';
import { ORDER_ACTORS_TOPIC, fetchOrderCommitments } from './orderRatings';
import { candidateOrdersFromLogs } from './orderLogs';
import { withdrawnTo } from './orderFunding';
import { fetchTreeState, NOTE_ADDED_TOPIC } from './zkWithdraw';
import { scanAnnouncements, deriveStealthPrivateKey } from './stealth';

// keccak256('OrderZone(address,string)')
const ORDER_ZONE_TOPIC = '0x7ebe63c523646e66b7a4845a7ba5641c709ffccfda4c8ed3b9272207f6ac92f6';
const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const addressOf = (n) => '0x' + n.toString(16).padStart(40, '0');
const topicOf = (address) => '0x' + '0'.repeat(24) + address.slice(2).toLowerCase();
const word = (x) => BigInt(x).toString(16).padStart(64, '0');

const CLIENT = addressOf(0xc1);
const ONE_TIME = addressOf(0x0e);
const T = '0x' + '1'.repeat(64);

const zoneLog = (order, extra) => Object.assign({ address: CHAIN_ADDRESS, topics: [ORDER_ZONE_TOPIC, topicOf(order)], data: '0x' }, extra);
const actorsLog = (order, establishment, extra) => Object.assign({
  address: order,
  topics: [ORDER_ACTORS_TOPIC, topicOf(CLIENT), topicOf(establishment), topicOf(ZERO_ADDRESS)],
  data: topicOf(order),
}, extra);

// A log node that records each query. `answer` gives the logs of a query; `head` is the block
// number it reports, or a function that answers getBlockNumber (none: no getBlockNumber at all).
function logNode({ head, answer = () => [] } = {}) {
  const asked = [];
  const web3 = {
    asked: asked,
    utils: { keccak256: Web3.utils.keccak256 },
    eth: { getPastLogs: async (filter) => { asked.push(filter); return answer(filter); } },
  };
  if (head !== undefined) web3.eth.getBlockNumber = typeof head === 'function' ? head : async () => head;
  return web3;
}
const windowsOf = (asked) => asked.map((filter) => [filter.fromBlock, filter.toBlock]);

describe('getLogsChunked', () => {
  const FILTER = { address: REPUTATION_ADDRESS, fromBlock: 100000, toBlock: 'latest', topics: [T] };

  it('passes the filter through unchanged when the range fits in one window', async () => {
    const logs = [{ blockNumber: 100005 }];
    const web3 = logNode({ head: 100000 + MAX_BLOCK_SPAN - 1, answer: () => logs });
    const filter = Object.assign({}, FILTER);
    await expect(getLogsChunked(web3, filter)).resolves.toBe(logs);
    expect(web3.asked).toHaveLength(1);
    expect(web3.asked[0]).toBe(filter);
    expect(filter).toEqual(FILTER);
  });

  it('splits 100,000 blocks into three windows, the last one ending at latest', async () => {
    expect(MAX_BLOCK_SPAN).toBe(45000);
    const web3 = logNode({ head: 199999, answer: (filter) => [{ from: filter.fromBlock }] });
    const filter = Object.assign({}, FILTER);
    const logs = await getLogsChunked(web3, filter);
    expect(web3.asked).toEqual([
      Object.assign({}, FILTER, { fromBlock: 100000, toBlock: 144999 }),
      Object.assign({}, FILTER, { fromBlock: 145000, toBlock: 189999 }),
      Object.assign({}, FILTER, { fromBlock: 190000, toBlock: 'latest' }),
    ]);
    // the logs of every window, in the order of the windows
    expect(logs).toEqual([{ from: 100000 }, { from: 145000 }, { from: 190000 }]);
    // the caller's filter is left as it was
    expect(filter).toEqual(FILTER);
  });

  it('opens a second window at the 45,001st block, and reads up to latest when no toBlock is given', async () => {
    const web3 = logNode({ head: 100000 + MAX_BLOCK_SPAN });
    await getLogsChunked(web3, { address: REPUTATION_ADDRESS, fromBlock: 100000, topics: [T] });
    expect(windowsOf(web3.asked)).toEqual([[100000, 144999], [145000, 'latest']]);
  });

  it('ends the last window at an explicit numeric toBlock, without asking for the head', async () => {
    const getBlockNumber = jest.fn(async () => 5000000);
    const web3 = logNode({ head: getBlockNumber });
    await getLogsChunked(web3, Object.assign({}, FILTER, { toBlock: 199999 }));
    expect(windowsOf(web3.asked)).toEqual([[100000, 144999], [145000, 189999], [190000, 199999]]);

    // a numeric range that fits in one window is passed through as it is
    const small = Object.assign({}, FILTER, { toBlock: 102000 });
    const again = logNode({ head: getBlockNumber });
    await getLogsChunked(again, small);
    expect(again.asked).toHaveLength(1);
    expect(again.asked[0]).toBe(small);
    expect(getBlockNumber).not.toHaveBeenCalled();
  });

  it('makes one query with the filter as given when the head cannot be read', async () => {
    const filter = Object.assign({}, FILTER);
    const failing = logNode({ head: async () => { throw new Error('rate limited'); } });
    await getLogsChunked(failing, filter);
    expect(failing.asked).toHaveLength(1);
    expect(failing.asked[0]).toBe(filter);

    // a node without getBlockNumber
    const bare = logNode();
    await getLogsChunked(bare, filter);
    expect(bare.asked).toHaveLength(1);
    expect(bare.asked[0]).toBe(filter);
  });

  it('fails as a whole when one window fails, so that the caller falls back or retries', async () => {
    const web3 = logNode({ head: 199999, answer: (filter) => {
      if (filter.fromBlock === 145000) throw new Error('exceed maximum block range: 50000');
      return [{ from: filter.fromBlock }];
    } });
    await expect(getLogsChunked(web3, FILTER)).rejects.toThrow('exceed maximum block range: 50000');
  });
});

describe('chainOrderAddresses', () => {
  const A = addressOf(0xa1);
  const B = addressOf(0xb2);
  const C = addressOf(0xc3);
  const D = addressOf(0xd4);

  it('reads each order once from topics[1] of the OrderZone logs of Chain', async () => {
    const logs = [
      zoneLog(A),
      // the emitter in lower case is still Chain
      zoneLog(B, { address: CHAIN_ADDRESS.toLowerCase() }),
      // another contract's log is dropped
      zoneLog(C, { address: addressOf(0xbad) }),
      // malformed logs are dropped
      null, {}, { address: CHAIN_ADDRESS, topics: null }, { address: CHAIN_ADDRESS, topics: [ORDER_ZONE_TOPIC] },
      // the same orders again, one of them spelled in upper case
      zoneLog(A),
      zoneLog(B, { topics: [ORDER_ZONE_TOPIC, '0x' + topicOf(B).slice(2).toUpperCase()] }),
      // a log without its emitter: the query named Chain
      { topics: [ORDER_ZONE_TOPIC, topicOf(D)] },
    ];
    const web3 = logNode({ head: DEPLOY_BLOCK + 10, answer: () => logs });
    await expect(chainOrderAddresses(web3, CHAIN_ADDRESS, DEPLOY_BLOCK)).resolves.toEqual([A, B, D]);
    expect(web3.asked).toEqual([{ address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ZONE_TOPIC] }]);
  });

  it('gives no order when Chain logged none', async () => {
    await expect(chainOrderAddresses(logNode({ answer: () => [] }), CHAIN_ADDRESS, DEPLOY_BLOCK)).resolves.toEqual([]);
    await expect(chainOrderAddresses(logNode({ answer: () => null }), CHAIN_ADDRESS, DEPLOY_BLOCK)).resolves.toEqual([]);
  });
});

describe('logsOfOrders', () => {
  it('queries 25 orders in batches of 10, 10 and 5 addresses', async () => {
    // publicnode refuses an eth_getLogs that names more than 10 addresses
    expect(ADDRESS_BATCH).toBe(10);
    const orders = Array.from({ length: 25 }, (_, i) => addressOf(i + 1));
    const topics = [ORDER_ACTORS_TOPIC, topicOf(CLIENT)];
    const web3 = logNode({ head: DEPLOY_BLOCK + 10, answer: (filter) => [{ first: filter.address[0] }] });
    const logs = await logsOfOrders(web3, orders, DEPLOY_BLOCK, topics);
    expect(web3.asked.map((filter) => filter.address.length)).toEqual([10, 10, 5]);
    expect(web3.asked).toEqual([
      { address: orders.slice(0, 10), fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: topics },
      { address: orders.slice(10, 20), fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: topics },
      { address: orders.slice(20), fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: topics },
    ]);
    expect(logs).toEqual([{ first: orders[0] }, { first: orders[10] }, { first: orders[20] }]);
  });

  it('makes no query without orders: an empty address list is never sent', async () => {
    const web3 = logNode({ head: DEPLOY_BLOCK + 10 });
    await expect(logsOfOrders(web3, [], DEPLOY_BLOCK, [ORDER_ACTORS_TOPIC])).resolves.toEqual([]);
    expect(web3.asked).toEqual([]);
  });
});

describe('chainOrderLogs', () => {
  const A = addressOf(0xa1);
  const B = addressOf(0xb2);
  // the node answers by the filter: the OrderZone logs of Chain, the OrderActors logs of a list of orders
  const answer = (zones) => (filter) => {
    if (filter.address === CHAIN_ADDRESS && filter.topics[0] === ORDER_ZONE_TOPIC) return zones;
    if (Array.isArray(filter.address) && filter.topics[0] === ORDER_ACTORS_TOPIC) return filter.address.map((order) => actorsLog(order, ZERO_ADDRESS));
    throw new Error('unexpected query');
  };

  it('reads the orders from the OrderZone logs, then their logs by address', async () => {
    const web3 = logNode({ head: DEPLOY_BLOCK + 10, answer: answer([zoneLog(A), zoneLog(B), zoneLog(A)]) });
    const topics = [ORDER_ACTORS_TOPIC];
    await expect(chainOrderLogs(web3, CHAIN_ADDRESS, DEPLOY_BLOCK, topics)).resolves.toEqual([actorsLog(A, ZERO_ADDRESS), actorsLog(B, ZERO_ADDRESS)]);
    expect(web3.asked).toEqual([
      { address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ZONE_TOPIC] },
      { address: [A, B], fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: topics },
    ]);
  });

  it('asks for nothing more when Chain names no order', async () => {
    const web3 = logNode({ head: DEPLOY_BLOCK + 10, answer: answer([]) });
    await expect(chainOrderLogs(web3, CHAIN_ADDRESS, DEPLOY_BLOCK, [ORDER_ACTORS_TOPIC])).resolves.toEqual([]);
    expect(web3.asked).toHaveLength(1);
  });

  it('fails when the OrderZone logs cannot be read (the orders page then falls back to no logs)', async () => {
    const web3 = logNode({ head: DEPLOY_BLOCK + 10, answer: () => { throw new Error('network'); } });
    await expect(chainOrderLogs(web3, CHAIN_ADDRESS, DEPLOY_BLOCK, [ORDER_ACTORS_TOPIC])).rejects.toThrow('network');
  });
});

// As publicnode answered on 2026-10-23: an eth_getLogs without an address over more than one
// block is refused (-32701), and so is any eth_getLogs over more than 50,000 blocks; a list of
// up to 10 addresses is accepted (a longer one is refused, -32602).
function publicnode(head, stored) {
  const asked = [];
  const blockOf = (value) => (value === undefined || value === 'latest' ? head : Number(value));
  return {
    asked: asked,
    utils: { keccak256: Web3.utils.keccak256 },
    eth: {
      getBlockNumber: async () => head,
      getPastLogs: async (filter) => {
        asked.push(filter);
        const from = blockOf(filter.fromBlock);
        const to = blockOf(filter.toBlock);
        if (!filter.address && to - from + 1 > 1) {
          throw Object.assign(new Error('Please specify an address in your request ...'), { code: -32701 });
        }
        if ([].concat(filter.address).length > 10) {
          throw Object.assign(new Error('A maximum of 10 addresses is allowed. ...'), { code: -32602 });
        }
        if (to - from + 1 > 50000) throw new Error('exceed maximum block range: 50000');
        const addresses = [].concat(filter.address).map((address) => address.toLowerCase());
        return stored.filter((log) => addresses.indexOf(log.address.toLowerCase()) >= 0 &&
          log.blockNumber >= from && log.blockNumber <= to &&
          (filter.topics || []).every((topic, i) => topic === null || topic === log.topics[i]));
      },
    },
  };
}

describe('on a node that answers as publicnode does', () => {
  it('finds an order accepted more than 50,000 blocks after the deployment, and only the orders of Chain', async () => {
    const ORDER = addressOf(0x6433);
    const created = actorsLog(ORDER, ZERO_ADDRESS, { blockNumber: DEPLOY_BLOCK + 38756 });
    const accepted = actorsLog(ORDER, ONE_TIME, { blockNumber: DEPLOY_BLOCK + 55000 });
    // a contract that is not an order of Chain, logging an OrderActors that names a one-time address
    const decoy = actorsLog(addressOf(0xbad), ONE_TIME, { blockNumber: DEPLOY_BLOCK + 40000 });
    const web3 = publicnode(DEPLOY_BLOCK + 60000, [zoneLog(ORDER, { blockNumber: DEPLOY_BLOCK + 38756 }), created, decoy, accepted]);

    // the queries the dApp made before
    await expect(web3.eth.getPastLogs({ fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ACTORS_TOPIC] }))
      .rejects.toThrow('Please specify an address');
    await expect(web3.eth.getPastLogs({ address: CHAIN_ADDRESS, fromBlock: DEPLOY_BLOCK, toBlock: 'latest', topics: [ORDER_ZONE_TOPIC] }))
      .rejects.toThrow('exceed maximum block range: 50000');
    web3.asked.length = 0;

    const logs = await chainOrderLogs(web3, CHAIN_ADDRESS, DEPLOY_BLOCK, [ORDER_ACTORS_TOPIC]);
    expect(logs).toEqual([created, accepted]);
    expect(windowsOf(web3.asked)).toEqual([
      [DEPLOY_BLOCK, DEPLOY_BLOCK + 44999], [DEPLOY_BLOCK + 45000, 'latest'],
      [DEPLOY_BLOCK, DEPLOY_BLOCK + 44999], [DEPLOY_BLOCK + 45000, 'latest'],
    ]);
    expect(web3.asked.map((filter) => filter.address)).toEqual([CHAIN_ADDRESS, CHAIN_ADDRESS, [ORDER], [ORDER]]);
    // the orders page then takes the order with the key of its one-time address
    expect(candidateOrdersFromLogs(logs, { [ONE_TIME]: 'the one-time key' }))
      .toEqual([{ orderAddress: ORDER, stealthPrivateKey: 'the one-time key' }]);
  });
});

describe('the event queries of this dApp read in windows', () => {
  const HEAD = DEPLOY_BLOCK + 99999;
  const WINDOWS = [[DEPLOY_BLOCK, DEPLOY_BLOCK + 44999], [DEPLOY_BLOCK + 45000, DEPLOY_BLOCK + 89999], [DEPLOY_BLOCK + 90000, 'latest']];
  const ORDER = addressOf(0x7a);

  beforeEach(() => { localStorage.clear(); });

  it('the commitments of an order', async () => {
    const web3 = logNode({ head: HEAD, answer: (filter) => (filter.fromBlock === DEPLOY_BLOCK + 90000 ? [Object.assign(actorsLog(ORDER, ONE_TIME), {
      topics: [ORDER_ACTORS_TOPIC, topicOf(CLIENT), topicOf(ONE_TIME), topicOf(addressOf(0x3e))], blockNumber: HEAD, logIndex: 0,
    })] : []) });
    await expect(fetchOrderCommitments(web3, ORDER, DEPLOY_BLOCK)).resolves.toEqual([addressOf(0x3e)]);
    expect(windowsOf(web3.asked)).toEqual(WINDOWS);
    web3.asked.forEach((filter) => expect(filter).toMatchObject({ address: ORDER, topics: [ORDER_ACTORS_TOPIC] }));
  });

  it('what the pool paid to a one-time address', async () => {
    const paid = (amount) => ({ data: '0x' + word(amount) + word(1) + word(2) });
    const web3 = logNode({ head: HEAD, answer: (filter) => (filter.fromBlock === DEPLOY_BLOCK ? [paid(700)] : filter.fromBlock === DEPLOY_BLOCK + 90000 ? [paid(5)] : []) });
    expect((await withdrawnTo(web3, REPUTATION_ADDRESS, ONE_TIME, DEPLOY_BLOCK)).toString()).toBe('705');
    expect(windowsOf(web3.asked)).toEqual(WINDOWS);
    web3.asked.forEach((filter) => expect(filter).toMatchObject({ address: REPUTATION_ADDRESS, topics: [expect.any(String), topicOf(ONE_TIME)] }));
  });

  it('the note tree, from the NoteAdded logs of every window', async () => {
    const note = (index, leaf) => ({ topics: [NOTE_ADDED_TOPIC], data: '0x' + word(index) + word(leaf) });
    const web3 = logNode({ head: HEAD, answer: (filter) => (filter.fromBlock === DEPLOY_BLOCK ? [note(1, 11)] : filter.fromBlock === DEPLOY_BLOCK + 90000 ? [note(2, 22)] : []) });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    let tree;
    try {
      tree = await fetchTreeState(web3, REPUTATION_ADDRESS, DEPLOY_BLOCK);
    } finally {
      console.log.mockRestore();
    }
    expect(tree.allLeaves.slice(1).map(String)).toEqual(['11', '22']);
    expect(windowsOf(web3.asked)).toEqual(WINDOWS);
    web3.asked.forEach((filter) => expect(filter).toMatchObject({ address: REPUTATION_ADDRESS, topics: [NOTE_ADDED_TOPIC] }));
  });

  // The announcer stands in for the ethers contract of StealthAnnouncer: queryFilter(filter, from, to)
  function announcer(provider, eventsFrom) {
    const asked = [];
    const filter = { topics: ['the Announcement topic of scheme 1'] };
    return {
      asked: asked,
      filter: filter,
      provider: provider,
      filters: { Announcement: (schemeId) => (schemeId === 1 ? filter : null) },
      queryFilter: async (f, from, to) => { asked.push([f, from, to]); return eventsFrom(from); },
    };
  }
  const hexKey = () => require('crypto').randomBytes(32).toString('hex');

  it('the announcements, so that a one-time address announced in the last window is found', async () => {
    // throwaway keys, made for this run only
    const spend = hexKey();
    const view = hexKey();
    const ephemeral = new ethers.utils.SigningKey('0x' + hexKey());
    const ephemeralPubKey = ethers.utils.computePublicKey(ephemeral.publicKey, true);
    const viewTag = parseInt(new ethers.utils.SigningKey('0x' + view).computeSharedSecret(ephemeral.publicKey).slice(2, 4), 16);
    const stealthAddress = deriveStealthPrivateKey(spend, view, ephemeralPubKey).stealthAddress;
    const event = { blockNumber: HEAD - 3, args: { stealthAddress: stealthAddress, ephemeralPubKey: ephemeralPubKey, viewTag: viewTag } };

    const contract = announcer({ getBlockNumber: async () => HEAD }, (from) => (from === DEPLOY_BLOCK + 90000 ? [event] : []));
    const matches = await scanAnnouncements(contract, spend, view, DEPLOY_BLOCK);
    expect(matches.map((match) => [match.stealthAddress, match.blockNumber])).toEqual([[stealthAddress, HEAD - 3]]);
    expect(contract.asked.map((query) => [query[1], query[2]])).toEqual(WINDOWS);
    contract.asked.forEach((query) => expect(query[0]).toBe(contract.filter));
  });

  it('the announcements in one query, as before, when the head cannot be read', async () => {
    const contract = announcer(undefined, () => []);
    await expect(scanAnnouncements(contract, hexKey(), hexKey(), DEPLOY_BLOCK)).resolves.toEqual([]);
    expect(contract.asked).toEqual([[contract.filter, DEPLOY_BLOCK, 'latest']]);
  });
});
