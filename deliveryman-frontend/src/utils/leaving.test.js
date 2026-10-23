import { leavingNotice, isWorkerView, leftOrderText, HANDOVER_TIMEOUT_SECONDS, ENDING_GAS_NOTE } from './leaving';

const SINCE = 1760000000;

describe('leavingNotice', () => {
  it('tells a first worker that the order is offered again and that the establishment can rate them', () => {
    const text = leavingNotice('WAITING', 1, SINCE, SINCE + 60);
    expect(text).toMatch(/goes back to the open orders, for another worker/);
    expect(text).toMatch(/counted on your public record/);
    expect(text).toMatch(/The establishment will be able to rate you/);
    expect(text).not.toMatch(/customer and the establishment/);
  });

  it('tells a second worker, and a first worker after the hour, that the order ends', () => {
    expect(leavingNotice('WAITING', 2, SINCE, SINCE + 60)).toMatch(/The order ends: the customer is refunded/);
    expect(leavingNotice('WAITING', 1, SINCE, SINCE + HANDOVER_TIMEOUT_SECONDS)).toMatch(/for another worker/);
    const late = leavingNotice('WAITING', 1, SINCE, SINCE + HANDOVER_TIMEOUT_SECONDS + 1);
    expect(late).toMatch(/The order ends/);
    expect(late).toMatch(/The establishment will be able to rate you/);
  });

  it('names both outcomes when the position is not known', () => {
    const text = leavingNotice('WAITING', null, SINCE, SINCE + 60);
    expect(text).toMatch(/goes back to the open orders or, if no other worker can take it, ends/);
    expect(text).toMatch(/The establishment will be able to rate you/);
  });

  it('says after pickup that both the customer and the establishment can rate them', () => {
    const text = leavingNotice('DISPATCHED', 1, SINCE, SINCE + 60);
    expect(text).toMatch(/Both the customer and the establishment will be able to rate you/);
    expect(text).toMatch(/you are not paid/);
  });
});

describe('leavingNotice: the gas of a leaving that ends the order', () => {
  it('says that the transaction returns the establishment\'s money to the pool and costs more gas', () => {
    expect(ENDING_GAS_NOTE).toMatch(/returns the establishment's money to the payment pool and costs more gas than the other steps/);
    expect(leavingNotice('DISPATCHED', 1, SINCE, SINCE + 60)).toContain(ENDING_GAS_NOTE);
    expect(leavingNotice('DISPATCHED', 2, SINCE, SINCE + 60)).toContain(ENDING_GAS_NOTE);
    expect(leavingNotice('WAITING', 2, SINCE, SINCE + 60)).toContain(ENDING_GAS_NOTE);
    expect(leavingNotice('WAITING', 1, SINCE, SINCE + HANDOVER_TIMEOUT_SECONDS + 1)).toContain(ENDING_GAS_NOTE);
  });

  it('does not say it to a first worker whose leaving reopens the order', () => {
    expect(leavingNotice('WAITING', 1, SINCE, SINCE + 60)).not.toMatch(/payment pool|gas/);
  });

  it('says it as a condition when the position is not known', () => {
    expect(leavingNotice('WAITING', null, SINCE, SINCE + 60))
      .toMatch(/If the order ends: this transaction also returns the establishment's money to the payment pool/);
  });
});

describe('isWorkerView', () => {
  const view = (status) => ['7', '', '0', status, '0x0', '0', '0', '0', '0x0', '0', '0'];
  it('is true for the steps a committed worker can see', () => {
    ['WAITING', 'DISPATCHED', 'CONCLUDED', 'CANCELED BY CLIENT', 'CANCELED BY FIRST DELIVERYMAN'].forEach((status) => {
      expect(isWorkerView(view(status))).toBe(true);
    });
  });
  it('is false for the public view a worker gets after they left', () => {
    expect(isWorkerView(view(''))).toBe(false);
    expect(isWorkerView(view('PREPARATION'))).toBe(false);
    expect(isWorkerView(view('ORDERED'))).toBe(false);
    expect(isWorkerView(null)).toBe(false);
  });
});

describe('leftOrderText', () => {
  it('says who can rate after a leaving before pickup', () => {
    expect(leftOrderText({ outcome: '1', byClient: '0', byEstablishment: '0' }))
      .toBe('You left this order before pickup. Only the establishment can rate you for it: it has not rated you.');
    expect(leftOrderText({ 0: '1', 1: '0', 2: '2' })).toMatch(/it rated you 2 ★/);
  });
  it('shows both ratings after a leaving after pickup', () => {
    expect(leftOrderText({ outcome: '2', byClient: '1', byEstablishment: '0' }))
      .toBe('You left this order after pickup. The customer rated you 1 ★; the establishment has not rated you.');
  });
  it('is null when nothing is reported, or for a delivered order', () => {
    expect(leftOrderText(null)).toBeNull();
    expect(leftOrderText({ outcome: '0', byClient: '0', byEstablishment: '0' })).toBeNull();
    expect(leftOrderText({ outcome: '3', byClient: '5', byEstablishment: '5' })).toBeNull();
  });
});
