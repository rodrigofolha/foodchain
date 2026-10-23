import { workerRecord, averageText, qualification } from './workerRecord';

describe('workerRecord', () => {
  it('reads the five fields of workers(), by name or by position', () => {
    const expected = { average: 43, totalRatings: 3, completedOrders: 5, leftOrders: 2, ratingsAfterLeaving: 1 };
    expect(workerRecord({ totalScore: '13', totalRatings: '3', completedOrders: '5', leftOrders: '2', ratingsAfterLeaving: '1' })).toEqual(expected);
    expect(workerRecord({ 0: '13', 1: '3', 2: '5', 3: '2', 4: '1' })).toEqual(expected);
  });

  it('has no average without ratings', () => {
    const record = workerRecord({ 0: '0', 1: '0', 2: '0', 3: '1', 4: '0' });
    expect(record).toEqual({ average: null, totalRatings: 0, completedOrders: 0, leftOrders: 1, ratingsAfterLeaving: 0 });
    expect(averageText(record)).toBe('No ratings yet');
    expect(workerRecord(null)).toBeNull();
    expect(averageText(null)).toBe('No ratings yet');
  });

  it('rounds the average down, as the contract does', () => {
    // 14 / 3 = 4.66: the contract answers 46
    expect(workerRecord({ 0: '14', 1: '3', 2: '0', 3: '0', 4: '0' }).average).toBe(46);
    expect(averageText(workerRecord({ 0: '14', 1: '3' }))).toBe('4.6 ★ (3 ratings)');
    expect(averageText(workerRecord({ 0: '5', 1: '1' }))).toBe('5.0 ★ (1 rating)');
  });
});

describe('qualification', () => {
  it('accepts anybody when the order sets no minimum, or the record is not loaded', () => {
    expect(qualification({ 0: '0', 1: '0', 2: '0' }, 0, 0)).toEqual({ qualified: true, reason: null });
    expect(qualification(null, 40, 3)).toEqual({ qualified: true, reason: null });
  });

  it('refuses a worker without ratings when a minimum score is set', () => {
    const result = qualification({ 0: '0', 1: '0', 2: '9' }, 35, 0);
    expect(result.qualified).toBe(false);
    expect(result.reason).toBe('Requires 3.5★ (you have no ratings yet)');
  });

  it('compares the average with the minimum score', () => {
    expect(qualification({ 0: '35', 1: '2', 2: '0' }, 35, 0).qualified).toBe(true);
    expect(qualification({ 0: '34', 1: '2', 2: '0' }, 35, 0)).toEqual({ qualified: false, reason: 'Requires 3.5★ (you have 3.4★)' });
  });

  it('compares the deliveries with the minimum deliveries, and names both reasons', () => {
    expect(qualification({ 0: '50', 1: '1', 2: '3' }, 0, 3).qualified).toBe(true);
    expect(qualification({ 0: '50', 1: '1', 2: '2' }, 0, 3).reason).toBe('Requires 3 deliveries (you have 2)');
    expect(qualification({ 0: '20', 1: '1', 2: '2' }, 45, 3).reason).toBe('Requires 4.5★ (you have 2.0★) · Requires 3 deliveries (you have 2)');
  });

  it('reads the order\'s minimums as getOrder returns them', () => {
    expect(qualification(['40', '4', '10'], '35', '10').qualified).toBe(true);
    expect(qualification(['40', '4', '10'], undefined, '11').qualified).toBe(false);
  });
});
