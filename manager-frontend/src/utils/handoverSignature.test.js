import { HANDOVER_SIGNATURE_PATTERN, isHandoverSignature } from './handoverSignature';

// 65-byte signature: r (32) + s (32) + v (1)
const VALID = '0x' + 'ab'.repeat(32) + 'CD'.repeat(32) + '1b';

describe('isHandoverSignature', () => {
  it('uses the expected pattern', () => {
    expect(HANDOVER_SIGNATURE_PATTERN.source).toBe('^0x[0-9a-fA-F]{130}$');
  });

  it('accepts 0x followed by 130 hex characters, in any case', () => {
    expect(VALID).toHaveLength(132);
    expect(isHandoverSignature(VALID)).toBe(true);
    expect(isHandoverSignature(VALID.toLowerCase())).toBe(true);
    expect(isHandoverSignature('0x' + VALID.slice(2).toUpperCase())).toBe(true);
  });

  it('rejects wrong lengths', () => {
    expect(isHandoverSignature(VALID.slice(0, -2))).toBe(false); // 64 bytes
    expect(isHandoverSignature(VALID + '00')).toBe(false); // 66 bytes
    expect(isHandoverSignature(VALID.slice(0, -1))).toBe(false); // odd length
    expect(isHandoverSignature('0x')).toBe(false);
    expect(isHandoverSignature('')).toBe(false);
  });

  it('rejects a missing or wrong prefix', () => {
    expect(isHandoverSignature(VALID.slice(2))).toBe(false);
    expect(isHandoverSignature('0X' + VALID.slice(2))).toBe(false);
    expect(isHandoverSignature('1x' + VALID.slice(2))).toBe(false);
  });

  it('rejects non-hex characters and surrounding text', () => {
    expect(isHandoverSignature('0xg' + VALID.slice(3))).toBe(false);
    expect(isHandoverSignature(' ' + VALID)).toBe(false);
    expect(isHandoverSignature(VALID + '\n')).toBe(false);
    expect(isHandoverSignature('foodchain:' + VALID)).toBe(false);
  });

  it('rejects a 6-digit number and non-strings', () => {
    expect(isHandoverSignature('123456')).toBe(false);
    expect(isHandoverSignature(123456)).toBe(false);
    expect(isHandoverSignature(null)).toBe(false);
    expect(isHandoverSignature(undefined)).toBe(false);
  });
});
