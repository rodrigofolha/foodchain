import { isWholePrice } from './priceHint';

describe('isWholePrice', () => {
  it('accepts whole prices and an empty field', () => {
    expect(isWholePrice('8')).toBe(true);
    expect(isWholePrice('12.00')).toBe(true);
    expect(isWholePrice(15)).toBe(true);
    expect(isWholePrice('')).toBe(true);
    expect(isWholePrice(undefined)).toBe(true);
  });

  it('flags prices with cents, with a dot or a comma', () => {
    expect(isWholePrice('7.98')).toBe(false);
    expect(isWholePrice('7,5')).toBe(false);
    expect(isWholePrice(0.5)).toBe(false);
  });

  it('leaves text that is not a number to the form validation', () => {
    expect(isWholePrice('abc')).toBe(true);
  });
});
