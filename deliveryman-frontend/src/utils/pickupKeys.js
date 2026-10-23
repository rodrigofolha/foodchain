// Worker side of the late release of the delivery details (see pickupSeal.js).
import { isPickupKey, isSealed, openDetails } from './pickupSeal';
import { readDeploymentStore, writeDeploymentStore } from './deploymentStorage';

// What the customer sent to the committed worker (the last Information log of
// Storage for them, see orderLogs.js):
// 'none' (the customer has not sent the details yet), 'sealed' (the address and
// the items wait for the pickup key) or 'legacy' (both open with the wallet).
export function detailsState(information) {
  if (!information || !information[0] || !information[1]) return 'none';
  return isSealed(information[1]) ? 'sealed' : 'legacy';
}

// The keys are kept per deployment (see deploymentStorage.js): another deployment
// uses the same order numbers for other orders.
function readStore() {
  return readDeploymentStore('pickupKeys');
}

// The pickup key that opened this order before, or null. It is kept so that the
// details can be opened again after a page reload, when the order is on its way.
export function storedPickupKey(orderId) {
  const pickupKey = readStore()[orderId];
  return isPickupKey(pickupKey) ? pickupKey : null;
}

export function storePickupKey(orderId, pickupKey) {
  if (!isPickupKey(pickupKey)) return;
  try {
    const store = readStore();
    store[orderId] = pickupKey;
    writeDeploymentStore('pickupKeys', store);
  } catch (_) {
    // Storage is not available: the key will be asked again after a reload.
    // The same happens while the deployment is not known: nothing is written.
  }
}

// Opens the sealed details. Throws an Error with message 'PICKUP_KEY_MISMATCH'
// if the key does not open them.
export function openSealedDetails(pickupKey, s, sealed) {
  const details = openDetails(pickupKey, s, sealed);
  return {
    deliveryAddress: typeof details.deliveryAddress === 'string' ? details.deliveryAddress : '',
    // only entries the page can show
    items: Array.isArray(details.items) ? details.items.filter(item => item && typeof item === 'object') : [],
  };
}
