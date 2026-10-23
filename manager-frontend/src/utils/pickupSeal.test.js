import {
  PICKUP_KEY_PATTERN,
  newPickupSecret,
  isPickupSecret,
  pickupKeyFor,
  isPickupKey,
  isSealed,
  sealDetails,
  sealDetailsWith,
  openDetails,
  parseEstablishmentOrder,
  parseWorkerPayload,
} from './pickupSeal';

// Fixed vectors, computed once outside this module with tweetnacl and Node's
// crypto. The same file is in the three dApps, so the three copies of
// pickupSeal.js cannot drift apart.
const K = 'AAECAwQFBgcICQoLDA0ODw'; // bytes 00 01 .. 0f
const S = '8OHSw7Sllod4aVpLPC0eDw'; // bytes f0 e1 d2 c3 b4 a5 96 87 78 69 5a 4b 3c 2d 1e 0f
const ORDER_ID = 7;
const WORKER_1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const WORKER_2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

const KEY_WORKER_1 = 'dcpk1:mHyYqQwT6_c5_b6cKAwtyQ';
const KEY_WORKER_2 = 'dcpk1:Vh32Dp3DFxebtDusHX79Hw';
const KEY_ORDER_8 = 'dcpk1:TyUU_Dx67xB_93dg6izIAg';

const DETAILS = {
  deliveryAddress: 'Rua São João, 100, apto 3',
  items: [
    { name: 'Pão de queijo', quantity: 1, price: 7 },
    { name: 'Café ☕ 😀', quantity: 1, price: 5 },
  ],
};
const SEALED =
  'dcs1:7dr3lfLm_YAfpDyFBbXpJG6qQAmBsR5UOuOwON4iqB0UH2Pwahb2JtcGJKKUZ4x-EB4T9cMCsle7RIfjtazsvv' +
  'n1Zgc45WLFuWwWE3BpYWRMvKzB7livPbbCQEHyxa6duSTbwgAreyTMB8acZhg4FhajT1BPa8tRnAz8rUhjmqVeT1Jv' +
  'aYkHnhYjArm1KGrt9A6iBpBqlsSJwui1BaCZqi45dhgE8w7btZ7Hsek';
// SEALED with one bit flipped in byte 40 of the box (ciphertext) and in byte 0 (tag)
const SEALED_FLIPPED = SEALED.replace('ahb2JtcGJKKU', 'ahb2JtMGJKKU');
const SEALED_FLIPPED_TAG = 'dcs1:b' + SEALED.slice(6);

const ASCII_DETAILS = { deliveryAddress: '1 Main St', items: [] };
const SEALED_ASCII = 'dcs1:_-GiBwq5NkR5zdPWQH-VT26qQAmBsR5UOuOwON4iqB0UH2PwCUPaZ-2rp57AD8-f2gVauIEQuCDGWA';

function mismatch(fn) {
  expect(fn).toThrow('PICKUP_KEY_MISMATCH');
}

describe('pickup key derivation', () => {
  it('matches the fixed vectors', () => {
    expect(pickupKeyFor(K, ORDER_ID, WORKER_1)).toBe(KEY_WORKER_1);
    expect(pickupKeyFor(K, ORDER_ID, WORKER_2)).toBe(KEY_WORKER_2);
    expect(pickupKeyFor(K, 8, WORKER_1)).toBe(KEY_ORDER_8);
  });

  it('does not depend on the case of the address or on the type of the order id', () => {
    expect(pickupKeyFor(K, '7', WORKER_1.toLowerCase())).toBe(KEY_WORKER_1);
    expect(pickupKeyFor(K, 7, '0x' + WORKER_1.slice(2).toUpperCase())).toBe(KEY_WORKER_1);
  });

  it('gives a different key for another secret', () => {
    expect(pickupKeyFor('AAECAwQFBgcICQoLDA0ODg', ORDER_ID, WORKER_1)).not.toBe(KEY_WORKER_1);
  });

  it('rejects malformed input', () => {
    expect(() => pickupKeyFor('short', ORDER_ID, WORKER_1)).toThrow('Invalid pickup secret');
    expect(() => pickupKeyFor(null, ORDER_ID, WORKER_1)).toThrow('Invalid pickup secret');
    expect(() => pickupKeyFor(K, '7|x', WORKER_1)).toThrow('Invalid order id');
    expect(() => pickupKeyFor(K, undefined, WORKER_1)).toThrow('Invalid order id');
    expect(() => pickupKeyFor(K, ORDER_ID, WORKER_1.slice(2))).toThrow('Invalid worker address');
    expect(() => pickupKeyFor(K, ORDER_ID, null)).toThrow('Invalid worker address');
  });
});

describe('patterns', () => {
  it('uses the expected pickup key pattern', () => {
    expect(PICKUP_KEY_PATTERN.source).toBe('^dcpk1:[A-Za-z0-9_-]{22}$');
  });

  it('recognises pickup keys', () => {
    expect(KEY_WORKER_1).toHaveLength(28);
    expect(isPickupKey(KEY_WORKER_1)).toBe(true);
    expect(isPickupKey(KEY_WORKER_1 + 'A')).toBe(false);
    expect(isPickupKey(KEY_WORKER_1.slice(0, -1))).toBe(false);
    expect(isPickupKey(' ' + KEY_WORKER_1)).toBe(false);
    expect(isPickupKey(KEY_WORKER_1 + '\n')).toBe(false);
    expect(isPickupKey('dcpk2:' + KEY_WORKER_1.slice(6))).toBe(false);
    expect(isPickupKey(KEY_WORKER_1.replace('_', '/'))).toBe(false);
    expect(isPickupKey(K)).toBe(false);
    expect(isPickupKey('0x' + 'ab'.repeat(65))).toBe(false); // a handover signature
    expect(isPickupKey(null)).toBe(false);
    expect(isPickupKey(undefined)).toBe(false);
    expect(isPickupKey(123)).toBe(false);
  });

  it('recognises pickup secrets', () => {
    expect(isPickupSecret(K)).toBe(true);
    expect(isPickupSecret(K + 'A')).toBe(false);
    expect(isPickupSecret(K.slice(1))).toBe(false);
    expect(isPickupSecret('AAECAwQFBgcICQoLDA0OD=')).toBe(false);
    expect(isPickupSecret(KEY_WORKER_1)).toBe(false);
    expect(isPickupSecret(null)).toBe(false);
    expect(isPickupSecret(['AAECAwQFBgcICQoLDA0ODw'])).toBe(false);
  });

  it('recognises sealed text', () => {
    expect(isSealed(SEALED)).toBe(true);
    expect(isSealed(SEALED_ASCII)).toBe(true);
    expect(isSealed('dcs1:')).toBe(false);
    expect(isSealed('dcs1:ab cd')).toBe(false);
    expect(isSealed('0x7b2276657273696f6e223a227832353531392d7873616c736132302d706f6c7931333035227d')).toBe(false);
    expect(isSealed('')).toBe(false);
    expect(isSealed(null)).toBe(false);
    expect(isSealed(undefined)).toBe(false);
  });

  it('makes fresh 16-byte pickup secrets', () => {
    const a = newPickupSecret();
    const b = newPickupSecret();
    expect(a).toHaveLength(22);
    expect(isPickupSecret(a)).toBe(true);
    expect(isPickupSecret(b)).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('sealing and opening', () => {
  it('seals to the fixed vectors', () => {
    expect(sealDetailsWith(KEY_WORKER_1, S, DETAILS)).toBe(SEALED);
    expect(sealDetailsWith(KEY_WORKER_1, S, ASCII_DETAILS)).toBe(SEALED_ASCII);
  });

  it('opens the fixed vectors, with non-ASCII text unchanged', () => {
    expect(openDetails(KEY_WORKER_1, S, SEALED)).toEqual(DETAILS);
    expect(openDetails(KEY_WORKER_1, S, SEALED).deliveryAddress).toBe('Rua São João, 100, apto 3');
    expect(openDetails(KEY_WORKER_1, S, SEALED).items[1].name).toBe('Café ☕ 😀');
    expect(openDetails(KEY_WORKER_1, S, SEALED_ASCII)).toEqual(ASCII_DETAILS);
  });

  it('round-trips with a fresh s, different on every call', () => {
    const first = sealDetails(KEY_WORKER_1, DETAILS);
    const second = sealDetails(KEY_WORKER_1, DETAILS);
    expect(first.s).toHaveLength(22);
    expect(isSealed(first.sealed)).toBe(true);
    expect(first.s).not.toBe(second.s);
    expect(first.sealed).not.toBe(second.sealed);
    expect(openDetails(KEY_WORKER_1, first.s, first.sealed)).toEqual(DETAILS);
    expect(openDetails(KEY_WORKER_1, second.s, second.sealed)).toEqual(DETAILS);
    mismatch(() => openDetails(KEY_WORKER_1, first.s, second.sealed));
  });

  it('does not show the address or the items in the sealed text', () => {
    const sealed = sealDetailsWith(KEY_WORKER_1, S, ASCII_DETAILS);
    expect(sealed).not.toContain('Main');
    expect(sealed).not.toContain(K);
    expect(sealed).not.toContain(KEY_WORKER_1.slice(6));
  });

  it('refuses a wrong pickup key', () => {
    mismatch(() => openDetails('dcpk1:mHyYqQwT6_c5_b6cKAwtyA', S, SEALED));
  });

  it('refuses the key of another worker of the same order', () => {
    mismatch(() => openDetails(KEY_WORKER_2, S, SEALED));
  });

  it('refuses the key of another order', () => {
    mismatch(() => openDetails(KEY_ORDER_8, S, SEALED));
  });

  it('refuses a wrong s', () => {
    mismatch(() => openDetails(KEY_WORKER_1, '8OHSw7Sllod4aVpLPC0eDg', SEALED));
  });

  it('refuses a box with one flipped bit', () => {
    expect(SEALED_FLIPPED).not.toBe(SEALED);
    expect(SEALED_FLIPPED).toHaveLength(SEALED.length);
    expect(SEALED_FLIPPED_TAG).toHaveLength(SEALED.length);
    mismatch(() => openDetails(KEY_WORKER_1, S, SEALED_FLIPPED));
    mismatch(() => openDetails(KEY_WORKER_1, S, SEALED_FLIPPED_TAG));
  });

  it('refuses malformed input without another error', () => {
    mismatch(() => openDetails(KEY_WORKER_1, S, SEALED.slice(0, -4)));
    mismatch(() => openDetails(KEY_WORKER_1, S, SEALED + 'A'));
    mismatch(() => openDetails(KEY_WORKER_1, S, 'dcs1:AAAA'));
    mismatch(() => openDetails(KEY_WORKER_1, S, SEALED.slice(5)));
    mismatch(() => openDetails(KEY_WORKER_1, S, ''));
    mismatch(() => openDetails(KEY_WORKER_1, S, null));
    mismatch(() => openDetails(KEY_WORKER_1, undefined, SEALED));
    mismatch(() => openDetails(KEY_WORKER_1, S + 'A', SEALED));
    mismatch(() => openDetails(KEY_WORKER_1.slice(6), S, SEALED));
    mismatch(() => openDetails(' ' + KEY_WORKER_1, S, SEALED));
    mismatch(() => openDetails(null, S, SEALED));
    mismatch(() => openDetails(K, S, SEALED));
  });

  it('refuses to seal with a malformed key or s', () => {
    expect(() => sealDetailsWith(K, S, DETAILS)).toThrow('Invalid pickup key');
    expect(() => sealDetails(null, DETAILS)).toThrow('Invalid pickup key');
    expect(() => sealDetailsWith(KEY_WORKER_1, 'abc', DETAILS)).toThrow('Invalid seal value');
    expect(() => sealDetailsWith(KEY_WORKER_1, S, undefined)).toThrow('Nothing to seal');
  });
});

describe('parseEstablishmentOrder', () => {
  const items = [{ name: 'Pão de queijo', quantity: 1, price: 7 }];

  it('reads the new format', () => {
    expect(parseEstablishmentOrder(JSON.stringify({ items: items, k: K })))
      .toEqual({ items: items, pickupSecret: K });
  });

  it('accepts the legacy item array', () => {
    expect(parseEstablishmentOrder(JSON.stringify(items))).toEqual({ items: items, pickupSecret: null });
    expect(parseEstablishmentOrder('[]')).toEqual({ items: [], pickupSecret: null });
  });

  it('ignores a pickup secret that is not well formed', () => {
    expect(parseEstablishmentOrder(JSON.stringify({ items: items, k: 'abc' })).pickupSecret).toBeNull();
    expect(parseEstablishmentOrder(JSON.stringify({ items: items, k: 5 })).pickupSecret).toBeNull();
    expect(parseEstablishmentOrder(JSON.stringify({ items: items })).pickupSecret).toBeNull();
  });

  it('throws on anything else', () => {
    expect(() => parseEstablishmentOrder('{"k":"' + K + '"}')).toThrow('Unexpected order format');
    expect(() => parseEstablishmentOrder('null')).toThrow('Unexpected order format');
    expect(() => parseEstablishmentOrder('"text"')).toThrow('Unexpected order format');
    expect(() => parseEstablishmentOrder('not json')).toThrow();
  });
});

describe('parseWorkerPayload', () => {
  it('reads the new format', () => {
    expect(parseWorkerPayload(JSON.stringify({ restaurantId: 12, s: S }))).toEqual({ restaurantId: 12, s: S });
    expect(parseWorkerPayload(JSON.stringify({ restaurantId: null, s: S }))).toEqual({ restaurantId: null, s: S });
    expect(parseWorkerPayload(JSON.stringify({ s: S }))).toEqual({ restaurantId: null, s: S });
  });

  it('reads the legacy format', () => {
    expect(parseWorkerPayload(JSON.stringify({ deliveryAddress: 'Rua São João, 100', restaurantId: 12 })))
      .toEqual({ restaurantId: 12, deliveryAddress: 'Rua São João, 100' });
    expect(parseWorkerPayload(JSON.stringify({ deliveryAddress: '1 Main St', restaurantId: null })))
      .toEqual({ restaurantId: null, deliveryAddress: '1 Main St' });
  });

  it('reads the oldest format, a plain address', () => {
    expect(parseWorkerPayload('1 Main St, door 2')).toEqual({ deliveryAddress: '1 Main St, door 2' });
    expect(parseWorkerPayload('12345')).toEqual({ deliveryAddress: '12345' });
    expect(parseWorkerPayload('"quoted"')).toEqual({ deliveryAddress: '"quoted"' });
  });

  it('treats an object without address and without a well formed s as plain text', () => {
    expect(parseWorkerPayload('{"restaurantId":3}')).toEqual({ deliveryAddress: '{"restaurantId":3}' });
    expect(parseWorkerPayload('{"restaurantId":3,"s":"abc"}')).toEqual({ deliveryAddress: '{"restaurantId":3,"s":"abc"}' });
    expect(parseWorkerPayload('[1,2]')).toEqual({ deliveryAddress: '[1,2]' });
  });
});
