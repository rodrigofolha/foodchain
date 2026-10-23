import { keccak256 } from 'web3-utils';
import {
  INFORMATION_TOPIC,
  OUTCOME_NONE, OUTCOME_LEFT_BEFORE_PICKUP, OUTCOME_LEFT_AFTER_PICKUP, OUTCOME_DELIVERED,
  uintTopic,
  orderAddressesFromLogs,
  keepChainOrders,
  commitmentsFromLogs,
  readCommitments,
  workersOfOrder,
  currentCommitment,
  customerRatingState,
  readWorkerRatings,
  outcomeText,
  detailsSentTo,
  workerNotice,
} from './orderWorkers';
import { ORDER_ACTORS_TOPIC } from './orderSecrets';

const CUSTOMER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ESTABLISHMENT = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const WORKER_1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const WORKER_2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const ZERO = '0x0000000000000000000000000000000000000000';
const ORDER_A = '0x00000000000000000000000000000000000000A1';
const ORDER_B = '0x00000000000000000000000000000000000000b2';
const FAKE = '0x00000000000000000000000000000000000000Fa';
const STORAGE = '0x00000000000000000000000000000000000000D5';

function topicOf(address) {
  return '0x' + '0'.repeat(24) + address.slice(2).toLowerCase();
}

// An OrderActors log as eth_getLogs gives it. `named` is the order address in the
// data; a real order names itself.
function actorsLog(emitter, worker, blockNumber, logIndex, named) {
  return {
    address: emitter,
    topics: [ORDER_ACTORS_TOPIC, topicOf(CUSTOMER), topicOf(ESTABLISHMENT), topicOf(worker)],
    data: topicOf(named || emitter),
    blockNumber: blockNumber,
    logIndex: logIndex || 0,
  };
}

// The logs of an order: creation, acceptance, then one log for each commitment.
function orderLogs(order, workers, firstBlock) {
  const logs = [actorsLog(order, ZERO, firstBlock), actorsLog(order, ZERO, firstBlock + 1)];
  workers.forEach((worker, i) => logs.push(actorsLog(order, worker, firstBlock + 2 + i)));
  return logs;
}

describe('topics', () => {
  it('uses the topic of Information(uint256,uint256,string,string)', () => {
    expect(INFORMATION_TOPIC).toBe(keccak256('Information(uint256,uint256,string,string)'));
  });

  it('writes an order id or a position as a 32-byte topic', () => {
    expect(uintTopic(1)).toBe('0x' + '0'.repeat(63) + '1');
    expect(uintTopic('2')).toBe('0x' + '0'.repeat(63) + '2');
    expect(uintTopic('255')).toBe('0x' + '0'.repeat(62) + 'ff');
    expect(uintTopic(7)).toHaveLength(66);
  });
});

describe('orderAddressesFromLogs', () => {
  it('gives each emitter once, in the order of the logs', () => {
    const logs = orderLogs(ORDER_A, [WORKER_1], 10).concat(orderLogs(ORDER_B, [], 20));
    expect(orderAddressesFromLogs(logs)).toEqual([ORDER_A, ORDER_B]);
  });

  it('ignores a log that names another contract, another event and malformed logs', () => {
    const forged = actorsLog(FAKE, WORKER_1, 5, 0, ORDER_A);
    const otherEvent = actorsLog(ORDER_B, ZERO, 6);
    otherEvent.topics[0] = '0x' + '11'.repeat(32);
    expect(orderAddressesFromLogs([forged, otherEvent, null, {}, { address: ORDER_A, topics: [ORDER_ACTORS_TOPIC], data: '0x' }])).toEqual([]);
    expect(orderAddressesFromLogs(undefined)).toEqual([]);
  });

  it('still lists a look-alike contract that names itself: only Chain can tell', () => {
    expect(orderAddressesFromLogs([actorsLog(FAKE, ZERO, 5)])).toEqual([FAKE]);
  });
});

describe('keepChainOrders', () => {
  // Chain.isOrder: true for `orders`, a failed call for `failing`
  function fakeChain(orders, failing, calls) {
    return {
      methods: {
        isOrder: (address) => ({
          call: async () => {
            calls.push(address);
            if (failing.indexOf(address) !== -1) throw new Error('rpc down');
            return orders.indexOf(address) !== -1;
          },
        }),
      },
    };
  }

  it('keeps only the addresses Chain created, in the same order', async () => {
    const calls = [];
    await expect(keepChainOrders(fakeChain([ORDER_A, ORDER_B], [], calls), [ORDER_A, FAKE, ORDER_B]))
      .resolves.toEqual([ORDER_A, ORDER_B]);
    expect(calls).toEqual([ORDER_A, FAKE, ORDER_B]);
  });

  it('drops an address whose check could not be made', async () => {
    await expect(keepChainOrders(fakeChain([ORDER_A, ORDER_B], [ORDER_B], []), [ORDER_A, ORDER_B]))
      .resolves.toEqual([ORDER_A]);
  });

  it('keeps nothing when the answer is not the boolean true', async () => {
    const chain = { methods: { isOrder: () => ({ call: async () => 'true' }) } };
    await expect(keepChainOrders(chain, [ORDER_A])).resolves.toEqual([]);
  });

  it('checks every address of a long list', async () => {
    const many = [];
    for (let i = 0; i < 12; i++) many.push('0x' + (1000 + i).toString(16).padStart(40, '0'));
    await expect(keepChainOrders(fakeChain(many, [], []), many)).resolves.toEqual(many);
    await expect(keepChainOrders(fakeChain(many, [], []), [])).resolves.toEqual([]);
  });
});

describe('commitmentsFromLogs', () => {
  it('gives no commitment for an order nobody committed to', () => {
    expect(commitmentsFromLogs(orderLogs(ORDER_A, [], 10), ORDER_A)).toEqual([]);
  });

  it('gives the first and the second worker with their positions and blocks', () => {
    const logs = orderLogs(ORDER_A, [WORKER_1, WORKER_2], 10);
    expect(commitmentsFromLogs(logs, ORDER_A.toLowerCase())).toEqual([
      { worker: WORKER_1, position: 1, blockNumber: 12 },
      { worker: WORKER_2, position: 2, blockNumber: 13 },
    ]);
  });

  it('counts the same account twice when it committed twice', () => {
    const commitments = commitmentsFromLogs(orderLogs(ORDER_A, [WORKER_1, WORKER_1], 10), ORDER_A);
    expect(commitments.map(c => c.position)).toEqual([1, 2]);
    expect(workersOfOrder(commitments, WORKER_1)).toEqual([WORKER_1]);
  });

  it('orders by block and log index, whatever the order of the answer', () => {
    const logs = [actorsLog(ORDER_A, WORKER_2, 30, 4), actorsLog(ORDER_A, WORKER_1, 30, 1), actorsLog(ORDER_A, ZERO, 10)];
    expect(commitmentsFromLogs(logs, ORDER_A).map(c => c.worker)).toEqual([WORKER_1, WORKER_2]);
  });

  it('takes only the logs this order emitted', () => {
    const logs = orderLogs(ORDER_A, [WORKER_1], 10)
      .concat(orderLogs(ORDER_B, [WORKER_2], 20))
      // another contract that names this order
      .concat([actorsLog(FAKE, WORKER_2, 15, 0, ORDER_A)]);
    expect(commitmentsFromLogs(logs, ORDER_A)).toEqual([{ worker: WORKER_1, position: 1, blockNumber: 12 }]);
    expect(commitmentsFromLogs(logs, undefined)).toEqual([]);
    expect(commitmentsFromLogs(undefined, ORDER_A)).toEqual([]);
  });

  it('readCommitments asks for the logs of the order only', async () => {
    const asked = [];
    const logWeb3 = { eth: { getPastLogs: async (filter) => { asked.push(filter); return orderLogs(ORDER_A, [WORKER_1], 10); } } };
    await expect(readCommitments(logWeb3, ORDER_A, 9)).resolves.toEqual([{ worker: WORKER_1, position: 1, blockNumber: 12 }]);
    expect(asked).toEqual([{ address: ORDER_A, topics: [ORDER_ACTORS_TOPIC], fromBlock: 9, toBlock: 'latest' }]);
  });
});

describe('workersOfOrder / currentCommitment', () => {
  const commitments = commitmentsFromLogs(orderLogs(ORDER_A, [WORKER_1, WORKER_2], 10), ORDER_A);

  it('lists every worker once and adds the committed worker the logs do not name', () => {
    expect(workersOfOrder(commitments, WORKER_2)).toEqual([WORKER_1, WORKER_2]);
    expect(workersOfOrder(commitments.slice(0, 1), WORKER_2)).toEqual([WORKER_1, WORKER_2]);
    expect(workersOfOrder(undefined, WORKER_1)).toEqual([WORKER_1]);
    expect(workersOfOrder(undefined, ZERO)).toEqual([]);
    expect(workersOfOrder([], undefined)).toEqual([]);
  });

  it('gives the last commitment only if it is the one of the worker committed now', () => {
    expect(currentCommitment(commitments, WORKER_2).position).toBe(2);
    expect(currentCommitment(commitments.slice(0, 1), WORKER_1).position).toBe(1);
    // the logs are behind the chain: the second commitment is not in them yet
    expect(currentCommitment(commitments.slice(0, 1), WORKER_2)).toBeNull();
    // reopened order: nobody is committed
    expect(currentCommitment(commitments.slice(0, 1), ZERO)).toBeNull();
    expect(currentCommitment([], WORKER_1)).toBeNull();
    expect(currentCommitment(undefined, WORKER_1)).toBeNull();
  });
});

describe('customerRatingState', () => {
  // orderRatings answers as web3 gives them: numeric keys, values as strings
  const answer = (outcome, byClient, byEstablishment) => ({ 0: String(outcome), 1: String(byClient), 2: String(byEstablishment) });

  it('lets the customer rate a worker who delivered, once', () => {
    expect(customerRatingState(WORKER_1, answer(OUTCOME_DELIVERED, 0, 0)))
      .toEqual({ worker: WORKER_1, known: true, outcome: 3, score: 0, rated: false, canRate: true });
    expect(customerRatingState(WORKER_1, answer(OUTCOME_DELIVERED, 4, 0)))
      .toEqual({ worker: WORKER_1, known: true, outcome: 3, score: 4, rated: true, canRate: false });
  });

  it('lets the customer rate a worker who left after pickup, once', () => {
    expect(customerRatingState(WORKER_1, answer(OUTCOME_LEFT_AFTER_PICKUP, 0, 0)).canRate).toBe(true);
    expect(customerRatingState(WORKER_1, answer(OUTCOME_LEFT_AFTER_PICKUP, 1, 0)).canRate).toBe(false);
    expect(customerRatingState(WORKER_1, answer(OUTCOME_LEFT_AFTER_PICKUP, 1, 0)).rated).toBe(true);
  });

  it('does not let the customer rate a worker who left before pickup, or one the order reported nothing about', () => {
    expect(customerRatingState(WORKER_1, answer(OUTCOME_LEFT_BEFORE_PICKUP, 0, 0)).canRate).toBe(false);
    expect(customerRatingState(WORKER_1, answer(OUTCOME_NONE, 0, 0)).canRate).toBe(false);
  });

  it("is not changed by the establishment's rating", () => {
    expect(customerRatingState(WORKER_1, answer(OUTCOME_DELIVERED, 0, 5)).canRate).toBe(true);
    expect(customerRatingState(WORKER_1, answer(OUTCOME_DELIVERED, 0, 5)).rated).toBe(false);
    expect(customerRatingState(WORKER_1, answer(OUTCOME_LEFT_BEFORE_PICKUP, 0, 2)).rated).toBe(false);
  });

  it('allows nothing when the answer is missing or unreadable', () => {
    const unknown = { worker: WORKER_1, known: false, outcome: null, score: 0, rated: false, canRate: false };
    expect(customerRatingState(WORKER_1, null)).toEqual(unknown);
    expect(customerRatingState(WORKER_1, {})).toEqual(unknown);
    expect(customerRatingState(WORKER_1, { 0: 'x', 1: '0' })).toEqual(unknown);
  });

  it('says what each worker did', () => {
    expect(outcomeText(OUTCOME_DELIVERED)).toMatch(/delivered/);
    expect(outcomeText(OUTCOME_LEFT_AFTER_PICKUP)).toMatch(/after pickup/);
    expect(outcomeText(OUTCOME_LEFT_BEFORE_PICKUP)).toMatch(/before pickup/);
    expect(outcomeText(OUTCOME_NONE)).toBeNull();
    expect(outcomeText(null)).toBeNull();
  });

  it('readWorkerRatings asks for each worker of the order and survives a failed read', async () => {
    const asked = [];
    const reputation = {
      methods: {
        orderRatings: (order, worker) => ({
          call: async () => {
            asked.push([order, worker]);
            if (worker === WORKER_2) throw new Error('rpc down');
            return answer(OUTCOME_LEFT_AFTER_PICKUP, 0, 3);
          },
        }),
      },
    };
    const states = await readWorkerRatings(reputation, ORDER_A, [WORKER_1, WORKER_2]);
    expect(asked).toEqual([[ORDER_A, WORKER_1], [ORDER_A, WORKER_2]]);
    expect(states[0]).toEqual({ worker: WORKER_1, known: true, outcome: 2, score: 0, rated: false, canRate: true });
    expect(states[1]).toEqual({ worker: WORKER_2, known: false, outcome: null, score: 0, rated: false, canRate: false });
  });
});

describe('detailsSentTo', () => {
  function fakeLogWeb3(logs, asked) {
    return { eth: { getPastLogs: async (filter) => { asked.push(filter); return logs; } } };
  }

  it('filters by the Storage address, the order id and the position of the worker', async () => {
    const asked = [];
    await expect(detailsSentTo(fakeLogWeb3([{ address: STORAGE }], asked), STORAGE, '7', 2, 120)).resolves.toBe(true);
    expect(asked).toEqual([{
      address: STORAGE,
      topics: [INFORMATION_TOPIC, uintTopic(7), uintTopic(2)],
      fromBlock: 120,
      toBlock: 'latest',
    }]);
  });

  it('is false when nothing was sent for that position', async () => {
    await expect(detailsSentTo(fakeLogWeb3([], []), STORAGE, 7, 1, 0)).resolves.toBe(false);
  });

  it('does not count a log of another contract, if a node returns one', async () => {
    await expect(detailsSentTo(fakeLogWeb3([{ address: FAKE }], []), STORAGE, 7, 1, 0)).resolves.toBe(false);
  });

  it('lets a failed read reach the caller', async () => {
    const logWeb3 = { eth: { getPastLogs: async () => { throw new Error('rpc down'); } } };
    await expect(detailsSentTo(logWeb3, STORAGE, 7, 1, 0)).rejects.toThrow('rpc down');
  });
});

describe('workerNotice', () => {
  const one = commitmentsFromLogs(orderLogs(ORDER_A, [WORKER_1], 10), ORDER_A);
  const two = commitmentsFromLogs(orderLogs(ORDER_A, [WORKER_1, WORKER_2], 10), ORDER_A);

  it('says nothing for an order no worker committed to yet, and outside PREPARATION and WAITING', () => {
    expect(workerNotice('PREPARATION', [], ZERO, null)).toBeNull();
    expect(workerNotice('PREPARATION', undefined, ZERO, null)).toBeNull();
    expect(workerNotice('ORDERED', [], ZERO, null)).toBeNull();
    expect(workerNotice('DISPATCHED', one, WORKER_1, true)).toBeNull();
    expect(workerNotice('CONCLUDED', two, WORKER_2, true)).toBeNull();
  });

  it('says that a reopened order is offered again and that the address must be sent again', () => {
    const text = workerNotice('PREPARATION', one, ZERO, null);
    expect(text).toMatch(/left it before pickup/);
    expect(text).toMatch(/offered again/);
    expect(text).toMatch(/payment stays/);
    expect(text).toMatch(/send your address again/);
  });

  it('asks for the address again when a second worker committed', () => {
    expect(workerNotice('WAITING', two, WORKER_2, false)).toMatch(/second delivery worker committed.*Send your address again/);
    expect(workerNotice('WAITING', two, WORKER_2, null)).toMatch(/If you have not sent your address since they committed/);
    expect(workerNotice('WAITING', two, WORKER_2, false)).toMatch(/the second one cannot open it/);
  });

  it('says so when the address was sent to the second worker', () => {
    const text = workerNotice('WAITING', two, WORKER_2, true);
    expect(text).toMatch(/second delivery worker/);
    expect(text).toMatch(/Your address was sent to them/);
    expect(text).not.toMatch(/again\./);
  });

  it('tells whether the address was sent to a first worker', () => {
    expect(workerNotice('WAITING', one, WORKER_1, false)).toMatch(/Send them your address/);
    expect(workerNotice('WAITING', one, WORKER_1, true)).toBe('Your address was sent to the delivery worker.');
    expect(workerNotice('WAITING', one, WORKER_1, null)).toBeNull();
  });

  it('does not call a worker the second one when the logs do not show their commitment', () => {
    // logs behind the chain: they hold the first commitment, the chain names WORKER_2
    expect(workerNotice('WAITING', one, WORKER_2, null)).toBeNull();
    expect(workerNotice('WAITING', undefined, WORKER_1, null)).toBeNull();
  });
});
