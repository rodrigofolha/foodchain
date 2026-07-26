/* global BigInt */
/**
 * Stealth Address Utilities (Manager/Restaurant Side) — EIP-5564 Additive Scheme
 *
 * The restaurant generates two keypairs on first use:
 *   - Spend keypair (s, S): used to derive stealth private keys
 *   - View keypair (v, V): used for ECDH shared secret computation and scanning
 *
 * Stealth address derivation (additive scheme):
 *   stealthPub  = S + hash(ECDH(v, E)) * G    (customer computes using public keys only)
 *   stealthPriv = s + hash(ECDH(v, E)) mod n   (only restaurant can compute, requires s)
 *
 * The customer CANNOT derive the stealth private key because they don't know s.
 */

import { ethers } from 'ethers';

var EC = require('elliptic').ec;
var ec = new EC('secp256k1');

var CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
var STORAGE_KEY = 'restaurantStealthKeys';
var SPEND_KEY_STORAGE = 'restaurantSpendKey';

/**
 * Generate a random 32-byte hex string.
 */
function randomHexKey() {
  var bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

/**
 * Get or generate the restaurant's dual keypair (spend + view).
 * Stored in localStorage for persistence.
 *
 * @returns {Object} { privateKey, publicKey, publicKeyCompressed, viewPrivateKey, viewPublicKey, viewPublicKeyCompressed }
 */
export function getOrCreateSpendKey() {
  var stored = localStorage.getItem(SPEND_KEY_STORAGE);
  if (stored) {
    var parsed = JSON.parse(stored);
    // Migrate old format (single key) to dual key
    if (!parsed.viewPrivateKey) {
      var viewPriv = randomHexKey();
      var viewSigningKey = new ethers.utils.SigningKey('0x' + viewPriv);
      parsed.viewPrivateKey = viewPriv;
      parsed.viewPublicKey = viewSigningKey.publicKey;
      parsed.viewPublicKeyCompressed = ethers.utils.computePublicKey(viewSigningKey.publicKey, true);
      localStorage.setItem(SPEND_KEY_STORAGE, JSON.stringify(parsed));
    }
    return parsed;
  }

  // Generate new spend key
  var spendPriv = randomHexKey();
  var spendSigningKey = new ethers.utils.SigningKey('0x' + spendPriv);
  var spendPub = spendSigningKey.publicKey;
  var spendPubCompressed = ethers.utils.computePublicKey(spendPub, true);

  // Generate new view key
  var viewPriv = randomHexKey();
  var viewSigningKey2 = new ethers.utils.SigningKey('0x' + viewPriv);
  var viewPub = viewSigningKey2.publicKey;
  var viewPubCompressed = ethers.utils.computePublicKey(viewPub, true);

  var keys = {
    privateKey: spendPriv,
    publicKey: spendPub,
    publicKeyCompressed: spendPubCompressed,
    viewPrivateKey: viewPriv,
    viewPublicKey: viewPub,
    viewPublicKeyCompressed: viewPubCompressed
  };
  localStorage.setItem(SPEND_KEY_STORAGE, JSON.stringify(keys));
  return keys;
}

/**
 * Decompress a public key if needed.
 */
function decompressPubKey(pubKey) {
  var pk = pubKey;
  if (!pk.startsWith('0x')) pk = '0x' + pk;
  if (pk.length === 68) {
    pk = ethers.utils.computePublicKey(pk, false);
  }
  return pk;
}

/**
 * Derive the stealth private key from an ephemeral public key (EIP-5564 additive scheme).
 *
 * stealthPriv = spendPriv + hash(ECDH(viewPriv, ephemeralPub)) mod curveOrder
 *
 * Only the restaurant can compute this because it requires spendPriv.
 *
 * @param {string} spendPrivateKey - Restaurant's spend private key (hex, no 0x)
 * @param {string} viewPrivateKey - Restaurant's view private key (hex, no 0x)
 * @param {string} ephemeralPubKey - Ephemeral public key from Announcement event (hex)
 * @returns {Object} { stealthPrivateKey, stealthAddress }
 */
export function deriveStealthPrivateKey(spendPrivateKey, viewPrivateKey, ephemeralPubKey) {
  // Compute shared secret using VIEW key (not spend key)
  var viewSigningKey = new ethers.utils.SigningKey('0x' + viewPrivateKey);
  var pubKey = decompressPubKey(ephemeralPubKey);
  var sharedPoint = viewSigningKey.computeSharedSecret(pubKey);
  var sharedSecretX = sharedPoint.slice(0, 66); // x-coordinate only

  // Hash the shared secret
  var hashedSecret = ethers.utils.keccak256(sharedSecretX);
  var h = BigInt(hashedSecret) % CURVE_ORDER;

  // Additive scheme: stealthPriv = (spendPriv + h) mod curveOrder
  var spendPrivScalar = BigInt('0x' + spendPrivateKey);
  var stealthPrivScalar = (spendPrivScalar + h) % CURVE_ORDER;
  var stealthPrivHex = stealthPrivScalar.toString(16).padStart(64, '0');

  // Derive address from stealth private key
  var stealthSigningKey = new ethers.utils.SigningKey('0x' + stealthPrivHex);
  var stealthAddress = ethers.utils.computeAddress(stealthSigningKey.publicKey);

  return { stealthPrivateKey: stealthPrivHex, stealthAddress: stealthAddress };
}

/**
 * Scan Announcement events and find orders addressed to this restaurant.
 *
 * @param {Object} stealthContract - ethers.Contract instance of StealthAnnouncer
 * @param {string} spendPrivateKey - Restaurant's spend private key (hex, no 0x)
 * @param {string} viewPrivateKey - Restaurant's view private key (hex, no 0x)
 * @param {number} fromBlock - Block to start scanning from (DEPLOY_BLOCK)
 * @returns {Promise<Array>} Array of { stealthAddress, stealthPrivateKey, ephemeralPubKey, blockNumber }
 */
export async function scanAnnouncements(stealthContract, spendPrivateKey, viewPrivateKey, fromBlock) {
  var schemeId = 1; // secp256k1 ECDH
  var filter = stealthContract.filters.Announcement(schemeId);
  var events = await stealthContract.queryFilter(filter, fromBlock, 'latest');

  var matches = [];

  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    var announcedAddress = event.args.stealthAddress;
    var ephemeralPubKey = event.args.ephemeralPubKey;
    var viewTag = event.args.viewTag;

    try {
      // Quick view tag check using VIEW key
      var viewSigningKey = new ethers.utils.SigningKey('0x' + viewPrivateKey);
      var pubKey = decompressPubKey(ephemeralPubKey);
      var sharedPoint = viewSigningKey.computeSharedSecret(pubKey);
      var sharedSecretX = sharedPoint.slice(0, 66);
      var computedViewTag = parseInt(sharedSecretX.slice(2, 4), 16);

      if (computedViewTag !== viewTag) continue; // Fast rejection

      // Full derivation using additive scheme
      var result = deriveStealthPrivateKey(spendPrivateKey, viewPrivateKey, ephemeralPubKey);

      if (result.stealthAddress.toLowerCase() === announcedAddress.toLowerCase()) {
        matches.push({
          stealthAddress: result.stealthAddress,
          stealthPrivateKey: result.stealthPrivateKey,
          ephemeralPubKey: ephemeralPubKey,
          blockNumber: event.blockNumber,
        });
      }
    } catch (e) {
      console.warn('Failed to process stealth announcement:', e);
    }
  }

  return matches;
}

/**
 * Store a discovered stealth key in localStorage.
 */
export function storeStealthKey(stealthAddress, stealthPrivateKey) {
  var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  stored[stealthAddress.toLowerCase()] = stealthPrivateKey;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/**
 * Get a stored stealth private key for a given address.
 */
export function getStealthKey(stealthAddress) {
  var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  return stored[stealthAddress.toLowerCase()] || null;
}

/**
 * Get all stored stealth addresses.
 */
export function getAllStealthAddresses() {
  var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  return Object.keys(stored);
}
