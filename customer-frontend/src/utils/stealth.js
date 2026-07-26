/* global BigInt */
/**
 * Stealth Address Utilities (Customer Side) — EIP-5564 Additive Scheme
 *
 * Uses secp256k1 ECDH to derive one-time stealth addresses for restaurants.
 * The restaurant publishes two public keys: spend (S) and view (V).
 *
 * Derivation (additive scheme):
 *   1. Customer generates ephemeral keypair (e, E)
 *   2. Computes shared secret: ECDH(e, V) — uses VIEW public key
 *   3. Hashes shared secret: h = hash(sharedSecret)
 *   4. Derives stealth PUBLIC key: P_stealth = S + h*G (point addition)
 *   5. Derives stealth address from P_stealth
 *
 * The customer CANNOT derive the stealth PRIVATE key because that requires:
 *   p_stealth = s + h mod n
 * and the customer does not know s (the spend private key).
 */

import { ethers } from 'ethers';

var EC = require('elliptic').ec;
var ec = new EC('secp256k1');

// secp256k1 curve order
var CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

/**
 * Generate a random 32-byte private key (as hex string without 0x prefix)
 */
function randomPrivateKey() {
  var bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
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
 * Convert a hex public key (0x04... uncompressed) to an elliptic.js Point.
 */
function hexToPoint(hexPubKey) {
  var pk = decompressPubKey(hexPubKey);
  // Remove 0x prefix
  var hex = pk.startsWith('0x') ? pk.slice(2) : pk;
  return ec.keyFromPublic(hex, 'hex').getPublic();
}

/**
 * Convert an elliptic.js Point to an Ethereum address.
 */
function pointToAddress(point) {
  // Encode as uncompressed (04 + x + y)
  var uncompressedHex = '0x' + point.encode('hex');
  return ethers.utils.computeAddress(uncompressedHex);
}

/**
 * Derive a stealth address from a restaurant's spend and view public keys.
 * EIP-5564 additive scheme: stealthPub = spendPub + hash(ECDH(ephemeralPriv, viewPub)) * G
 *
 * The customer can derive the stealth ADDRESS but NOT the stealth PRIVATE KEY.
 *
 * @param {string} restaurantSpendPubKey - Restaurant's spend public key (hex)
 * @param {string} restaurantViewPubKey - Restaurant's view public key (hex)
 * @returns {Object} { stealthAddress, ephemeralPubKey, viewTag }
 */
export function deriveStealthAddress(restaurantSpendPubKey, restaurantViewPubKey) {
  // 1. Generate ephemeral keypair
  var ephemeralPriv = randomPrivateKey();
  var ephemeralSigningKey = new ethers.utils.SigningKey('0x' + ephemeralPriv);
  var ephemeralPub = ephemeralSigningKey.publicKey; // uncompressed
  var ephemeralPubCompressed = ethers.utils.computePublicKey(ephemeralPub, true);

  // 2. Compute shared secret: ECDH(ephemeralPriv, viewPub) — uses VIEW key
  var viewPub = decompressPubKey(restaurantViewPubKey);
  var sharedPoint = ephemeralSigningKey.computeSharedSecret(viewPub);
  var sharedSecretX = sharedPoint.slice(0, 66); // x-coordinate only

  // 3. Hash the shared secret
  var hashedSecret = ethers.utils.keccak256(sharedSecretX);
  var h = BigInt(hashedSecret) % CURVE_ORDER;
  var hHex = h.toString(16).padStart(64, '0');

  // 4. Compute h * G (the public key corresponding to scalar h)
  var hPoint = ec.keyFromPrivate(hHex, 'hex').getPublic();

  // 5. Compute stealth public key: S + h*G (point addition)
  var spendPoint = hexToPoint(restaurantSpendPubKey);
  var stealthPoint = spendPoint.add(hPoint);

  // 6. Derive stealth address
  var stealthAddress = pointToAddress(stealthPoint);

  // 7. View tag: first byte of shared secret (for fast scanning)
  var viewTag = parseInt(sharedSecretX.slice(2, 4), 16);

  return {
    stealthAddress: stealthAddress,
    ephemeralPubKey: ephemeralPubCompressed, // compressed, 33 bytes
    viewTag: viewTag,
    // NOTE: No stealthPrivateKey returned — customer cannot derive it
  };
}

/**
 * Announce a stealth address via the StealthAnnouncer contract.
 *
 * @param {Object} stealthContract - web3 Contract instance of StealthAnnouncer
 * @param {string} stealthAddress - The derived stealth address
 * @param {string} ephemeralPubKey - Compressed ephemeral public key (hex)
 * @param {number} viewTag - View tag byte
 * @param {string} fromAddress - Sender address
 * @returns {Promise<Object>} Transaction receipt
 */
export async function announceStealthAddress(stealthContract, stealthAddress, ephemeralPubKey, viewTag, fromAddress) {
  var schemeId = 1; // secp256k1 ECDH
  return stealthContract.methods.announce(schemeId, stealthAddress, ephemeralPubKey, viewTag)
    .send({ from: fromAddress, gas: 200000 });
}

/**
 * Estimate gas stipend needed for a stealth address to perform restaurant operations.
 *
 * @param {Object} web3 - web3 instance
 * @returns {Promise<string>} Estimated gas stipend in wei (as string)
 */
export async function estimateGasStipend(web3) {
  var gasPrice = await web3.eth.getGasPrice();
  var gasNeeded = BigInt(1050000);
  return (gasNeeded * BigInt(gasPrice)).toString();
}
