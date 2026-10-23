import Web3 from 'web3';
import {
  ORDER_ACTORS_TOPIC, LEFT_BEFORE_PICKUP, LEFT_AFTER_PICKUP, DELIVERED,
  orderCommitments, orderWorkers, fetchOrderCommitments, replacementState, outcomeText,
  ratingLine, fetchRatingLines, workerRecord, workerRecordText, shortAddress,
} from './orderRatings';
import { CHAIN_ABI, REPUTATION_ABI } from '../services/config';

const A = '0x00000000000000000000000000000000000000a1';
const B = '0x00000000000000000000000000000000000000b2';
const CLIENT = '0x00000000000000000000000000000000000000c3';
const SHOP = '0x00000000000000000000000000000000000000d4';
const ORDER = '0x00000000000000000000000000000000000000e5';
const ZERO = '0x0000000000000000000000000000000000000000';

const topic = (address) => '0x' + '0'.repeat(24) + address.slice(2);
const actors = (worker, blockNumber, logIndex = 0, shop = SHOP) => ({
  address: ORDER, blockNumber, logIndex,
  topics: [ORDER_ACTORS_TOPIC, topic(CLIENT), topic(shop), topic(worker)],
  data: '0x' + '0'.repeat(24) + ORDER.slice(2),
});

describe('the ABI the helpers rely on', () => {
  const web3 = new Web3();
  const entry = (abi, name) => abi.find((e) => e.name === name);

  it('OrderActors has the topic used here', () => {
    expect(web3.utils.keccak256('OrderActors(address,address,address,address)')).toBe(ORDER_ACTORS_TOPIC);
  });

  it('Chain has rateOrder(order, worker, score), prepareOrder with four arguments and isOrder', () => {
    expect(entry(CHAIN_ABI, 'rateOrder').inputs.map((i) => i.type)).toEqual(['address', 'address', 'uint256']);
    expect(entry(CHAIN_ABI, 'prepareOrder').inputs.map((i) => i.type)).toEqual(['address', 'uint256', 'uint256', 'uint256']);
    expect(entry(CHAIN_ABI, 'prepareOrder').inputs[1].name).toBe('_paymentCommitment');
    expect(entry(CHAIN_ABI, 'isOrder').inputs.map((i) => i.type)).toEqual(['address']);
    expect(entry(CHAIN_ABI, 'callSecondDeliveryman').inputs.map((i) => i.type)).toEqual(['address']);
    expect(entry(CHAIN_ABI, 'submitRating')).toBeUndefined();
  });

  it('GlobalReputation has orderRatings(order, worker) and the five-field workers record', () => {
    expect(entry(REPUTATION_ABI, 'orderRatings').inputs.map((i) => i.type)).toEqual(['address', 'address']);
    expect(entry(REPUTATION_ABI, 'orderRatings').outputs.map((o) => o.name)).toEqual(['outcome', 'byClient', 'byEstablishment']);
    expect(entry(REPUTATION_ABI, 'workers').outputs.map((o) => o.name))
      .toEqual(['totalScore', 'totalRatings', 'completedOrders', 'leftOrders', 'ratingsAfterLeaving']);
    expect(entry(REPUTATION_ABI, 'usedNullifiers')).toBeUndefined();
    expect(entry(REPUTATION_ABI, 'mergeWithdraw').inputs).toHaveLength(9);
  });
});

describe('orderCommitments and orderWorkers', () => {
  it('takes the third indexed address of each commitment, in chain order', () => {
    const logs = [actors(B, 12, 1), actors(ZERO, 10), actors(ZERO, 11), actors(A, 12, 0)];
    expect(orderCommitments(logs)).toEqual([A, B]);
    expect(orderWorkers(orderCommitments(logs))).toEqual([A, B]);
  });

  it('counts two commitments of the same account, and lists the worker once', () => {
    const logs = [actors(ZERO, 10), actors(A, 12), actors(A, 15)];
    expect(orderCommitments(logs)).toEqual([A, A]);
    expect(orderWorkers(orderCommitments(logs))).toEqual([A]);
    expect(orderWorkers(null)).toEqual([]);
  });

  it('ignores other events and an order nobody committed to', () => {
    const other = Object.assign(actors(A, 12), { topics: ['0x' + '1'.repeat(64), topic(CLIENT), topic(SHOP), topic(A)] });
    expect(orderCommitments([other, actors(ZERO, 10)])).toEqual([]);
    expect(orderCommitments(undefined)).toEqual([]);
  });

  it('asks for the logs of the order itself', async () => {
    const asked = [];
    const logWeb3 = { eth: { getPastLogs: async (filter) => { asked.push(filter); return [actors(A, 12)]; } } };
    await expect(fetchOrderCommitments(logWeb3, ORDER, 77)).resolves.toEqual([A]);
    expect(asked).toEqual([{ address: ORDER, fromBlock: 77, toBlock: 'latest', topics: [ORDER_ACTORS_TOPIC] }]);
  });
});

describe('replacementState', () => {
  it('allows the replacement of the first worker in WAITING only', () => {
    expect(replacementState('WAITING', [A])).toBe('allowed');
    expect(replacementState('PREPARATION', [A])).toBe('no');
    expect(replacementState('DISPATCHED', [A])).toBe('no');
  });

  it('refuses it for a second worker, also when the first one left on their own or is the same account', () => {
    expect(replacementState('WAITING', [A, B])).toBe('second-worker');
    expect(replacementState('WAITING', [A, A])).toBe('second-worker');
  });

  it('leaves the decision to the contract while the commitments are not known', () => {
    expect(replacementState('WAITING', null)).toBe('unknown');
  });
});

describe('ratingLine', () => {
  it('has no line for a worker the order reported nothing about', () => {
    expect(ratingLine(A, { outcome: '0', byClient: '0', byEstablishment: '0' })).toBeNull();
    expect(ratingLine(A, undefined)).toBeNull();
  });

  it('offers a rating for a delivery and for a leaving before or after pickup', () => {
    [LEFT_BEFORE_PICKUP, LEFT_AFTER_PICKUP, DELIVERED].forEach((outcome) => {
      expect(ratingLine(A, { outcome: String(outcome), byClient: '0', byEstablishment: '0' }))
        .toEqual({ worker: A, outcome: outcome, score: 0, canRate: true });
    });
  });

  it('shows the score once the establishment has rated, whatever the customer did', () => {
    expect(ratingLine(A, { 0: '3', 1: '0', 2: '4' })).toEqual({ worker: A, outcome: 3, score: 4, canRate: false });
    expect(ratingLine(A, { outcome: '3', byClient: '5', byEstablishment: '0' }).canRate).toBe(true);
  });

  it('reads the lines of the workers of an order', async () => {
    const asked = [];
    const answers = { [A]: { outcome: '1', byClient: '0', byEstablishment: '2' }, [B]: { outcome: '3', byClient: '0', byEstablishment: '0' } };
    const reputation = { methods: { orderRatings: (order, worker) => ({ call: async () => { asked.push([order, worker]); return answers[worker] || { outcome: '0' }; } }) } };
    await expect(fetchRatingLines(reputation, ORDER, [A, B, CLIENT])).resolves.toEqual([
      { worker: A, outcome: 1, score: 2, canRate: false },
      { worker: B, outcome: 3, score: 0, canRate: true },
    ]);
    expect(asked).toEqual([[ORDER, A], [ORDER, B], [ORDER, CLIENT]]);
  });

  it('names the outcomes', () => {
    expect([0, 1, 2, 3].map(outcomeText)).toEqual(['nothing reported', 'left before pickup', 'left after pickup', 'delivered']);
  });
});

describe('workerRecord', () => {
  it('reads the five fields by name or by position', () => {
    const expected = { average: 4.5, ratings: 2, deliveries: 3, left: 1, ratingsAfterLeaving: 1 };
    expect(workerRecord({ totalScore: '9', totalRatings: '2', completedOrders: '3', leftOrders: '1', ratingsAfterLeaving: '1' })).toEqual(expected);
    expect(workerRecord({ 0: '9', 1: '2', 2: '3', 3: '1', 4: '1' })).toEqual(expected);
  });

  it('has no average without ratings', () => {
    expect(workerRecord({ 0: '0', 1: '0', 2: '0', 3: '0', 4: '0' })).toEqual({ average: null, ratings: 0, deliveries: 0, left: 0, ratingsAfterLeaving: 0 });
    expect(workerRecord(undefined).average).toBeNull();
  });

  it('writes the record in one line', () => {
    expect(workerRecordText(workerRecord({ 0: '9', 1: '2', 2: '3', 3: '1', 4: '1' })))
      .toBe('4.5★ · 2 ratings · 3 deliveries · left 1 order · 1 rating received after leaving');
    expect(workerRecordText(workerRecord({ 0: '0', 1: '0', 2: '1', 3: '2', 4: '0' })))
      .toBe('No ratings yet · 1 delivery · left 2 orders · 0 ratings received after leaving');
  });
});

describe('shortAddress', () => {
  it('keeps the start and the end', () => {
    expect(shortAddress(A)).toBe('0x0000...00a1');
    expect(shortAddress('')).toBe('');
  });
});
