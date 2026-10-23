/* global BigInt */
import {
  CASHOUT_POLICY, denominationWei, nextWithdrawalStep, planAmounts, cashoutStatus, planCashout, planWithdrawAll,
  getCashoutLedger, getRevenueSummary, getCashoutState, hasPendingCashouts, runCashout,
  checkPendingCashouts, isPendingWithdrawalError, addPendingWithdrawal, notePendingTransaction,
  settlePendingWithdrawal, dropPendingWithdrawal, setAsidePendingCashouts, countSetAsideCashouts,
} from './cashout';
import {
  NOTE_ADDED_TOPIC, storePaymentNote, getPaymentNotes, getUnspentNotes, getUnspentBalance,
  computeNullifierHash, computePaymentCommitment, computePaymentLeaf, fetchTreeState, generateMergeWithdrawProof,
} from './zkWithdraw';
import { deploymentKey } from './deploymentStorage';
import { recordedFunding, fundingPlan } from './orderFunding';

// The proof and the log scan are replaced; the note records and the planning are the real ones.
jest.mock('./zkWithdraw', () => {
  const actual = jest.requireActual('./zkWithdraw');
  let counter = 1000;
  return Object.assign({}, actual, {
    fetchTreeState: jest.fn(),
    generateMergeWithdrawProof: jest.fn(),
    generateNoteSecrets: () => ({ nullifier: BigInt(++counter), trapdoor: BigInt(++counter) }),
  });
});

const usd = (x) => BigInt(Math.round(x * 100)) * 10n ** 13n;
const D = usd(10);
const POLICY = { denominationUsd: 10, everyNotes: 5 };
let seq = 0;
const note = (amount) => {
  seq += 1;
  return {
    nullifier: String(seq), trapdoor: String(seq + 500), amount: amount.toString(), leafIndex: seq,
    commitment: computePaymentCommitment(seq, seq + 500).toString(), spent: false,
  };
};
const sum = (notes) => notes.reduce((s, n) => s + BigInt(n.amount), 0n);
const stateOf = (revenue, extra) => Object.assign(
  { revenueCount: revenue.length, revenueWei: sum(revenue).toString(), countedNotes: 0, cashedOutWei: '0', open: false }, extra);

// Walks a plan as the pool would: every step spends notes that exist at that point (one or two,
// never the same twice) and conserves value. Returns what was paid out and the notes left.
function walk(notes, steps) {
  let pool = notes.slice();
  const paid = [];
  steps.forEach((step, i) => {
    const inputs = [step.note1].concat(step.note2 ? [step.note2] : []);
    expect(inputs.length).toBeLessThanOrEqual(2);
    inputs.forEach((n) => expect(pool).toContain(n));
    expect(new Set(inputs).size).toBe(inputs.length);
    expect(sum(inputs)).toBe(step.withdrawAmount + step.changeAmount);
    expect(step.changeAmount >= 0n).toBe(true);
    pool = pool.filter((n) => !inputs.includes(n));
    // the change of step i is the planned note a later step may spend
    const later = steps.slice(i + 1).reduce((all, s) => all.concat([s.note1, s.note2]), [])
      .find((n) => n && n.planned && n.nullifier === 'change-of-step-' + (i + 1));
    if (step.changeAmount > 0n) pool.push(later || { planned: true, amount: step.changeAmount.toString() });
    if (step.type === 'withdraw') paid.push(step.withdrawAmount);
    else expect(step.withdrawAmount).toBe(0n);
  });
  return { paid: paid, pool: pool };
}

describe('policy', () => {
  it('defaults to the values measured in the paper: 10 currency units, every 5 revenue notes', () => {
    expect(CASHOUT_POLICY).toEqual({ denominationUsd: 10, everyNotes: 5 });
    // 1 U$ = 10^15 wei
    expect(denominationWei(CASHOUT_POLICY)).toBe(10n ** 16n);
    expect(denominationWei({ denominationUsd: 2.5 })).toBe(25n * 10n ** 14n);
  });
});

describe('nextWithdrawalStep', () => {
  it('spends the smallest note that covers the amount, with the dummy note', () => {
    const a = note(usd(32.17)), b = note(usd(12.4)), c = note(usd(7.05));
    expect(nextWithdrawalStep([a, b, c], D)).toEqual({ type: 'withdraw', note1: b, note2: null, withdrawAmount: D, changeAmount: usd(2.4) });
    expect(nextWithdrawalStep([b], usd(12.4))).toEqual({ type: 'withdraw', note1: b, note2: null, withdrawAmount: usd(12.4), changeAmount: 0n });
  });

  it('merges the two largest notes into the withdrawal when no single note covers it', () => {
    const a = note(usd(6)), b = note(usd(3)), c = note(usd(7));
    expect(nextWithdrawalStep([a, b, c], D)).toEqual({ type: 'withdraw', note1: c, note2: a, withdrawAmount: D, changeAmount: usd(3) });
  });

  it('starts with a pure merge when the two largest notes do not cover it', () => {
    const a = note(usd(4)), b = note(usd(3)), c = note(usd(2)), d = note(usd(2));
    expect(nextWithdrawalStep([d, c, b, a], D)).toEqual({ type: 'merge', note1: a, note2: b, withdrawAmount: 0n, changeAmount: usd(7) });
  });

  it('returns null when the notes do not hold the amount', () => {
    expect(nextWithdrawalStep([note(usd(4)), note(usd(5.99))], D)).toBeNull();
    expect(nextWithdrawalStep([], D)).toBeNull();
    expect(nextWithdrawalStep([note(usd(40))], 0)).toBeNull();
  });
});

describe('planCashout', () => {
  it('does nothing below the threshold of new revenue notes', () => {
    const revenue = [note(usd(40)), note(usd(35)), note(usd(28)), note(usd(51))];
    expect(planCashout(revenue, POLICY, stateOf(revenue))).toEqual([]);
    expect(cashoutStatus(revenue, POLICY, stateOf(revenue))).toMatchObject({ due: false, newNotes: 4, withdrawals: 15 });
    // notes counted by an earlier cash-out are not new
    const more = revenue.concat([note(usd(20)), note(usd(20))]);
    expect(planCashout(more, POLICY, stateOf(more, { countedNotes: 2 }))).toEqual([]);
    expect(planCashout(more, POLICY, stateOf(more, { countedNotes: 1 })).length).toBeGreaterThan(0);
  });

  it('pays out one denomination per withdrawal and leaves the remainder in the pool', () => {
    // unequal notes with wei-level digits, as the gas stipend leaves them
    const revenue = [usd(32.17) + 1234567n, usd(12.4) - 800000n, usd(7.05), usd(25) + 1n, usd(3.3)].map(note);
    const state = stateOf(revenue);
    const steps = planCashout(revenue, POLICY, state);
    const { paid, pool } = walk(revenue, steps);

    expect(paid).toHaveLength(7); // 79.92 -> 7 x 10
    paid.forEach((amount) => expect(amount).toBe(D));
    expect(sum(pool) + D * 7n).toBe(sum(revenue));
    expect(sum(pool) < D).toBe(true);
    expect(cashoutStatus(revenue, POLICY, state)).toMatchObject({
      due: true, withdrawals: 7, cashoutWei: D * 7n, leftoverWei: sum(revenue) - D * 7n, poolWei: sum(revenue),
    });
  });

  it('merges small notes two at a time until a withdrawal fits', () => {
    const revenue = [usd(4), usd(3), usd(2), usd(2), usd(1.5)].map(note);
    const steps = planCashout(revenue, POLICY, stateOf(revenue));
    expect(steps.map((s) => s.type)).toEqual(['merge', 'merge', 'withdraw']);
    expect(steps[1].note1.planned).toBe(true); // the change of the first merge
    expect(steps[2].note2).not.toBeNull();     // 9 + 2: two notes, no dummy
    const { paid, pool } = walk(revenue, steps);
    expect(paid).toEqual([D]);
    expect(sum(pool)).toBe(usd(2.5));
  });

  it('uses the dummy note when one note covers the denomination', () => {
    const revenue = [usd(11), usd(11), usd(11), usd(11), usd(11)].map(note);
    const steps = planCashout(revenue, POLICY, stateOf(revenue));
    expect(steps.slice(0, 5).map((s) => s.note2)).toEqual([null, null, null, null, null]);
    // the five leftovers of 1 are merged into nothing: 5 < 10
    expect(walk(revenue, steps).paid).toHaveLength(5);
    expect(steps).toHaveLength(5);
  });

  it('cashes out revenue only: deposits stay in the pool', () => {
    const deposit = note(usd(500));
    const revenue = [usd(6), usd(5), usd(4), usd(4), usd(4)].map(note);
    const steps = planCashout([deposit].concat(revenue), POLICY, stateOf(revenue));
    const { paid, pool } = walk([deposit].concat(revenue), steps);
    expect(paid).toEqual([D, D]); // 23 of revenue, not 523
    expect(sum(pool)).toBe(usd(503));
  });

  it('never plans more than the pool holds, nor what was already cashed out', () => {
    const revenue = [usd(30), usd(30), usd(30), usd(30), usd(30)].map(note);
    // most of the revenue was spent on collateral since: 35 left
    const left = [note(usd(35))];
    expect(walk(left, planCashout(left, POLICY, stateOf(revenue))).paid).toEqual([D, D, D]);
    const state = stateOf(revenue, { cashedOutWei: usd(140).toString() });
    expect(cashoutStatus(revenue, POLICY, state)).toMatchObject({ cashableWei: usd(10), withdrawals: 1 });
    expect(planCashout(revenue, POLICY, stateOf(revenue, { cashedOutWei: usd(141).toString() }))).toEqual([]);
    expect(cashoutStatus(revenue, POLICY, stateOf(revenue, { cashedOutWei: usd(900).toString() })).cashableWei).toBe(0n);
  });

  it('gives the same plan for the same notes in any order', () => {
    const revenue = [usd(8), usd(8), usd(8), usd(13), usd(13)].map(note);
    const shape = (steps) => steps.map((s) => [s.type, s.note1.nullifier, s.note2 && s.note2.nullifier, s.changeAmount.toString()]);
    expect(shape(planCashout(revenue.slice().reverse(), POLICY, stateOf(revenue)))).toEqual(shape(planCashout(revenue, POLICY, stateOf(revenue))));
  });

  it('resumes an interrupted plan: the rest is still due, with the same withdrawals', () => {
    const revenue = [usd(21.5), usd(14), usd(9), usd(6), usd(3)].map(note);
    const full = planCashout(revenue, POLICY, stateOf(revenue));
    expect(full.filter((s) => s.type === 'withdraw')).toHaveLength(5);

    // the first two steps were mined, then the run stopped
    let notes = revenue.slice();
    let cashedOut = 0n;
    full.slice(0, 2).forEach((step) => {
      notes = notes.filter((n) => n !== step.note1 && n !== step.note2);
      if (step.changeAmount > 0n) notes.push(note(step.changeAmount));
      cashedOut += step.withdrawAmount;
    });
    const resumed = stateOf(revenue, { countedNotes: 5, cashedOutWei: cashedOut.toString(), open: true });
    expect(cashoutStatus(notes, POLICY, resumed)).toMatchObject({ newNotes: 0, due: true });
    const rest = planCashout(notes, POLICY, resumed);
    const amounts = (steps) => steps.map((s) => [s.type, s.withdrawAmount, s.changeAmount]);
    expect(amounts(rest)).toEqual(amounts(full.slice(2)));

    const { paid, pool } = walk(notes, rest);
    expect(cashedOut + sum(paid.map((a) => ({ amount: a }))) + sum(pool)).toBe(sum(revenue));

    // once finished it is closed: nothing until five more notes arrive
    const closed = stateOf(revenue, { countedNotes: 5, cashedOutWei: (D * 5n).toString(), open: false });
    expect(planCashout(pool.map((n) => note(n.amount)), POLICY, closed)).toEqual([]);
  });
});

describe('planWithdrawAll and planAmounts', () => {
  it('merges everything and pays the exact total in one withdrawal', () => {
    const notes = [usd(4), usd(3), usd(2), usd(50)].map(note);
    const steps = planWithdrawAll(notes);
    expect(steps.map((s) => s.type)).toEqual(['merge', 'merge', 'withdraw']);
    const { paid, pool } = walk(notes, steps);
    expect(paid).toEqual([usd(59)]);
    expect(pool).toEqual([]);
    expect(planWithdrawAll([])).toEqual([]);
  });

  it('stops when an amount cannot be paid', () => {
    const notes = [note(usd(15))];
    expect(planAmounts(notes, [D, D]).map((s) => s.withdrawAmount)).toEqual([D]);
  });
});

// ─── Storage and runner ──────────────────────────────────────────────────────

const pad = (v) => BigInt(v).toString(16).padStart(64, '0');
const DUMMY_HASH = computeNullifierHash(0n, 0n).toString();
const ACCOUNT = '0x00000000000000000000000000000000000000e1';

// A stand-in for the pool: spent set, leaves, and what each mergeWithdraw paid.
function fakePool() {
  const pool = { spent: new Set(), leaves: [], paid: [], failEstimate: null, failSend: null, mineOnFailure: false };
  const mine = (args) => {
    [args[2], args[3]].forEach((h) => { if (h !== DUMMY_HASH) pool.spent.add(h); });
    pool.leaves.push(args[4]);
    pool.paid.push({ to: args[0], amount: args[1] });
    const index = pool.leaves.length - 1;
    return { transactionHash: '0xtx' + pool.paid.length, gasUsed: 2000000, events: { NoteAdded: { raw: { topics: [NOTE_ADDED_TOPIC], data: '0x' + pad(index) + pad(args[4]) } } } };
  };
  pool.contract = {
    methods: {
      spentNoteNullifiers: (h) => ({ call: async () => pool.spent.has(h) }),
      isKnownNoteRoot: () => ({ call: async () => true }),
      getNoteTreeInfo: () => ({ call: async () => ({ 0: String(pool.leaves.length + 1) }) }),
      mergeWithdraw: (...args) => ({
        estimateGas: async () => {
          if (args[2] !== DUMMY_HASH && pool.spent.has(args[2])) throw new Error('Note 1 already spent');
          if (pool.failEstimate) throw pool.failEstimate;
          return 1900000;
        },
        send: async () => {
          if (pool.failSend) {
            const err = pool.failSend;
            pool.failSend = null;
            if (pool.mineOnFailure) mine(args);
            throw err;
          }
          return mine(args);
        },
      }),
    },
  };
  fetchTreeState.mockImplementation(async () => ({ allLeaves: pool.leaves.slice(), root: BigInt(pool.leaves.length + 1) }));
  generateMergeWithdrawProof.mockImplementation(async (p) => {
    const change = BigInt(p.note1.amount) + BigInt(p.note2.amount) - BigInt(p.withdrawAmount);
    const leaf = computePaymentLeaf(computePaymentCommitment(p.changeSecrets.nullifier, p.changeSecrets.trapdoor), change);
    return {
      proof: { a: ['1', '2'], b: [['1', '2'], ['3', '4']], c: ['1', '2'] },
      publicSignals: [
        computeNullifierHash(p.note1.amount, p.note1.nullifier).toString(),
        computeNullifierHash(p.note2.amount, p.note2.nullifier).toString(),
        leaf.toString(),
      ],
      changeNote: { nullifier: p.changeSecrets.nullifier, trapdoor: p.changeSecrets.trapdoor, amount: change, commitment: leaf },
    };
  });
  return pool;
}

// Stores revenue notes the way the Orders page does (secrets marked as claimed + the note)
function storeRevenue(amounts) {
  const secrets = JSON.parse(localStorage.getItem(deploymentKey('paymentNoteSecrets')) || '{}');
  const stored = amounts.map((amount, i) => {
    const n = note(amount);
    secrets['order-' + n.nullifier] = { nullifier: n.nullifier, trapdoor: n.trapdoor, commitment: n.commitment, claimed: true };
    storePaymentNote(n);
    return n;
  });
  localStorage.setItem(deploymentKey('paymentNoteSecrets'), JSON.stringify(secrets));
  return stored;
}

const run = (pool, extra) => runCashout(Object.assign({
  reputationContract: pool.contract, logWeb3: {}, reputationAddress: '0xrep', fromBlock: 1, account: ACCOUNT, policy: POLICY,
}, extra));

describe('revenue summary and ledger', () => {
  beforeEach(() => localStorage.clear());

  it('counts the notes received from orders, spent or not, and nothing else', () => {
    expect(getCashoutState()).toEqual({ revenueCount: 0, revenueWei: '0', countedNotes: 0, cashedOutWei: '0', open: false, withdrawals: [] });
    storePaymentNote(note(usd(500))); // a deposit
    storeRevenue([usd(20), usd(30)]);
    // accepted, not ended yet
    const all = JSON.parse(localStorage.getItem(deploymentKey('paymentNoteSecrets')));
    all.waiting = { nullifier: '1', trapdoor: '2', commitment: '3' };
    localStorage.setItem(deploymentKey('paymentNoteSecrets'), JSON.stringify(all));
    expect(getRevenueSummary()).toEqual({ revenueCount: 2, revenueWei: usd(50).toString() });
  });

  it('counts a returned collateral as one note of the rule and its amount as received', () => {
    storePaymentNote(note(usd(500))); // a deposit
    // two concluded orders (payment plus collateral) and three orders that ended otherwise
    // and returned the collateral of U$3 alone
    storeRevenue([usd(23), usd(18), usd(3), usd(3), usd(3)]);
    const state = getCashoutState();
    expect(state).toMatchObject({ revenueCount: 5, revenueWei: usd(50).toString() });
    const status = cashoutStatus(getUnspentNotes(), POLICY, state);
    expect(status).toMatchObject({ newNotes: 5, due: true, withdrawals: 5, cashableWei: usd(50) });
    // four of them are not enough for a cash-out
    localStorage.clear();
    storeRevenue([usd(23), usd(3), usd(3), usd(3)]);
    expect(cashoutStatus(getUnspentNotes(), POLICY, getCashoutState())).toMatchObject({ newNotes: 4, due: false });
  });
});

describe('runCashout', () => {
  beforeEach(() => localStorage.clear());

  it('sends one denomination at a time to the own wallet and keeps the note records in step', async () => {
    const pool = fakePool();
    storePaymentNote(note(usd(200))); // deposit
    storeRevenue([usd(12), usd(9), usd(8), usd(3), usd(2.5)]);
    const before = getUnspentBalance();
    const seen = [];

    const done = await run(pool, { onStep: (s) => seen.push(s.status + ' ' + (s.index + 1) + '/' + s.total) });

    expect(pool.paid).toEqual([{ to: ACCOUNT, amount: D.toString() }, { to: ACCOUNT, amount: D.toString() }, { to: ACCOUNT, amount: D.toString() }]);
    expect(done.map((d) => d.txHash)).toEqual(['0xtx1', '0xtx2', '0xtx3']);
    expect(seen).toEqual(['proving 1/3', 'sending 1/3', 'done 1/3', 'proving 2/3', 'sending 2/3', 'done 2/3', 'proving 3/3', 'sending 3/3', 'done 3/3']);
    expect(getUnspentBalance()).toBe(before - D * 3n);
    expect(getCashoutLedger()).toMatchObject({ countedNotes: 5, cashedOutWei: (D * 3n).toString(), open: false });
    expect(getCashoutLedger().withdrawals.map((w) => w.txHash)).toEqual(['0xtx1', '0xtx2', '0xtx3']);
    expect(hasPendingCashouts()).toBe(false);
    // every local note the pool counts as spent is marked spent, and the others are not
    getPaymentNotes().forEach((n) => {
      expect(n.spent).toBe(pool.spent.has(computeNullifierHash(n.amount, n.nullifier).toString()));
    });
    // change notes carry the leaf index of their NoteAdded log
    getUnspentNotes().filter((n) => pool.leaves.includes(n.commitment)).forEach((n) => {
      expect(pool.leaves[n.leafIndex]).toBe(n.commitment);
    });
    // nothing more until five new notes
    expect(await run(pool)).toEqual([]);
    expect(pool.paid).toHaveLength(3);
  });

  it('does nothing below the threshold', async () => {
    const pool = fakePool();
    storeRevenue([usd(40), usd(40), usd(40), usd(40)]);
    expect(await run(pool)).toEqual([]);
    expect(pool.paid).toEqual([]);
    expect(getCashoutLedger()).toMatchObject({ countedNotes: 0, open: false });
  });

  it('a withdrawal rejected in the wallet changes nothing, and the run can be resumed', async () => {
    // five notes; the wallet rejects the second withdrawal
    const pool2 = fakePool();
    storeRevenue([usd(12), usd(11), usd(10.5), usd(1), usd(0.5)]);
    const rejected = Object.assign(new Error('MetaMask Tx Signature: User denied transaction signature.'), { code: 4001 });
    let sends = 0;
    const steps = [];
    const original = pool2.contract.methods.mergeWithdraw;
    pool2.contract.methods.mergeWithdraw = (...args) => {
      const call = original(...args);
      return { estimateGas: call.estimateGas, send: async (o) => { sends += 1; if (sends === 2) throw rejected; return call.send(o); } };
    };

    await expect(run(pool2, { onStep: (s) => steps.push(s.status) })).rejects.toThrow(/User denied/);
    expect(steps).toEqual(['proving', 'sending', 'done', 'proving', 'sending', 'failed']);
    expect(pool2.paid).toHaveLength(1);
    expect(hasPendingCashouts()).toBe(false);
    expect(getUnspentBalance()).toBe(usd(25));
    expect(getCashoutLedger()).toMatchObject({ countedNotes: 5, cashedOutWei: D.toString(), open: true });
    getPaymentNotes().forEach((n) => {
      expect(n.spent).toBe(pool2.spent.has(computeNullifierHash(n.amount, n.nullifier).toString()));
    });

    // resumed: the remaining two withdrawals, although no new note arrived
    const done = await run(pool2);
    expect(done).toHaveLength(2);
    expect(pool2.paid.map((p) => p.amount)).toEqual([D.toString(), D.toString(), D.toString()]);
    expect(getUnspentBalance()).toBe(usd(5));
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: (D * 3n).toString(), open: false });
  });

  it('a withdrawal that would revert is not sent and leaves no record', async () => {
    const pool = fakePool();
    storeRevenue([usd(12), usd(11), usd(10.5), usd(1), usd(0.5)]);
    pool.failEstimate = new Error('execution reverted: Invalid ZK proof');
    await expect(run(pool)).rejects.toThrow(/Invalid ZK proof/);
    expect(pool.paid).toEqual([]);
    expect(hasPendingCashouts()).toBe(false);
    expect(getUnspentNotes()).toHaveLength(5);
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: '0', open: true });
  });

  it('records a withdrawal that was mined although the wallet returned an error', async () => {
    const pool = fakePool();
    storeRevenue([usd(12), usd(11), usd(10.5), usd(1), usd(0.5)]);
    pool.failSend = new Error('Transaction was not mined within 750 seconds');
    pool.mineOnFailure = true;
    await expect(run(pool)).rejects.toThrow(/not mined within/);
    expect(pool.paid).toHaveLength(1);
    expect(hasPendingCashouts()).toBe(false);
    expect(getUnspentBalance()).toBe(usd(25));
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: D.toString(), open: true });
    // the change note was kept: its secrets were saved before sending
    expect(getUnspentNotes().some((n) => n.commitment === pool.leaves[0])).toBe(true);
    expect(await run(pool)).toHaveLength(2);
  });

  it('keeps the change secrets of a withdrawal whose outcome is unknown, and records it once mined', async () => {
    const pool = fakePool();
    storeRevenue([usd(12), usd(11), usd(10.5), usd(1), usd(0.5)]);
    pool.failSend = new Error('Failed to check for transaction receipt');
    let late = null;
    const original = pool.contract.methods.mergeWithdraw;
    pool.contract.methods.mergeWithdraw = (...args) => { if (!late) late = args; return original(...args); };

    await expect(run(pool)).rejects.toThrow(/receipt/);
    expect(pool.paid).toEqual([]);
    expect(hasPendingCashouts()).toBe(true);
    expect(getUnspentBalance()).toBe(usd(35)); // nothing marked spent on a guess

    // the transaction is mined later
    pool.contract.methods.mergeWithdraw = original;
    await original(...late).send();
    const done = await run(pool);
    expect(hasPendingCashouts()).toBe(false);
    expect(done).toHaveLength(2);
    expect(pool.paid).toHaveLength(3);
    expect(getUnspentBalance()).toBe(usd(5));
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: (D * 3n).toString(), open: false });
  });

  it('withdraw-everything pays the exact total and resets the ledger', async () => {
    const pool = fakePool();
    storePaymentNote(note(usd(50)));
    storeRevenue([usd(4), usd(3)]);
    const done = await run(pool, { all: true });
    expect(done.map((d) => d.type)).toEqual(['merge', 'withdraw']);
    expect(pool.paid.filter((p) => p.amount !== '0')).toEqual([{ to: ACCOUNT, amount: usd(57).toString() }]);
    expect(getUnspentBalance()).toBe(0n);
    expect(getCashoutLedger()).toMatchObject({ countedNotes: 2, cashedOutWei: usd(7).toString(), open: false });
  });
});

describe('a withdrawal that is waiting to be mined', () => {
  beforeEach(() => localStorage.clear());

  // Leaves a withdrawal whose outcome is unknown; returns the arguments it was sent with
  async function leavePending(pool) {
    storeRevenue([usd(12), usd(11), usd(10.5), usd(1), usd(0.5)]);
    pool.failSend = new Error('Failed to check for transaction receipt');
    let sent = null;
    const original = pool.contract.methods.mergeWithdraw;
    pool.contract.methods.mergeWithdraw = (...args) => { if (!sent) sent = args; return original(...args); };
    await expect(run(pool)).rejects.toThrow(/receipt/);
    pool.contract.methods.mergeWithdraw = original;
    expect(hasPendingCashouts()).toBe(true);
    return { sent: sent, mine: () => original(...sent).send() };
  }
  const check = (pool, web3) => checkPendingCashouts({ reputationContract: pool.contract, logWeb3: {}, reputationAddress: '0xrep', fromBlock: 1, web3: web3 });
  const pendingList = () => JSON.parse(localStorage.getItem(deploymentKey('poolCashoutPending')));

  it('a second run sends nothing while the first withdrawal is not mined', async () => {
    const pool = fakePool();
    await leavePending(pool);
    let sends = 0;
    const original = pool.contract.methods.mergeWithdraw;
    pool.contract.methods.mergeWithdraw = (...args) => { sends += 1; return original(...args); };

    const error = await run(pool).catch((e) => e);
    expect(isPendingWithdrawalError(error)).toBe(true);
    expect(error.message).toMatch(/still waiting to be mined/);
    expect(sends).toBe(0);
    expect(pool.paid).toEqual([]);
    expect(hasPendingCashouts()).toBe(true);
    expect(getUnspentBalance()).toBe(usd(35));
    expect(isPendingWithdrawalError(new Error('other'))).toBe(false);
  });

  it('checking again only reconciles: it records the withdrawal once mined and sends nothing', async () => {
    const pool = fakePool();
    const first = await leavePending(pool);
    expect(await check(pool)).toMatchObject({ settled: 0, pending: true });
    expect(pool.paid).toEqual([]);

    await first.mine();
    expect(await check(pool)).toMatchObject({ settled: 1, pending: false });
    expect(pool.paid).toHaveLength(1); // the mined one: the check itself sent none
    expect(getUnspentBalance()).toBe(usd(25));
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: D.toString(), open: true });
    // nothing waiting: the check reads nothing
    fetchTreeState.mockClear();
    expect(await check(pool)).toMatchObject({ settled: 0, pending: false });
    expect(fetchTreeState).not.toHaveBeenCalled();
    // and the run continues
    expect(await run(pool)).toHaveLength(2);
  });

  it('keeps the hash of the sent transaction and drops the record when it reverted', async () => {
    const pool = fakePool();
    await leavePending(pool);
    const leaf = pendingList()[0].changeLeaf;
    notePendingTransaction(leaf, { txHash: '0xhash', from: ACCOUNT });
    expect(pendingList()[0]).toMatchObject({ txHash: '0xhash', from: ACCOUNT, changeLeaf: leaf });

    const web3 = { eth: { getTransactionReceipt: async () => ({ status: false }) } };
    expect(await check(pool, web3)).toMatchObject({ settled: 0, pending: false });
    expect(getUnspentBalance()).toBe(usd(35));
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: '0' });
  });

  it('drops the record when the wallet used the nonce for another transaction, and keeps it otherwise', async () => {
    const pool = fakePool();
    await leavePending(pool);
    notePendingTransaction(pendingList()[0].changeLeaf, { txHash: '0xhash' });
    let used = 7;
    const web3 = {
      eth: {
        getTransactionReceipt: async () => null,
        getTransaction: async () => ({ nonce: 7, from: ACCOUNT }),
        getTransactionCount: async () => used,
      },
    };
    // still in the wallet's queue
    expect(await check(pool, web3)).toMatchObject({ settled: 0, pending: true });
    expect(pendingList()[0]).toMatchObject({ nonce: 7, from: ACCOUNT });
    // the node does not answer: the record stays
    expect(await check(pool, { eth: { getTransactionReceipt: async () => { throw new Error('network'); } } })).toMatchObject({ settled: 0, pending: true });
    // replaced or cancelled: nonce 7 was used and the change note is not in the tree
    used = 8;
    expect(await check(pool, web3)).toMatchObject({ settled: 0, pending: false });
    expect(getUnspentBalance()).toBe(usd(35));
  });

  it('a mined transaction is recorded although its nonce is used', async () => {
    const pool = fakePool();
    const first = await leavePending(pool);
    notePendingTransaction(pendingList()[0].changeLeaf, { txHash: '0xhash', nonce: 7, from: ACCOUNT });
    await first.mine();
    const web3 = { eth: { getTransactionReceipt: async () => ({ status: true }), getTransactionCount: async () => 8 } };
    expect(await check(pool, web3)).toMatchObject({ settled: 1, pending: false });
    expect(getCashoutLedger().withdrawals.map((w) => w.txHash)).toEqual(['0xhash']);
  });

  it('records the hash given by the wallet while sending', async () => {
    const pool = fakePool();
    storeRevenue([usd(12), usd(11), usd(10.5), usd(1), usd(0.5)]);
    const original = pool.contract.methods.mergeWithdraw;
    let seen = null;
    pool.contract.methods.mergeWithdraw = (...args) => {
      const call = original(...args);
      return {
        estimateGas: call.estimateGas,
        send: () => {
          // like web3: a promise that also reports the hash
          const promise = new Promise((resolve) => setTimeout(() => {
            seen = pendingList()[0];
            resolve(call.send());
          }, 0));
          promise.on = (name, fn) => { if (name === 'transactionHash') fn('0xsent'); return promise; };
          return promise;
        },
      };
    };
    const web3 = { eth: { getTransaction: async () => ({ nonce: 3, from: ACCOUNT }) } };
    await run(pool, { web3: web3 });
    expect(seen).toMatchObject({ txHash: '0xsent', from: ACCOUNT, nonce: 3 });
    expect(hasPendingCashouts()).toBe(false);
  });
});

describe('the withdrawal that funds an accepted order', () => {
  beforeEach(() => localStorage.clear());

  const funding = (spentNote, changeAmount) => ({
    spent: [spentNote.nullifier],
    nullifierHash: computeNullifierHash(spentNote.amount, spentNote.nullifier).toString(),
    change: { nullifier: '901', trapdoor: '902', amount: changeAmount.toString() },
    changeLeaf: computePaymentLeaf(computePaymentCommitment(901, 902), changeAmount).toString(),
    withdrawAmount: (BigInt(spentNote.amount) - changeAmount).toString(),
    all: false,
    funding: true,
  });

  it('keeps the change secrets from before sending, and is not counted as cashed out', () => {
    const [deposit] = [note(usd(50))];
    storePaymentNote(deposit);
    const record = funding(deposit, usd(47));
    addPendingWithdrawal(record);
    // the page could close here: the secrets of the change note are already stored
    expect(JSON.parse(localStorage.getItem(deploymentKey('poolCashoutPending')))[0].change).toEqual({ nullifier: '901', trapdoor: '902', amount: usd(47).toString() });
    expect(hasPendingCashouts()).toBe(true);
    expect(getUnspentBalance()).toBe(usd(50));

    settlePendingWithdrawal(record, 4, '0xfund');
    expect(hasPendingCashouts()).toBe(false);
    expect(getUnspentBalance()).toBe(usd(47));
    expect(getUnspentNotes()).toEqual([expect.objectContaining({ nullifier: '901', trapdoor: '902', amount: usd(47).toString(), leafIndex: 4, commitment: record.changeLeaf })]);
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: '0', withdrawals: [] });
  });

  it('is kept for the one-time address it paid, once mined, so that the order counts as funded', async () => {
    const ONE_TIME = '0x00000000000000000000000000000000000000D7';
    const deposit = note(usd(50));
    storePaymentNote(deposit);
    const record = Object.assign(funding(deposit, usd(47)), { recipient: ONE_TIME });
    addPendingWithdrawal(record);
    // sent, not mined: nothing is known to be paid
    expect(recordedFunding(ONE_TIME)).toBe(0n);
    settlePendingWithdrawal(record, 4, '0xfund');
    expect(recordedFunding(ONE_TIME)).toBe(usd(3));
    // a funding of the fee plus the budget is not withdrawn again
    expect(fundingPlan(recordedFunding(ONE_TIME), usd(1), 1n).withdraw).toBe(0n);

    // found mined by a later check (the page was closed before the receipt)
    const pool = fakePool();
    const second = note(usd(20));
    storePaymentNote(second);
    const later = Object.assign(funding(second, usd(18)), { recipient: ONE_TIME, change: { nullifier: '911', trapdoor: '912', amount: usd(18).toString() },
      changeLeaf: computePaymentLeaf(computePaymentCommitment(911, 912), usd(18)).toString() });
    addPendingWithdrawal(later);
    pool.leaves.push(later.changeLeaf);
    pool.spent.add(later.nullifierHash);
    expect(await checkPendingCashouts({ reputationContract: pool.contract, logWeb3: {}, reputationAddress: '0xrep', fromBlock: 1 })).toMatchObject({ settled: 1, pending: false });
    expect(recordedFunding(ONE_TIME)).toBe(usd(5));
    // a cash-out to the wallet is not a funding
    expect(recordedFunding(ACCOUNT)).toBe(0n);
  });

  it('is recorded by the next check when the page closed before the receipt', async () => {
    const pool = fakePool();
    const deposit = note(usd(50));
    storePaymentNote(deposit);
    const record = funding(deposit, usd(47));
    addPendingWithdrawal(record);
    pool.leaves.push('111', record.changeLeaf);
    pool.spent.add(record.nullifierHash);

    expect(await checkPendingCashouts({ reputationContract: pool.contract, logWeb3: {}, reputationAddress: '0xrep', fromBlock: 1 })).toMatchObject({ settled: 1, pending: false });
    expect(getUnspentNotes().map((n) => [n.amount, n.leafIndex])).toEqual([[usd(47).toString(), 1]]);
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: '0', withdrawals: [] });
  });

  it('leaves the notes untouched when it was never sent', () => {
    const deposit = note(usd(50));
    storePaymentNote(deposit);
    const record = funding(deposit, usd(47));
    addPendingWithdrawal(record);
    dropPendingWithdrawal(record.changeLeaf);
    expect(hasPendingCashouts()).toBe(false);
    expect(getUnspentNotes()).toHaveLength(1);
    expect(getUnspentBalance()).toBe(usd(50));
  });
});

describe('a withdrawal that never settles', () => {
  beforeEach(() => localStorage.clear());

  const pendingList = () => JSON.parse(localStorage.getItem(deploymentKey('poolCashoutPending')) || '[]');
  const asideList = () => JSON.parse(localStorage.getItem(deploymentKey('poolCashoutAside')) || '[]');
  const check = (pool, extra) => checkPendingCashouts(Object.assign(
    { reputationContract: pool.contract, logWeb3: {}, reputationAddress: '0xrep', fromBlock: 1 }, extra));

  // A cash-out withdrawal handed to the wallet whose outcome is unknown
  async function leavePending(pool) {
    storeRevenue([usd(12), usd(11), usd(10.5), usd(1), usd(0.5)]);
    pool.failSend = new Error('Failed to check for transaction receipt');
    let sent = null;
    const original = pool.contract.methods.mergeWithdraw;
    pool.contract.methods.mergeWithdraw = (...args) => { if (!sent) sent = args; return original(...args); };
    await expect(run(pool)).rejects.toThrow(/receipt/);
    pool.contract.methods.mergeWithdraw = original;
    return { mine: () => original(...sent).send(), estimate: () => original(...sent).estimateGas() };
  }

  // The funding of an order: signed in the browser, so its record has the signed bytes
  const funding = (spentNote, changeAmount) => ({
    spent: [spentNote.nullifier],
    nullifierHash: computeNullifierHash(spentNote.amount, spentNote.nullifier).toString(),
    change: { nullifier: '901', trapdoor: '902', amount: changeAmount.toString() },
    changeLeaf: computePaymentLeaf(computePaymentCommitment(901, 902), changeAmount).toString(),
    withdrawAmount: (BigInt(spentNote.amount) - changeAmount).toString(),
    all: false,
    funding: true,
    txHash: '0xfundinghash', nonce: 0, from: '0x00000000000000000000000000000000000000d1', rawTx: '0xf86bsignedbytes',
  });

  // A node as web3 shows it: it knows the transaction or not, and takes, refuses or loses a broadcast
  function fakeNode() {
    const node = { known: null, refuse: null, down: false, broadcasts: [], lookups: [] };
    node.eth = {
      getTransaction: async (hash) => {
        node.lookups.push(hash);
        if (node.down) throw new Error('network');
        return node.known;
      },
      sendSignedTransaction: (raw) => {
        node.broadcasts.push(raw);
        const handlers = {};
        const sending = node.refuse ? Promise.reject(node.refuse) : new Promise(() => {});
        sending.once = (name, fn) => { handlers[name] = fn; return sending; };
        sending.on = (name, fn) => { handlers[name] = fn; return sending; };
        setTimeout(() => {
          if (node.refuse) handlers.error(node.refuse);
          else handlers.transactionHash('0xfundinghash');
        }, 0);
        return sending;
      },
    };
    return node;
  }

  it('setting it aside stops the block, keeps the record with its secrets, and sends nothing', async () => {
    const pool = fakePool();
    await leavePending(pool);
    const record = pendingList()[0];
    expect(record.change.nullifier).toMatch(/^[0-9]+$/);
    expect(setAsidePendingCashouts()).toBe(1);

    expect(hasPendingCashouts()).toBe(false);
    expect(pendingList()).toEqual([]);
    expect(countSetAsideCashouts()).toBe(1);
    expect(asideList()[0]).toMatchObject({ changeLeaf: record.changeLeaf, change: record.change, spent: record.spent, nullifierHash: record.nullifierHash });
    expect(typeof asideList()[0].asideAt).toBe('number');
    // its notes count as unspent meanwhile, and nothing left the browser
    expect(getUnspentBalance()).toBe(usd(35));
    expect(pool.paid).toEqual([]);
    // nothing waiting: nothing to set aside
    expect(setAsidePendingCashouts()).toBe(0);
    expect(countSetAsideCashouts()).toBe(1);
  });

  it('a check keeps looking for it and keeps its secrets while it could still be mined', async () => {
    const pool = fakePool();
    await leavePending(pool);
    setAsidePendingCashouts();
    const leaf = asideList()[0].changeLeaf;

    expect(await check(pool)).toMatchObject({ settled: 0, pending: false, aside: 1 });
    expect(fetchTreeState).toHaveBeenCalled();
    // the node does not know it, or it is still in the wallet's queue: the record stays
    const web3 = { eth: { getTransactionReceipt: async () => null, getTransaction: async () => ({ nonce: 7, from: ACCOUNT }), getTransactionCount: async () => 7 } };
    localStorage.setItem(deploymentKey('poolCashoutAside'), JSON.stringify(asideList().map((p) => Object.assign({}, p, { txHash: '0xhash' }))));
    expect(await check(pool, { web3: web3 })).toMatchObject({ settled: 0, pending: false, aside: 1 });
    expect(asideList()[0].changeLeaf).toBe(leaf);
    expect(asideList()[0].change.trapdoor).toMatch(/^[0-9]+$/);
  });

  it('is settled as usual when it is mined after all', async () => {
    const pool = fakePool();
    const first = await leavePending(pool);
    setAsidePendingCashouts();
    const record = asideList()[0];

    await first.mine();
    expect(await check(pool)).toMatchObject({ settled: 1, pending: false, aside: 0 });
    expect(asideList()).toEqual([]);
    expect(localStorage.getItem(deploymentKey('poolCashoutAside'))).toBeNull();
    expect(getUnspentBalance()).toBe(usd(25));
    expect(getUnspentNotes().some((n) => n.commitment === record.changeLeaf && n.nullifier === record.change.nullifier)).toBe(true);
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: D.toString() });
    // and the cash-out goes on from there: two more, three in total, none twice
    expect(await run(pool)).toHaveLength(2);
    expect(pool.paid.map((x) => x.amount)).toEqual([D.toString(), D.toString(), D.toString()]);
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: (3n * D).toString() });
  });

  it('a later run records it first when it was mined meanwhile, without asking', async () => {
    const pool = fakePool();
    const first = await leavePending(pool);
    setAsidePendingCashouts();
    await first.mine();
    expect(await run(pool)).toHaveLength(2);
    expect(pool.paid).toHaveLength(3);
    expect(countSetAsideCashouts()).toBe(0);
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: (3n * D).toString(), open: false });
    expect(getUnspentBalance()).toBe(usd(5));
  });

  it('a later withdrawal of the same notes goes on, and the set-aside one is dropped once it cannot be mined', async () => {
    const pool = fakePool();
    const first = await leavePending(pool);
    setAsidePendingCashouts();

    // the run does not stop for it and spends the same notes
    expect(await run(pool)).toHaveLength(3);
    expect(pool.paid.map((x) => x.amount)).toEqual([D.toString(), D.toString(), D.toString()]);
    expect(getCashoutLedger()).toMatchObject({ cashedOutWei: (3n * D).toString() });
    expect(getUnspentBalance()).toBe(usd(5));
    // its note was spent by the later one: the contract would refuse it now, so its record goes
    await expect(first.estimate()).rejects.toThrow('Note 1 already spent');
    expect(countSetAsideCashouts()).toBe(0);
    expect(hasPendingCashouts()).toBe(false);
  });

  it('checking again sends the same signed bytes of a funding withdrawal when the node does not know it', async () => {
    const pool = fakePool();
    const deposit = note(usd(50));
    storePaymentNote(deposit);
    const record = funding(deposit, usd(47));
    addPendingWithdrawal(record);
    const node = fakeNode();

    expect(await check(pool, { logWeb3: node })).toEqual({ settled: 0, pending: true, resent: 1, refused: '', aside: 0 });
    expect(node.lookups).toEqual(['0xfundinghash']);
    expect(node.broadcasts).toEqual([record.rawTx]);
    // the record and its secrets stay until the tree shows the change note
    expect(pendingList()).toEqual([record]);
    expect(getUnspentBalance()).toBe(usd(50));

    // the node knows it now: nothing is sent a second time
    node.known = { hash: '0xfundinghash', nonce: 0 };
    expect(await check(pool, { logWeb3: node })).toMatchObject({ pending: true, resent: 0, refused: '' });
    expect(node.broadcasts).toHaveLength(1);

    // mined: recorded as usual
    pool.leaves.push(record.changeLeaf);
    pool.spent.add(record.nullifierHash);
    expect(await check(pool, { logWeb3: node })).toMatchObject({ settled: 1, pending: false, resent: 0 });
    expect(node.broadcasts).toHaveLength(1);
    expect(getUnspentBalance()).toBe(usd(47));
  });

  it('says what the node answered when it does not take the bytes again, and keeps the record', async () => {
    const pool = fakePool();
    const deposit = note(usd(50));
    storePaymentNote(deposit);
    const record = funding(deposit, usd(47));
    addPendingWithdrawal(record);
    const node = fakeNode();

    node.refuse = new Error('insufficient funds for gas * price + value');
    expect(await check(pool, { logWeb3: node })).toMatchObject({ pending: true, resent: 0, refused: 'insufficient funds for gas * price + value' });
    expect(pendingList()).toEqual([record]);
    // "already known" is not a refusal: the node has it
    node.refuse = new Error('already known');
    expect(await check(pool, { logWeb3: node })).toMatchObject({ pending: true, resent: 0, refused: '' });
    // a node that does not answer the lookup gets nothing
    node.down = true;
    node.broadcasts = [];
    expect(await check(pool, { logWeb3: node })).toMatchObject({ pending: true, resent: 0, refused: '' });
    expect(node.broadcasts).toEqual([]);
    expect(pendingList()).toEqual([record]);
  });

  it('never sends again a withdrawal of the wallet, nor one that was set aside', async () => {
    const pool = fakePool();
    await leavePending(pool);
    notePendingTransaction(pendingList()[0].changeLeaf, { txHash: '0xwallet', from: ACCOUNT, nonce: 3 });
    const node = fakeNode();
    expect(await check(pool, { logWeb3: node })).toMatchObject({ pending: true, resent: 0 });
    expect(node.broadcasts).toEqual([]);
    expect(node.lookups).toEqual([]);

    const deposit = note(usd(50));
    storePaymentNote(deposit);
    addPendingWithdrawal(funding(deposit, usd(47)));
    setAsidePendingCashouts();
    expect(countSetAsideCashouts()).toBe(2);
    expect(await check(pool, { logWeb3: node })).toMatchObject({ pending: false, resent: 0, aside: 2 });
    expect(node.broadcasts).toEqual([]);
  });
});
