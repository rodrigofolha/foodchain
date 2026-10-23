// Browser storage of one deployment.
//
// A new deployment starts an empty pool and numbers its orders from 1 again, so what this
// browser keeps about the pool and about orders belongs to one deployment only: it is stored
// under '<name>@<chain id>:<Chain address>'. What belongs to the person stays under its plain
// name (PERSON_KEYS).
//
// Data stored under the plain names before this file existed is left where it is and is never
// read: it cannot be told which deployment it belongs to.

var config = require('../services/config');

// Stored per deployment. Every one of these is read and written through this file only.
export const DEPLOYMENT_KEYS = [
  'restaurantPaymentNotes', // notes of the payment pool (zkWithdraw.js)
  'paymentNoteSecrets',     // secrets of the note each accepted order pays to (paymentSecrets.js)
  'poolCashoutPending',     // pool withdrawals sent and not recorded yet (cashout.js)
  'poolCashoutAside',       // pool withdrawals the person set aside (cashout.js)
  'poolCashoutLedger',      // what was cashed out so far (cashout.js)
  'orderFundings',          // what the pool paid to each order's one-time address (orderFunding.js)
  'gasReturns',             // unused gas money sent back to the pool, not recorded yet (gasReturn.js)
  'poolDeposits',           // deposits handed to the wallet, not recorded yet (poolDeposit.js)
  'pickupConfirmations',    // checked pickup confirmations, by order number (pickupKeyDisplay.js)
  'restaurantOrderSecrets', // rating secrets of older orders, by order number (not read)
];

// Not bound to a deployment: the person's keys and their session with the API.
export const PERSON_KEYS = [
  'restaurantSpendKey',     // spend and view keys of the establishment
  'restaurantStealthKeys',  // one-time keys derived from them, by address
  'authorization',
  'userLogged',
];

// Chain ids of the networks a configuration can name by its RPC address
var KNOWN_NETWORKS = [
  { pattern: /hoodi/i, chainId: 560048 },
  { pattern: /sepolia/i, chainId: 11155111 },
  { pattern: /\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i, chainId: 31337 },
];

/**
 * The chain id of the configured deployment: config.js's CHAIN_ID when it exports one,
 * otherwise the network its RPC address names (Hoodi, Sepolia, or a local node). 0 when neither
 * tells: the Chain address alone then separates the deployments.
 */
export function configuredChainId() {
  if (config.CHAIN_ID !== undefined && config.CHAIN_ID !== null && config.CHAIN_ID !== '') {
    return Number(config.CHAIN_ID);
  }
  var rpc = String(config.SEPOLIA_RPC_URL || '');
  for (var i = 0; i < KNOWN_NETWORKS.length; i++) {
    if (KNOWN_NETWORKS[i].pattern.test(rpc)) return KNOWN_NETWORKS[i].chainId;
  }
  return 0;
}

/** '<chain id>:<Chain address in lower case>' */
export function deploymentId() {
  return configuredChainId() + ':' + String(config.CHAIN_ADDRESS || '').toLowerCase();
}

/** The localStorage key of `name` for the configured deployment. */
export function deploymentKey(name) {
  if (DEPLOYMENT_KEYS.indexOf(name) < 0) throw new Error('Not a storage name of a deployment: ' + name);
  return name + '@' + deploymentId();
}

/** The stored value, parsed; `fallback` when nothing is stored for this deployment. */
export function readDeployment(name, fallback) {
  var raw = localStorage.getItem(deploymentKey(name));
  return raw === null || raw === undefined ? fallback : JSON.parse(raw);
}

export function writeDeployment(name, value) {
  localStorage.setItem(deploymentKey(name), JSON.stringify(value));
}

export function removeDeployment(name) {
  localStorage.removeItem(deploymentKey(name));
}
