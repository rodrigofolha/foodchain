/* global BigInt */
import {
  ORDER_GAS_BUDGET, GAS_PRICE_ROOM, FUNDING_WITHDRAWAL_GAS, MERGE_WITHDRAWAL_EVENT,
  gasBudgetWei, fundingNeeded, fundingPlan, recordFunding, recordedFunding, withdrawnTo,
} from './orderFunding';
import { withGasMargin } from './oneTimeSend';

const FEE = 3000000000000000n;      // the delivery fee prepareOrder must send
const PRICE = 1500000000n;          // 1.5 gwei
const ADDRESS = '0x00000000000000000000000000000000000000E1';
const POOL = '0x00000000000000000000000000000000000000F2';

// Gas used on Sepolia since 2026-10-06 and on the previous schedule, which the main
// network and the local network have
const SEPOLIA = { prepareOrder: 492172, replacement: 276257, rating: 68187, pickup: 158707, endingUsed: 1550000, endingLowestLimit: 1782500 };
const LOCAL = { prepareOrder: 137392, replacement: 97817, rating: 58487, pickup: 68787, endingUsed: 1011986, endingLowestLimit: 1073800 };

beforeEach(() => localStorage.clear());

describe('the gas budget of an accepted order', () => {
  it('is 3,150,000 gas, withdrawn at one and a half times the gas price', () => {
    expect(ORDER_GAS_BUDGET).toBe(3150000);
    expect(GAS_PRICE_ROOM).toEqual({ times: 3n, over: 2n });
    expect(gasBudgetWei(PRICE, false)).toBe(3150000n * PRICE);
    expect(gasBudgetWei(PRICE, true)).toBe(4725000n * PRICE);
    expect(fundingNeeded(FEE, PRICE)).toBe(FEE + 4725000n * PRICE);
    expect(fundingNeeded(0, 0)).toBe(0n);
    // numbers as the libraries give them
    expect(fundingNeeded({ toString: () => FEE.toString() }, { toString: () => '1000000000' })).toBe(FEE + 4725000000000000n);
  });

  // The address must hold the whole limit of each transaction when it is sent; the top-up
  // alone (nothing left of the customer's stipend) pays for the sequence.
  const heaviest = (g, priceTimes100) => {
    let left = BigInt(ORDER_GAS_BUDGET) * 150n; // gas at the funding price, times 100
    const pay = (limit, used) => {
      if (left < BigInt(limit) * priceTimes100) return false;
      left -= BigInt(used) * priceTimes100;
      return true;
    };
    const limit = (used) => Number(withGasMargin(Math.ceil(used * 1.15))); // estimate up to 1.15 x used
    return pay(limit(g.prepareOrder), g.prepareOrder)
      && pay(limit(g.replacement), g.replacement)
      && pay(limit(g.rating), g.rating)
      && pay(limit(g.pickup), g.pickup)
      && pay(Number(withGasMargin(g.endingLowestLimit)), g.endingUsed)
      && pay(limit(g.rating), g.rating);
  };

  it('pays prepareOrder, a replacement, the pickup, an ending that inserts a note and two ratings, under either schedule', () => {
    expect(heaviest(SEPOLIA, 100n)).toBe(true);
    expect(heaviest(LOCAL, 100n)).toBe(true);
  });

  it('still pays them after the gas price rose by half, and not after it doubled on Sepolia', () => {
    expect(heaviest(SEPOLIA, 150n)).toBe(true);
    expect(heaviest(LOCAL, 150n)).toBe(true);
    expect(heaviest(SEPOLIA, 200n)).toBe(false);
  });

  it('would not be enough with 1,000,000 gas at twice the price', () => {
    const before = 2000000;
    const ending = Number(withGasMargin(SEPOLIA.endingLowestLimit));
    expect(before - SEPOLIA.prepareOrder - SEPOLIA.pickup < ending).toBe(true);
  });
});

describe('whether an order is funded already', () => {
  it('withdraws the whole funding when the pool paid nothing to the address yet', () => {
    expect(fundingPlan(0n, FEE, PRICE)).toEqual({ withdraw: FEE + 4725000n * PRICE, first: true });
    expect(fundingPlan('0', FEE, PRICE).first).toBe(true);
    expect(fundingPlan(undefined, FEE, PRICE).first).toBe(true);
  });

  it('withdraws nothing after a mined funding, also when the gas price rose by up to half', () => {
    const paid = fundingNeeded(FEE, PRICE);
    expect(fundingPlan(paid, FEE, PRICE)).toEqual({ withdraw: 0n, first: false });
    expect(fundingPlan(paid, FEE, PRICE * 14n / 10n).withdraw).toBe(0n);
    expect(fundingPlan(paid, FEE, PRICE * 3n / 2n).withdraw).toBe(0n);
    // a lower price changes nothing either
    expect(fundingPlan(paid, FEE, PRICE / 3n).withdraw).toBe(0n);
  });

  it('withdraws only what is missing, never a second funding, when the price rose by more', () => {
    const paid = fundingNeeded(FEE, PRICE);
    const now = PRICE * 164n / 100n; // a rise of 64 %
    const plan = fundingPlan(paid, FEE, now);
    expect(plan.first).toBe(false);
    expect(plan.withdraw).toBe(fundingNeeded(FEE, now) - paid + now * BigInt(FUNDING_WITHDRAWAL_GAS));
    expect(plan.withdraw < fundingNeeded(FEE, now)).toBe(true);
    // the fee is not withdrawn twice
    expect(plan.withdraw < gasBudgetWei(now, true)).toBe(true);
    // after it, at the same price, nothing more
    expect(fundingPlan(paid + plan.withdraw, FEE, now).withdraw).toBe(0n);
  });

  it('does not look at the balance: the stipend alone is never a funding', () => {
    // the customer's stipend at a high gas price can exceed the fee plus the budget; the plan
    // only knows what the pool paid
    expect(fundingPlan.length).toBe(3);
    expect(fundingPlan(0n, FEE, 50000000000n).first).toBe(true);
  });
});

describe('what the pool paid to an address', () => {
  const topic = '0x' + '0'.repeat(24) + ADDRESS.slice(2).toLowerCase();
  const word = (x) => BigInt(x).toString(16).padStart(64, '0');
  const log = (amount) => ({ data: '0x' + word(amount) + word(11) + word(22) });
  const node = (logs) => {
    const seen = [];
    return {
      seen: seen,
      utils: { keccak256: (text) => 'hash-of:' + text },
      eth: { getPastLogs: async (filter) => { seen.push(filter); if (logs instanceof Error) throw logs; return logs; } },
    };
  };

  it('is the sum of the MergeWithdrawal events of the pool to it since the deployment', async () => {
    const web3 = node([log(700), log(5)]);
    expect(await withdrawnTo(web3, POOL, ADDRESS, 1234)).toBe(705n);
    expect(web3.seen).toEqual([{ address: POOL, fromBlock: 1234, toBlock: 'latest', topics: ['hash-of:' + MERGE_WITHDRAWAL_EVENT, topic] }]);
    expect(MERGE_WITHDRAWAL_EVENT).toBe('MergeWithdrawal(address,uint256,uint256,uint256)');
    expect(await withdrawnTo(node([]), POOL, ADDRESS, 0)).toBe(0n);
  });

  it('is not guessed when the logs cannot be read', async () => {
    await expect(withdrawnTo(node(new Error('rate limited')), POOL, ADDRESS, 0)).rejects.toThrow('rate limited');
  });

  it('is at least what this browser saw mined, for a log node that is behind', async () => {
    recordFunding(ADDRESS, '700');
    expect(recordedFunding(ADDRESS.toLowerCase())).toBe(700n);
    expect(await withdrawnTo(node([]), POOL, ADDRESS, 0)).toBe(700n);
    expect(await withdrawnTo(node([log(700), log(90)]), POOL, ADDRESS, 0)).toBe(790n);
    recordFunding(ADDRESS, '90');
    expect(recordedFunding(ADDRESS)).toBe(790n);
    expect(recordedFunding(POOL)).toBe(0n);
  });
});
