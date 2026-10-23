import { waitingTimedOut, waitingTimeoutAt, WAITING_TIMEOUT_SECONDS } from './waitingTimeout';

describe('the WAITING timeout', () => {
  const T = 1760000000;

  it('is reached after second 3600 since the commitment, as in the contract (now > since + 3600)', () => {
    expect(WAITING_TIMEOUT_SECONDS).toBe(3600);
    expect(waitingTimedOut(T, T)).toBe(false);
    expect(waitingTimedOut(T, T + 3599)).toBe(false);
    expect(waitingTimedOut(T, T + 3600)).toBe(false);
    expect(waitingTimedOut(T, T + 3601)).toBe(true);
    expect(waitingTimedOut(String(T), String(T + 7200))).toBe(true);
    expect(waitingTimeoutAt(T)).toBe(T + 3600);
  });

  it('is never reached without a known time', () => {
    [undefined, null, '', 'x', 0, '0'].forEach((since) => {
      expect(waitingTimedOut(since, T + 99999)).toBe(false);
      expect(waitingTimeoutAt(since)).toBeNull();
    });
    expect(waitingTimedOut(T, undefined)).toBe(false);
  });
});
