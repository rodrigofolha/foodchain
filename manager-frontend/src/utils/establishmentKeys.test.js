import {
  readStoredSpendKey,
  holdsPublishedStealthKeys,
  isPublishedEncryptionKey,
  settingsAccess,
} from './establishmentKeys';

const SPEND = '0x02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
const VIEW = '0x03112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00';
const OTHER = '0x02ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const ENC = 'fTm2aWc1TnE0dXJ5ZGtWb1hPdGZxY0p1b2pBbUJxWnE=';

const stored = { publicKeyCompressed: SPEND, viewPublicKeyCompressed: VIEW };
const published = { id: 7, public_key: ENC, spend_public_key: SPEND, view_public_key: VIEW };

describe('holdsPublishedStealthKeys', () => {
  it('accepts the published pair, whatever the letter case', () => {
    expect(holdsPublishedStealthKeys(stored, published)).toBe(true);
    expect(holdsPublishedStealthKeys(stored, { ...published, spend_public_key: SPEND.toUpperCase().replace('0X', '0x') })).toBe(true);
  });
  it('rejects another spend key or another view key', () => {
    expect(holdsPublishedStealthKeys({ ...stored, publicKeyCompressed: OTHER }, published)).toBe(false);
    expect(holdsPublishedStealthKeys({ ...stored, viewPublicKeyCompressed: OTHER }, published)).toBe(false);
  });
  it('rejects when nothing is stored or nothing is published', () => {
    expect(holdsPublishedStealthKeys(null, published)).toBe(false);
    expect(holdsPublishedStealthKeys(stored, { id: 7 })).toBe(false);
    expect(holdsPublishedStealthKeys({}, { id: 7 })).toBe(false);
  });
  it('compares only the spend key of a record without a view key', () => {
    expect(holdsPublishedStealthKeys(stored, { id: 7, spend_public_key: SPEND })).toBe(true);
  });
});

describe('isPublishedEncryptionKey', () => {
  it('accepts only the exact published key', () => {
    expect(isPublishedEncryptionKey(ENC, published)).toBe(true);
    expect(isPublishedEncryptionKey(ENC.toLowerCase(), published)).toBe(false);
    expect(isPublishedEncryptionKey('', { id: 7, public_key: '' })).toBe(false);
    expect(isPublishedEncryptionKey(undefined, { id: 7 })).toBe(false);
  });
});

describe('settingsAccess', () => {
  it('waits for the record', () => {
    expect(settingsAccess(stored, '')).toBe('loading');
    expect(settingsAccess(stored, {})).toBe('loading');
  });
  it('opens when this browser holds the published stealth keys', () => {
    expect(settingsAccess(stored, published)).toBe('open');
  });
  it('asks for the wallet when the stealth keys are missing, different or not published', () => {
    expect(settingsAccess(null, published)).toBe('wallet');
    expect(settingsAccess({ ...stored, publicKeyCompressed: OTHER }, published)).toBe('wallet');
    expect(settingsAccess(null, { id: 7, public_key: ENC })).toBe('wallet');
  });
  it('opens when the record has no encryption key to check against', () => {
    expect(settingsAccess(null, { id: 7, spend_public_key: SPEND })).toBe('open');
    expect(settingsAccess(null, { id: 7 })).toBe('open');
  });
});

describe('readStoredSpendKey', () => {
  afterEach(() => localStorage.clear());
  it('returns null when there is none and does not create one', () => {
    expect(readStoredSpendKey()).toBe(null);
    expect(localStorage.getItem('restaurantSpendKey')).toBe(null);
  });
  it('returns the stored keys and survives a broken entry', () => {
    localStorage.setItem('restaurantSpendKey', JSON.stringify(stored));
    expect(readStoredSpendKey()).toEqual(stored);
    localStorage.setItem('restaurantSpendKey', '{broken');
    expect(readStoredSpendKey()).toBe(null);
  });
});
