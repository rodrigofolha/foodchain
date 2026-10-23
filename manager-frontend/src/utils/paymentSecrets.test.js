import { paymentCommitmentFor, isEarlierAttempt, ordersWithUnclaimedNote } from './paymentSecrets';
import { deploymentKey } from './deploymentStorage';

const ORDER = '0x00000000000000000000000000000000000000Aa';
const OTHER = '0x00000000000000000000000000000000000000bb';
const PLACED = '1760000000';
const stored = () => JSON.parse(localStorage.getItem(deploymentKey('paymentNoteSecrets')) || '{}');

let made;
const makeSecrets = () => {
  made += 1;
  return { nullifier: 'n' + made, trapdoor: 't' + made, commitment: String(1000 + made) };
};

beforeEach(() => {
  localStorage.clear();
  made = 0;
});

describe('payment secrets of an accepted order', () => {
  it('makes and saves new secrets with the order they are for', () => {
    expect(paymentCommitmentFor('7', ORDER, PLACED, makeSecrets)).toBe('1001');
    expect(stored()).toEqual({ 7: { nullifier: 'n1', trapdoor: 't1', commitment: '1001', order: ORDER, placedAt: PLACED } });
  });

  it('uses the secrets of an earlier attempt for the same order again', () => {
    paymentCommitmentFor('7', ORDER, PLACED, makeSecrets);
    expect(paymentCommitmentFor(7, ORDER.toLowerCase(), Number(PLACED), makeSecrets)).toBe('1001');
    expect(made).toBe(1);
    expect(Object.keys(stored())).toEqual(['7']);
  });

  it('does not send the commitment kept for an order of another deployment with the same number', () => {
    paymentCommitmentFor('7', OTHER, PLACED, makeSecrets);
    expect(paymentCommitmentFor('7', ORDER, PLACED, makeSecrets)).toBe('1002');
    expect(stored()[7]).toMatchObject({ commitment: '1002', order: ORDER });
    // the older secrets are still in the browser
    expect(stored()['7@' + OTHER + '@' + PLACED]).toMatchObject({ nullifier: 'n1', trapdoor: 't1', commitment: '1001' });
  });

  it('does not reuse a record of a restarted chain: same address, another time', () => {
    paymentCommitmentFor('7', ORDER, '1750000000', makeSecrets);
    expect(paymentCommitmentFor('7', ORDER, PLACED, makeSecrets)).toBe('1002');
    expect(stored()['7@' + ORDER + '@1750000000'].commitment).toBe('1001');
  });

  it('does not reuse a record that names no order, and keeps its secrets', () => {
    localStorage.setItem(deploymentKey('paymentNoteSecrets'), JSON.stringify({ 7: { nullifier: 'a', trapdoor: 'b', commitment: '55' } }));
    expect(paymentCommitmentFor('7', ORDER, PLACED, makeSecrets)).toBe('1001');
    expect(stored()['7@earlier@0']).toEqual({ nullifier: 'a', trapdoor: 'b', commitment: '55' });
  });

  it('replaces a claimed record: its note is already stored', () => {
    localStorage.setItem(deploymentKey('paymentNoteSecrets'), JSON.stringify({
      7: { nullifier: 'a', trapdoor: 'b', commitment: '55', order: ORDER, placedAt: PLACED, claimed: true },
    }));
    expect(isEarlierAttempt(stored()[7], ORDER, PLACED)).toBe(false);
    expect(paymentCommitmentFor('7', ORDER, PLACED, makeSecrets)).toBe('1001');
    expect(Object.keys(stored())).toEqual(['7']);
  });

  it('leaves the records of other orders alone', () => {
    paymentCommitmentFor('6', OTHER, PLACED, makeSecrets);
    paymentCommitmentFor('7', ORDER, PLACED, makeSecrets);
    expect(stored()[6].commitment).toBe('1001');
    expect(stored()[7].commitment).toBe('1002');
  });
});

describe('orders whose note is in the pool and not stored yet', () => {
  // an order as Chain.getOrder gives it to its establishment: field 3 the step, field 5 the note's amount
  const order = (id, step, amount) => [String(id), 'items', '3000', step, '0x0', amount, PLACED, PLACED, '0x0', '0', '0'];
  const accept = (id) => paymentCommitmentFor(String(id), ORDER, PLACED, makeSecrets);
  const claim = (id) => {
    const all = stored();
    all[id].claimed = true;
    localStorage.setItem(deploymentKey('paymentNoteSecrets'), JSON.stringify(all));
  };

  it('are those of any ending that paid the establishment, not only the concluded ones', () => {
    [1, 2, 3, 4, 5, 6, 7].forEach(accept);
    const orders = [
      order(1, 'CONCLUDED', '23000'),
      order(2, 'CANCELED BY RESTAURANT', '3000'),           // cancelled in PREPARATION: the collateral
      order(3, 'CANCELED BY CLIENT', '23000'),              // a late cancellation: payment and collateral
      order(4, 'CANCELED BY FIRST DELIVERYMAN', '3000'),    // a timeout or a leaving after pickup
      order(5, 'CANCELED BY SECOND DELIVERYMAN', '3000'),
      order(6, 'CONTESTED', '23000'),
      order(7, 'CONTESTED', '3000'),
    ];
    expect(ordersWithUnclaimedNote(orders)).toEqual([
      { orderId: '1', amount: '23000' }, { orderId: '2', amount: '3000' }, { orderId: '3', amount: '23000' },
      { orderId: '4', amount: '3000' }, { orderId: '5', amount: '3000' }, { orderId: '6', amount: '23000' },
      { orderId: '7', amount: '3000' },
    ]);
  });

  it('leave out an order that paid nothing, one that is open, and one without secrets here', () => {
    [1, 2, 3].forEach(accept);
    expect(ordersWithUnclaimedNote([
      order(1, 'CANCELED BY RESTAURANT', '0'),   // cancelled in WAITING: the establishment gets nothing
      order(2, 'PREPARATION', '0'),
      order(3, 'DISPATCHED', ''),
      order(4, 'CONCLUDED', '23000'),            // accepted in another browser
      null,
    ])).toEqual([]);
    expect(ordersWithUnclaimedNote(undefined)).toEqual([]);
  });

  it('never name a note twice: a claimed record is left out', () => {
    accept(1);
    const orders = [order(1, 'CANCELED BY FIRST DELIVERYMAN', '3000')];
    expect(ordersWithUnclaimedNote(orders)).toHaveLength(1);
    claim(1);
    expect(ordersWithUnclaimedNote(orders)).toEqual([]);
  });

  it('take numbers as the libraries give them', () => {
    accept(9);
    const asNumbers = [9, 'items', 3000, 'CONTESTED', '0x0', { toString: () => '3000' }];
    expect(ordersWithUnclaimedNote([asNumbers])).toEqual([{ orderId: '9', amount: '3000' }]);
  });
});
