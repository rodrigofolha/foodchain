import { isHandoverSignature, HANDOVER_SIGNATURE_REGEX } from './handoverSignature';

// 65 bytes: r (32) + s (32) + v (1), as returned by personal_sign.
const SIG = '0x' + 'ab'.repeat(32) + '3c'.repeat(32) + '1b';

describe('isHandoverSignature', () => {
  it('accepts 0x followed by 130 hex characters', () => {
    expect(SIG).toHaveLength(132);
    expect(isHandoverSignature(SIG)).toBe(true);
    expect(isHandoverSignature(SIG.toUpperCase().replace('0X', '0x'))).toBe(true);
    expect(HANDOVER_SIGNATURE_REGEX.test(SIG)).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isHandoverSignature(SIG.slice(0, -1))).toBe(false); // 129 hex chars
    expect(isHandoverSignature(SIG + 'a')).toBe(false); // 131 hex chars
    expect(isHandoverSignature('0x')).toBe(false);
    expect(isHandoverSignature('')).toBe(false);
  });

  it('rejects a missing or wrong prefix', () => {
    expect(isHandoverSignature(SIG.slice(2))).toBe(false);
    expect(isHandoverSignature('0X' + SIG.slice(2))).toBe(false);
    expect(isHandoverSignature('1x' + SIG.slice(2))).toBe(false);
  });

  it('rejects non-hex characters and surrounding text', () => {
    expect(isHandoverSignature('0x' + 'g' + SIG.slice(3))).toBe(false);
    expect(isHandoverSignature(' ' + SIG)).toBe(false);
    expect(isHandoverSignature(SIG + '\n')).toBe(false);
    expect(isHandoverSignature('https://example.com/?sig=' + SIG)).toBe(false);
    expect(isHandoverSignature('123456')).toBe(false);
  });

  it('rejects values that are not strings', () => {
    expect(isHandoverSignature(null)).toBe(false);
    expect(isHandoverSignature(undefined)).toBe(false);
    expect(isHandoverSignature(123456)).toBe(false);
    expect(isHandoverSignature({ toString: () => SIG })).toBe(false);
  });
});
