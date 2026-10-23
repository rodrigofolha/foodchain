import { parseOrderActorsLog, candidateOrdersFromLogs } from './orderLogs';
import { ORDER_ACTORS_TOPIC } from './orderRatings';

const ORDER_A = '0x00000000000000000000000000000000000000aa';
const ORDER_B = '0x00000000000000000000000000000000000000bb';
const OTHER_CONTRACT = '0x00000000000000000000000000000000000000ee';
const CUSTOMER = '0x1111111111111111111111111111111111111111';
const ONE_TIME = '0x2222222222222222222222222222222222222222';
const SOMEBODY = '0x3333333333333333333333333333333333333333';
const WORKER = '0x4444444444444444444444444444444444444444';
const ZERO = '0x' + '0'.repeat(40);

const topic = (address) => '0x' + '0'.repeat(24) + address.slice(2).toLowerCase();
// A real log: emitted by the order, which names itself in the data
const actors = (order, establishment, worker, emitter) => ({
  address: emitter || order,
  topics: [ORDER_ACTORS_TOPIC, topic(CUSTOMER), topic(establishment), topic(worker || ZERO)],
  data: topic(order),
  blockNumber: 10,
  logIndex: 0,
});

describe('parseOrderActorsLog', () => {
  it('reads a real log: the order is its emitter, the establishment the second indexed address', () => {
    expect(parseOrderActorsLog(actors(ORDER_A, ONE_TIME, WORKER))).toEqual({ orderAddress: ORDER_A, establishment: ONE_TIME });
    expect(parseOrderActorsLog(actors(ORDER_A, ZERO))).toEqual({ orderAddress: ORDER_A, establishment: ZERO });
    // a checksummed emitter, as some nodes return it
    const mixed = actors(ORDER_A, ONE_TIME);
    mixed.address = '0x00000000000000000000000000000000000000AA';
    expect(parseOrderActorsLog(mixed)).toEqual({ orderAddress: ORDER_A, establishment: ONE_TIME });
  });

  it('skips a malformed log without throwing', () => {
    // a log with the topic of the event alone
    expect(parseOrderActorsLog({ address: OTHER_CONTRACT, topics: [ORDER_ACTORS_TOPIC], data: '0x' })).toBeNull();
    expect(parseOrderActorsLog({ address: OTHER_CONTRACT, topics: [ORDER_ACTORS_TOPIC, topic(CUSTOMER)], data: topic(OTHER_CONTRACT) })).toBeNull();
    const short = actors(ORDER_A, ONE_TIME);
    short.data = '0x' + ORDER_A.slice(2);
    expect(parseOrderActorsLog(short)).toBeNull();
    const long = actors(ORDER_A, ONE_TIME);
    long.data = long.data + '00'.repeat(32);
    expect(parseOrderActorsLog(long)).toBeNull();
    const noData = actors(ORDER_A, ONE_TIME);
    delete noData.data;
    expect(parseOrderActorsLog(noData)).toBeNull();
    const fiveTopics = actors(ORDER_A, ONE_TIME);
    fiveTopics.topics.push(topic(WORKER));
    expect(parseOrderActorsLog(fiveTopics)).toBeNull();
    const badTopic = actors(ORDER_A, ONE_TIME);
    badTopic.topics[2] = '0x1234';
    expect(parseOrderActorsLog(badTopic)).toBeNull();
    const nullTopic = actors(ORDER_A, ONE_TIME);
    nullTopic.topics[2] = null;
    expect(parseOrderActorsLog(nullTopic)).toBeNull();
    const dirty = actors(ORDER_A, ONE_TIME);
    dirty.data = '0x' + 'f'.repeat(24) + ORDER_A.slice(2);
    expect(parseOrderActorsLog(dirty)).toBeNull();
    const otherEvent = actors(ORDER_A, ONE_TIME);
    otherEvent.topics[0] = '0x' + '1'.repeat(64);
    expect(parseOrderActorsLog(otherEvent)).toBeNull();
    const noEmitter = actors(ORDER_A, ONE_TIME);
    delete noEmitter.address;
    expect(parseOrderActorsLog(noEmitter)).toBeNull();
    [null, undefined, 'log', 7, {}, { topics: 'x' }].forEach((log) => expect(parseOrderActorsLog(log)).toBeNull());
  });

  it('skips a look-alike log of another contract that names a real order', () => {
    expect(parseOrderActorsLog(actors(ORDER_A, ONE_TIME, WORKER, OTHER_CONTRACT))).toBeNull();
    expect(parseOrderActorsLog(actors(ZERO, ONE_TIME, WORKER, ZERO))).toBeNull();
  });
});

describe('candidateOrdersFromLogs', () => {
  const keys = { [ONE_TIME]: 'key-of-one-time' };

  it('keeps the orders of our one-time addresses and the orders not accepted yet, each once', () => {
    const logs = [
      actors(ORDER_A, ZERO),                 // order A is created
      actors(ORDER_B, ZERO),                 // order B is created
      actors(ORDER_A, ONE_TIME),             // A is accepted by us
      actors(ORDER_A, ONE_TIME, WORKER),     // a worker commits to A
      actors(ORDER_B, SOMEBODY),             // B is accepted by somebody else
    ];
    expect(candidateOrdersFromLogs(logs, keys)).toEqual([
      { orderAddress: ORDER_A, stealthPrivateKey: 'key-of-one-time' },
      { orderAddress: ORDER_B, stealthPrivateKey: null },
    ]);
  });

  it('is not emptied by a malformed log or misled by a look-alike', () => {
    const logs = [
      { address: OTHER_CONTRACT, topics: [ORDER_ACTORS_TOPIC], data: '0x' },
      actors(ORDER_A, ZERO),
      // another contract claims that our one-time address accepted order B
      actors(ORDER_B, ONE_TIME, WORKER, OTHER_CONTRACT),
      null,
      actors(ORDER_A, ONE_TIME),
    ];
    expect(candidateOrdersFromLogs(logs, keys)).toEqual([{ orderAddress: ORDER_A, stealthPrivateKey: 'key-of-one-time' }]);
  });

  it('leaves out orders of other establishments, orders the page already has, and takes anything but a list as empty', () => {
    expect(candidateOrdersFromLogs([actors(ORDER_A, SOMEBODY)], keys)).toEqual([]);
    expect(candidateOrdersFromLogs([actors(ORDER_A, ONE_TIME), actors(ORDER_B, ONE_TIME)], keys, (address) => address === ORDER_A))
      .toEqual([{ orderAddress: ORDER_B, stealthPrivateKey: 'key-of-one-time' }]);
    expect(candidateOrdersFromLogs(undefined, keys)).toEqual([]);
    // a name of Object.prototype is not one of our addresses
    expect(candidateOrdersFromLogs([actors(ORDER_A, SOMEBODY)], {})).toEqual([]);
  });
});
