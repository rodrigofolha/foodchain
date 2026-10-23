// Establishment side of the late release of the delivery details (see pickupSeal.js).
//
// The pickup rule (a rule of the dApps, not of the contracts): the pickup key of an
// order is shown only when a fresh read of the chain says that the order is DISPATCHED
// and that its worker is the address the key is derived for. At the counter the worker
// shows the signed pickup confirmation, the establishment checks it and sends
// pickupOrder, and the key appears when the pickup is recorded.
import { isPickupSecret, pickupKeyFor } from './pickupSeal';
import { readDeployment, writeDeployment, removeDeployment } from './deploymentStorage';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const SIGNATURE_PATTERN = /^0x[0-9a-fA-F]{130}$/;
const DIGEST_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

// The pickup key to show for the worker who is committed to the order now.
// Null when the order has no pickup secret (placed before the pickup key
// existed) or no committed worker.
export function currentPickupKey(pickupSecret, orderId, workerAddress) {
  if (!isPickupSecret(pickupSecret)) return null;
  if (typeof workerAddress !== 'string' || workerAddress === ZERO_ADDRESS) return null;
  try {
    return pickupKeyFor(pickupSecret, orderId, workerAddress);
  } catch (_) {
    return null;
  }
}

// The pickup key block is shown while the worker may need the key: before pickup
// (WAITING), where it only says when the key will appear, and on the way (DISPATCHED).
export function showsPickupKey(status) {
  return status === 'WAITING' || status === 'DISPATCHED';
}

// What the card says in WAITING, where no key is shown whatever was scanned.
export const PICKUP_KEY_NOTICE = 'The pickup key appears here once the pickup is recorded on the chain; show it to the worker then.';

function sameAddress(a, b) {
  return typeof a === 'string' && typeof b === 'string' &&
    ADDRESS_PATTERN.test(a) && a !== ZERO_ADDRESS && a.toLowerCase() === b.toLowerCase();
}

// The answer of Chain.getOrder for the establishment, reduced to what the pickup
// rule needs. Throws when the answer has no status: the chain then did not show the
// order to this account, and nothing can be concluded from it.
export function chainOrderState(orderAddress, fields) {
  const status = fields && fields[3] !== undefined && fields[3] !== null ? String(fields[3]) : '';
  if (status === '') throw new Error('The order could not be read');
  return {
    orderAddress: String(orderAddress),
    status: status,
    worker: String(fields[8]),
    // time of the last change of step, in seconds (for WAITING: the commitment)
    updatedAt: Number(String(fields[7])),
  };
}

// Reads the order again, from its address through Chain, as `establishment` sees it
// (the account the order knows as its establishment). Only reads from the chain.
// Throws when the chain could not be read.
export async function readChainOrder(chain, orderId, establishment) {
  const orderAddress = await chain.methods.findAddress(orderId).call();
  const fields = await chain.methods.getOrder(orderAddress).call({ from: establishment });
  return chainOrderState(orderAddress, fields);
}

// True when the chain does not say what the card shows (step or committed worker):
// the card holds an older copy of the order and must be reloaded before anything
// is shown or sent from it.
export function orderChangedOnChain(cardStatus, cardWorker, fresh) {
  if (!fresh) return false;
  if (fresh.status !== cardStatus) return true;
  if (cardStatus !== 'WAITING' && cardStatus !== 'DISPATCHED') return false;
  return !sameAddress(fresh.worker, cardWorker);
}

// "Dispatch order" is possible only with a checked confirmation and a fresh read of
// the chain (chainOrderState) that says WAITING with the worker the card shows.
export function allowsDispatch(cardWorker, confirmationChecked, fresh) {
  return confirmationChecked === true && !!fresh && fresh.status === 'WAITING' && sameAddress(fresh.worker, cardWorker);
}

// The pickup key is released only when a fresh read of the chain says that the
// pickup is recorded (DISPATCHED) and that the order's worker is the one the card
// shows. Never in WAITING, whatever was scanned: a worker who can read the delivery
// address has then always been recorded as having picked the order up.
export function releasesPickupKey(cardStatus, cardWorker, fresh) {
  return cardStatus === 'DISPATCHED' && !!fresh && fresh.status === 'DISPATCHED' && sameAddress(fresh.worker, cardWorker);
}

// The key to show, or null. It is derived for the worker the chain names.
export function pickupKeyToShow(pickupSecret, orderId, cardStatus, cardWorker, fresh) {
  if (!releasesPickupKey(cardStatus, cardWorker, fresh)) return null;
  return currentPickupKey(pickupSecret, orderId, fresh.worker);
}

// Action number of the pickup in Order.handoverDigest (HANDOVER_PICKUP).
export const HANDOVER_PICKUP = 1;

// Order.pickupOrder rejects a signature whose s is above half the curve order.
const MAX_S = '7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0';

// True when `signature` is what Order.pickupOrder accepts for this order: an
// EIP-191 signature of `digest` (Chain.handoverDigest for the pickup and the
// committed worker) made by `workerAddress`. `accounts` is web3.eth.accounts.
// Never throws: anything it cannot check is not a pickup confirmation.
export function isPickupConfirmationOf(accounts, digest, signature, workerAddress) {
  if (typeof signature !== 'string' || !SIGNATURE_PATTERN.test(signature)) return false;
  if (typeof digest !== 'string' || !DIGEST_PATTERN.test(digest)) return false;
  if (typeof workerAddress !== 'string' || !ADDRESS_PATTERN.test(workerAddress)) return false;
  if (workerAddress === ZERO_ADDRESS) return false;
  const r = signature.slice(2, 66);
  const s = signature.slice(66, 130).toLowerCase();
  let v = parseInt(signature.slice(130), 16);
  if (v < 27) v += 27;
  if (v !== 27 && v !== 28) return false;
  if (s > MAX_S) return false;
  try {
    const signer = accounts.recover(digest, '0x' + r + s + v.toString(16));
    return typeof signer === 'string' && signer.toLowerCase() === workerAddress.toLowerCase();
  } catch (_) {
    return false;
  }
}

// Checks a pickup confirmation against the contract's own digest, so that a change
// of the digest in the contract needs no change here. Only reads from the chain.
// Returns true or false; throws when the chain could not be read.
export async function checkPickupConfirmation(web3, chain, orderId, workerAddress, signature) {
  if (typeof workerAddress !== 'string' || !ADDRESS_PATTERN.test(workerAddress)) return false;
  const orderAddress = await chain.methods.findAddress(orderId).call();
  const digest = await chain.methods.handoverDigest(orderAddress, HANDOVER_PICKUP, workerAddress).call();
  return isPickupConfirmationOf(web3.eth.accounts, digest, signature, workerAddress);
}

function readConfirmations() {
  try {
    const store = readDeployment('pickupConfirmations', {});
    return store && typeof store === 'object' && !Array.isArray(store) ? store : {};
  } catch (_) {
    return {};
  }
}

function writeConfirmations(store) {
  try {
    if (Object.keys(store).length === 0) removeDeployment('pickupConfirmations');
    else writeDeployment('pickupConfirmations', store);
  } catch (_) {
    // Storage is not available: the confirmation will be asked again after a reload.
  }
}

// A checked confirmation is kept until the order is dispatched, so that a page
// reload between scanning it and dispatching does not lose it. It is kept with the
// worker who signed it: after a new commitment it is not returned any more.
// (It is not a secret: the dispatch transaction publishes it.)
export function storePickupConfirmation(orderId, workerAddress, signature) {
  if (!SIGNATURE_PATTERN.test(String(signature)) || !ADDRESS_PATTERN.test(String(workerAddress))) return;
  const store = readConfirmations();
  store[orderId] = { worker: workerAddress.toLowerCase(), signature: signature };
  writeConfirmations(store);
}

// The kept confirmation of this order and this worker, or null. The caller checks
// it again before trusting it.
export function storedPickupConfirmation(orderId, workerAddress) {
  const entry = readConfirmations()[orderId];
  if (!entry || typeof entry !== 'object') return null;
  if (typeof workerAddress !== 'string' || entry.worker !== workerAddress.toLowerCase()) return null;
  return typeof entry.signature === 'string' && SIGNATURE_PATTERN.test(entry.signature) ? entry.signature : null;
}

export function forgetPickupConfirmation(orderId) {
  const store = readConfirmations();
  if (!(orderId in store)) return;
  delete store[orderId];
  writeConfirmations(store);
}

// What to tell the establishment when an order could not be opened (items and
// pickup secret). The text of a format error is not shown: it can quote the order.
export function decryptErrorMessage(err) {
  const raw = (err && err.message) || '';
  if ((err && err.code === 4001) || /denied|rejected/i.test(raw)) {
    return 'The request was rejected in MetaMask. The order was not opened.';
  }
  if (err instanceof SyntaxError || raw === 'Unexpected order format') {
    return 'This order is not in a format this app can open.';
  }
  return 'Could not open the order' + (raw ? ': ' + raw.slice(0, 150) : '.');
}
