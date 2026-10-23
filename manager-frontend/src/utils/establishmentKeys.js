// Checks that this browser and the connected account belong to the establishment,
// using only the keys the establishment published. No wallet address is stored.

var SPEND_KEY_STORAGE = 'restaurantSpendKey';

function sameHex(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a !== '' && a.toLowerCase() === b.toLowerCase();
}

// Reads the stealth keys kept in this browser without creating any.
export function readStoredSpendKey() {
  try {
    return JSON.parse(localStorage.getItem(SPEND_KEY_STORAGE)) || null;
  } catch (e) {
    return null;
  }
}

// True when the stealth keys kept in this browser are the published ones.
// A published view key is compared too; old records have only the spend key.
export function holdsPublishedStealthKeys(stored, published) {
  if (!stored || !published) return false;
  if (!sameHex(stored.publicKeyCompressed, published.spend_public_key)) return false;
  if (published.view_public_key) {
    return sameHex(stored.viewPublicKeyCompressed, published.view_public_key);
  }
  return true;
}

// True when the encryption key of the connected account is the published one.
// The encryption key is derived by the wallet from the account, so only the
// account used at registration gives the same key.
export function isPublishedEncryptionKey(accountKey, published) {
  return typeof accountKey === 'string' && accountKey !== '' &&
    !!published && accountKey === published.public_key;
}

// What the settings form needs before it can be used:
//   'loading' - the establishment's record has not arrived yet
//   'open'    - this browser holds the published stealth keys, or the record has no
//               encryption key to check an account against
//   'wallet'  - the connected account has to show the published encryption key
export function settingsAccess(stored, published) {
  if (!published || !published.id) return 'loading';
  if (holdsPublishedStealthKeys(stored, published)) return 'open';
  if (published.public_key) return 'wallet';
  return 'open';
}
