// Browser records that belong to one deployment of the contracts.
//
// A new deployment numbers its orders from 1 again, while the browser may still hold
// what it kept for the orders of the deployment before. A record kept under an order
// number is therefore stored under a name that carries the chain id and the Chain
// contract's address:
//
//   '<name>@<chain id>:<Chain address, lower case>'
//
// Records written before this rule sit under the bare name ('orderSecrets', ...).
// They are left where they are and are never read: nothing says which deployment
// they belong to. What belongs to the person or comes from the API (the session,
// the basket) is not kept here and stays under its own name.
import { CHAIN_ADDRESS } from '../services/config';

let scope = null;

function isAddress(text) {
  return typeof text === 'string' && /^0x[0-9a-fA-F]{40}$/.test(text);
}

// Sets the deployment the records are read and written for. `chainId` is a number
// or a decimal or 0x string; `chainAddress` is the Chain contract of this app unless
// given. Returns the scope ('<chain id>:<address>'), or null (and no deployment is
// set) when one of the two is not usable.
export function setDeployment(chainId, chainAddress) {
  const address = chainAddress === undefined ? CHAIN_ADDRESS : chainAddress;
  const id = typeof chainId === 'string' || typeof chainId === 'number' ? Number(chainId) : NaN;
  scope = Number.isSafeInteger(id) && id > 0 && isAddress(address)
    ? id + ':' + address.toLowerCase()
    : null;
  return scope;
}

export function deploymentScope() {
  return scope;
}

// Reads the chain id from the wallet (or from `web3` when there is no wallet) and
// sets the deployment. Called before records are read or written: the wallet may
// have changed network since the page loaded. Throws when the chain id cannot be
// read: without it no record can be kept.
export async function loadDeployment(web3) {
  let chainId;
  if (typeof window !== 'undefined' && window.ethereum && window.ethereum.request) {
    chainId = await window.ethereum.request({ method: 'eth_chainId' });
  } else if (web3) {
    chainId = await web3.eth.getChainId();
  }
  const loaded = setDeployment(chainId);
  if (!loaded) throw new Error('The network of the wallet could not be read. Nothing was sent.');
  return loaded;
}

// The localStorage name of a store for the deployment set, or null when none is set.
export function deploymentKey(name) {
  return scope ? name + '@' + scope : null;
}

// The store kept under `name` for this deployment: always an object, empty when
// nothing is kept, no deployment is set or the content is not an object.
export function readDeploymentStore(name) {
  const key = deploymentKey(name);
  if (!key) return {};
  try {
    const store = JSON.parse(localStorage.getItem(key) || '{}');
    return store && typeof store === 'object' && !Array.isArray(store) ? store : {};
  } catch (_) {
    return {};
  }
}

// Writes the store. Returns false, and writes nothing, when no deployment is set.
export function writeDeploymentStore(name, store) {
  const key = deploymentKey(name);
  if (!key) return false;
  localStorage.setItem(key, JSON.stringify(store));
  return true;
}
