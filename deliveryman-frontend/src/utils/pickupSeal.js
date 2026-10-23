// Late release of the customer's data ("pickup key").
//
// The delivery address and the items are sealed with a key that the worker can
// build only from two parts: `s`, which the customer encrypts for the worker's
// MetaMask key, and the pickup key, which the establishment shows at pickup.
// The establishment derives the pickup key from the pickup secret `k` that the
// customer puts in the order, so a worker who gives up before pickup has not
// read the delivery address.
//
// This file is the same, byte for byte, in the three dApps.
import nacl from 'tweetnacl';

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/; // 16 bytes in base64url
const SEALED_PATTERN = /^dcs1:[A-Za-z0-9_-]+$/;

export const PICKUP_KEY_PATTERN = /^dcpk1:[A-Za-z0-9_-]{22}$/;

// base64url without padding
function toBase64Url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64URL[b0 >> 2];
    out += B64URL[((b0 & 3) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) out += B64URL[((b1 & 15) << 2) | (b2 >> 6)];
    if (i + 2 < bytes.length) out += B64URL[b2 & 63];
  }
  return out;
}

// Returns null for text that is not base64url, or whose unused last bits are not zero.
function fromBase64Url(text) {
  if (typeof text !== 'string' || text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor(text.length * 3 / 4));
  let acc = 0;
  let bits = 0;
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const v = B64URL.indexOf(text[i]);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 255;
      acc &= (1 << bits) - 1;
    }
  }
  return acc === 0 ? out : null;
}

// TextEncoder is missing in some test environments, so UTF-8 is done here.
function toUtf8(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd; // a surrogate without its pair
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    } else if (c < 0x10000) {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    } else {
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return new Uint8Array(out);
}

// Returns null for bytes that are not valid UTF-8.
function fromUtf8(bytes) {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    let extra;
    let c;
    let min;
    if (b < 0x80) { extra = 0; c = b; min = 0; }
    else if (b >= 0xc0 && b < 0xe0) { extra = 1; c = b & 31; min = 0x80; }
    else if (b >= 0xe0 && b < 0xf0) { extra = 2; c = b & 15; min = 0x800; }
    else if (b >= 0xf0 && b < 0xf8) { extra = 3; c = b & 7; min = 0x10000; }
    else return null;
    for (; extra > 0; extra--) {
      if (i >= bytes.length || (bytes[i] & 0xc0) !== 0x80) return null;
      c = (c << 6) | (bytes[i++] & 63);
    }
    if (c < min || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return null;
    if (c < 0x10000) {
      out += String.fromCharCode(c);
    } else {
      c -= 0x10000;
      out += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 1023));
    }
  }
  return out;
}

function isToken(text) {
  return typeof text === 'string' && TOKEN_PATTERN.test(text);
}

// The pickup secret `k` of an order, as text. Only the customer and the
// establishment hold it.
export function newPickupSecret() {
  return toBase64Url(nacl.randomBytes(16));
}

export function isPickupSecret(text) {
  return isToken(text);
}

// The key the establishment shows to one worker. It is bound to the order and
// to that worker, so it does not open what was sealed for another worker.
export function pickupKeyFor(kText, orderId, workerAddress) {
  if (!isPickupSecret(kText)) throw new Error('Invalid pickup secret');
  if (!/^[0-9]+$/.test(String(orderId))) throw new Error('Invalid order id');
  if (typeof workerAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(workerAddress)) {
    throw new Error('Invalid worker address');
  }
  const h = nacl.hash(toUtf8('dcpk1|' + kText + '|' + String(orderId) + '|' + workerAddress.toLowerCase()));
  return 'dcpk1:' + toBase64Url(h.subarray(0, 16));
}

export function isPickupKey(text) {
  return typeof text === 'string' && PICKUP_KEY_PATTERN.test(text);
}

export function isSealed(text) {
  return typeof text === 'string' && SEALED_PATTERN.test(text);
}

// Key and nonce of one sealing. `s` is fresh for every sealing, so the pair is
// never used twice and the nonce does not need to be stored.
function boxKeys(pickupKey, sText) {
  const h = nacl.hash(toUtf8('dcs1|' + pickupKey + '|' + sText));
  return { key: h.subarray(0, 32), nonce: h.subarray(32, 56) };
}

// Seals `details` ({ deliveryAddress, items }) for the holder of `pickupKey`.
// `s` goes to the worker inside their own ciphertext; `sealed` goes on-chain as it is.
export function sealDetails(pickupKey, details) {
  const s = toBase64Url(nacl.randomBytes(16));
  return { s: s, sealed: sealDetailsWith(pickupKey, s, details) };
}

// Same as sealDetails with a given `s`. Only for tests: a repeated `s` repeats the nonce.
export function sealDetailsWith(pickupKey, sText, details) {
  if (!isPickupKey(pickupKey)) throw new Error('Invalid pickup key');
  if (!isToken(sText)) throw new Error('Invalid seal value');
  const text = JSON.stringify(details);
  if (typeof text !== 'string') throw new Error('Nothing to seal');
  const keys = boxKeys(pickupKey, sText);
  return 'dcs1:' + toBase64Url(nacl.secretbox(toUtf8(text), keys.nonce, keys.key));
}

// Opens what sealDetails produced. Any failure (wrong key, wrong `s`, changed
// or malformed text) is reported the same way.
export function openDetails(pickupKey, sText, sealed) {
  let details = null;
  if (isPickupKey(pickupKey) && isToken(sText) && isSealed(sealed)) {
    const box = fromBase64Url(sealed.slice(5));
    if (box) {
      const keys = boxKeys(pickupKey, sText);
      const plain = nacl.secretbox.open(box, keys.nonce, keys.key);
      const text = plain ? fromUtf8(plain) : null;
      if (text !== null) {
        try {
          details = JSON.parse(text);
        } catch (_) {
          details = null;
        }
      }
    }
  }
  if (details === null || typeof details !== 'object') throw new Error('PICKUP_KEY_MISMATCH');
  return details;
}

// What the establishment decrypts from an order: { items, k } now, the item
// array alone for orders placed before the pickup key existed.
export function parseEstablishmentOrder(plaintext) {
  const parsed = JSON.parse(plaintext);
  if (Array.isArray(parsed)) return { items: parsed, pickupSecret: null };
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
    return { items: parsed.items, pickupSecret: isPickupSecret(parsed.k) ? parsed.k : null };
  }
  throw new Error('Unexpected order format');
}

// What the worker decrypts from the first string of Storage's Information event:
// { restaurantId, s } now; { restaurantId, deliveryAddress } before the pickup
// key existed; a plain address string in the oldest orders.
export function parseWorkerPayload(plaintext) {
  let parsed = null;
  try {
    parsed = JSON.parse(plaintext);
  } catch (_) {
    parsed = null;
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const restaurantId = parsed.restaurantId === undefined ? null : parsed.restaurantId;
    if (parsed.deliveryAddress) return { restaurantId: restaurantId, deliveryAddress: parsed.deliveryAddress };
    if (isToken(parsed.s)) return { restaurantId: restaurantId, s: parsed.s };
  }
  return { deliveryAddress: plaintext };
}
