// Customer side of the late release of the delivery details (see pickupSeal.js).
import { encrypt } from './crypto';
import { isPickupSecret, pickupKeyFor, sealDetails } from './pickupSeal';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// The pickup secret inside the secrets kept for an order, or null.
export function pickupSecretOf(secrets) {
  return secrets && isPickupSecret(secrets.pickupSecret) ? secrets.pickupSecret : null;
}

export function isCommittedWorker(address) {
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address) && address !== ZERO_ADDRESS;
}

// The status of the order and the worker committed to it, read from the chain now.
// The page may have been loaded before another worker committed.
export async function committedWorkerNow(chain, orderAddress, account) {
  const order = await chain.methods.getOrder(orderAddress).call({ from: account });
  return { status: order[3], worker: isCommittedWorker(order[8]) ? order[8] : null };
}

// The committed worker and their encryption key, read so that both are of the same
// worker: the worker, then the key (`readKey`), then the worker again. If another
// worker committed in between, or the order left WAITING, `changed` is true and
// the key must not be used: the pair could be opened by nobody.
export async function committedWorkerAndKey(chain, orderAddress, account, readKey) {
  const before = await committedWorkerNow(chain, orderAddress, account);
  if (before.status !== 'WAITING' || !before.worker) {
    return { status: before.status, worker: null, encryptPublicKey: null, changed: false };
  }
  const encryptPublicKey = await readKey();
  const after = await committedWorkerNow(chain, orderAddress, account);
  const changed = after.status !== before.status || after.worker !== before.worker;
  return { status: after.status, worker: after.worker, encryptPublicKey: changed ? null : encryptPublicKey, changed: changed };
}

// Asked before the details are sent in the older format.
export const NO_PICKUP_SECRET_WARNING =
  'This browser does not hold the pickup secret of this order. The order was placed in another browser, ' +
  'or before the pickup key existed.\n\n' +
  'If you continue, the delivery worker will be able to read your address as soon as it is sent, ' +
  'before they pick up the order.\n\nSend the address anyway?';

// The two strings of Storage.addInformation for a committed worker:
// - first: for the worker's encryption key, with the establishment's id and `s`;
// - second: the delivery address and the items, sealed for the pickup key of this worker.
export function sealForWorker(encryptPublicKey, pickupSecret, orderId, workerAddress, restaurantId, deliveryAddress, items) {
  const pickupKey = pickupKeyFor(pickupSecret, orderId, workerAddress);
  const { s, sealed } = sealDetails(pickupKey, { deliveryAddress: deliveryAddress, items: items });
  return {
    first: encrypt(encryptPublicKey, { restaurantId: restaurantId, s: s }),
    second: sealed,
  };
}
