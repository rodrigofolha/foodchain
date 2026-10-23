/* global BigInt */
import Web3 from 'web3';
import {
  currentPickupKey, showsPickupKey, releasesPickupKey, decryptErrorMessage,
  isPickupConfirmationOf, checkPickupConfirmation, HANDOVER_PICKUP,
  storePickupConfirmation, storedPickupConfirmation, forgetPickupConfirmation,
  chainOrderState, readChainOrder, orderChangedOnChain, allowsDispatch, pickupKeyToShow, PICKUP_KEY_NOTICE,
} from './pickupKeyDisplay';
import { parseEstablishmentOrder, sealDetailsWith, openDetails } from './pickupSeal';
import { deploymentKey } from './deploymentStorage';

const K = 'AAECAwQFBgcICQoLDA0ODw';
const S = '8OHSw7Sllod4aVpLPC0eDw';
const WORKER_1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const WORKER_2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const ITEMS = [{ name: 'Pão de queijo', quantity: 1, price: 7 }];

describe('currentPickupKey', () => {
  it('derives the key of the committed worker from the decrypted order', () => {
    const order = parseEstablishmentOrder(JSON.stringify({ items: ITEMS, k: K }));
    expect(currentPickupKey(order.pickupSecret, '7', WORKER_1)).toBe('dcpk1:mHyYqQwT6_c5_b6cKAwtyQ');
  });

  it('follows the worker: after a new commitment the key is the one of the new worker', () => {
    const first = currentPickupKey(K, '7', WORKER_1);
    const second = currentPickupKey(K, '7', WORKER_2);
    expect(second).toBe('dcpk1:Vh32Dp3DFxebtDusHX79Hw');
    expect(second).not.toBe(first);

    // What the customer sealed for the second worker opens with the second key only.
    const details = { deliveryAddress: 'Rua São João, 100', items: ITEMS };
    const sealed = sealDetailsWith(second, S, details);
    expect(openDetails(second, S, sealed)).toEqual(details);
    expect(() => openDetails(first, S, sealed)).toThrow('PICKUP_KEY_MISMATCH');
  });

  it('shows no key for an order placed before the pickup key existed', () => {
    const order = parseEstablishmentOrder(JSON.stringify(ITEMS));
    expect(order.items).toEqual(ITEMS);
    expect(currentPickupKey(order.pickupSecret, '7', WORKER_1)).toBeNull();
  });

  it('shows no key without a committed worker or with malformed input', () => {
    expect(currentPickupKey(K, '7', '0x0000000000000000000000000000000000000000')).toBeNull();
    expect(currentPickupKey(K, '7', undefined)).toBeNull();
    expect(currentPickupKey(K, '7', '0x1234')).toBeNull();
    expect(currentPickupKey(K, undefined, WORKER_1)).toBeNull();
    expect(currentPickupKey('abc', '7', WORKER_1)).toBeNull();
  });
});

describe('showsPickupKey', () => {
  it('shows the block before pickup and on the way, and in no other state', () => {
    expect(showsPickupKey('WAITING')).toBe(true);
    expect(showsPickupKey('DISPATCHED')).toBe(true);
    ['ORDERED', 'PREPARATION', 'CONCLUDED', 'CANCELED', 'CONTESTED', '', undefined].forEach((status) => {
      expect(showsPickupKey(status)).toBe(false);
    });
  });

  it('still has no key to show for an order without a pickup secret', () => {
    const order = parseEstablishmentOrder(JSON.stringify(ITEMS));
    expect(showsPickupKey('DISPATCHED')).toBe(true);
    expect(currentPickupKey(order.pickupSecret, '7', WORKER_1)).toBeNull();
  });
});

// What a fresh read of the chain says (chainOrderState)
const ZERO = '0x0000000000000000000000000000000000000000';
const ORDER = '0x00000000000000000000000000000000000000aa';
const onChain = (status, worker) => ({ orderAddress: ORDER, status: status, worker: worker, updatedAt: 1760000100 });

describe('the pickup rule', () => {
  it('releases no key in WAITING, whatever was checked or read', () => {
    expect(releasesPickupKey('WAITING', WORKER_1, onChain('WAITING', WORKER_1))).toBe(false);
    expect(releasesPickupKey('WAITING', WORKER_1, onChain('DISPATCHED', WORKER_1))).toBe(false);
    expect(releasesPickupKey('WAITING', WORKER_1, true)).toBe(false);
    expect(pickupKeyToShow(K, '7', 'WAITING', WORKER_1, onChain('WAITING', WORKER_1))).toBeNull();
    // a card in WAITING shows no key even if the chain is already DISPATCHED: it reloads first
    expect(pickupKeyToShow(K, '7', 'WAITING', WORKER_1, onChain('DISPATCHED', WORKER_1))).toBeNull();
  });

  it('releases the key in DISPATCHED only after a fresh read, and only for the worker the chain names', () => {
    expect(releasesPickupKey('DISPATCHED', WORKER_1, null)).toBe(false);
    expect(releasesPickupKey('DISPATCHED', WORKER_1, undefined)).toBe(false);
    expect(releasesPickupKey('DISPATCHED', WORKER_1, onChain('DISPATCHED', WORKER_1))).toBe(true);
    expect(releasesPickupKey('DISPATCHED', WORKER_1.toLowerCase(), onChain('DISPATCHED', WORKER_1))).toBe(true);
    expect(releasesPickupKey('DISPATCHED', WORKER_1, onChain('DISPATCHED', WORKER_2))).toBe(false);
    expect(releasesPickupKey('DISPATCHED', WORKER_1, onChain('DISPATCHED', ZERO))).toBe(false);
    expect(releasesPickupKey('DISPATCHED', ZERO, onChain('DISPATCHED', ZERO))).toBe(false);
    expect(releasesPickupKey('DISPATCHED', WORKER_1, onChain('WAITING', WORKER_1))).toBe(false);
    expect(releasesPickupKey('DISPATCHED', WORKER_1, onChain('CANCELED BY FIRST DELIVERYMAN', WORKER_1))).toBe(false);
    ['ORDERED', 'PREPARATION', 'CONCLUDED', 'CANCELED BY CLIENT', '', undefined].forEach((status) => {
      expect(releasesPickupKey(status, WORKER_1, onChain('DISPATCHED', WORKER_1))).toBe(false);
    });

    expect(pickupKeyToShow(K, '7', 'DISPATCHED', WORKER_1, onChain('DISPATCHED', WORKER_1))).toBe(currentPickupKey(K, '7', WORKER_1));
    expect(pickupKeyToShow(K, '7', 'DISPATCHED', WORKER_1, onChain('DISPATCHED', WORKER_2))).toBeNull();
    expect(pickupKeyToShow(K, '7', 'DISPATCHED', WORKER_1, null)).toBeNull();
    // an order placed before the pickup key existed has none
    expect(pickupKeyToShow(null, '7', 'DISPATCHED', WORKER_1, onChain('DISPATCHED', WORKER_1))).toBeNull();
  });

  it('allows the dispatch only with a checked confirmation and a fresh read that says WAITING with the same worker', () => {
    expect(allowsDispatch(WORKER_1, true, onChain('WAITING', WORKER_1))).toBe(true);
    expect(allowsDispatch(WORKER_1.toLowerCase(), true, onChain('WAITING', WORKER_1))).toBe(true);
    expect(allowsDispatch(WORKER_1, false, onChain('WAITING', WORKER_1))).toBe(false);
    expect(allowsDispatch(WORKER_1, 'valid', onChain('WAITING', WORKER_1))).toBe(false);
    expect(allowsDispatch(WORKER_1, true, null)).toBe(false);
    expect(allowsDispatch(WORKER_1, true, onChain('WAITING', WORKER_2))).toBe(false);
    expect(allowsDispatch(WORKER_1, true, onChain('DISPATCHED', WORKER_1))).toBe(false);
  });

  it('a stale card: the first worker left and the card was not reloaded', () => {
    // the card still shows WAITING with worker 1; the chain says PREPARATION without a worker
    const fresh = onChain('PREPARATION', ZERO);
    expect(orderChangedOnChain('WAITING', WORKER_1, fresh)).toBe(true);
    expect(allowsDispatch(WORKER_1, true, fresh)).toBe(false);
    expect(releasesPickupKey('WAITING', WORKER_1, fresh)).toBe(false);
    expect(pickupKeyToShow(K, '7', 'WAITING', WORKER_1, fresh)).toBeNull();
    // and once a second worker committed
    const second = onChain('WAITING', WORKER_2);
    expect(orderChangedOnChain('WAITING', WORKER_1, second)).toBe(true);
    expect(allowsDispatch(WORKER_1, true, second)).toBe(false);
    expect(pickupKeyToShow(K, '7', 'WAITING', WORKER_1, second)).toBeNull();
  });

  it('knows when the chain says what the card shows', () => {
    expect(orderChangedOnChain('WAITING', WORKER_1, onChain('WAITING', WORKER_1))).toBe(false);
    expect(orderChangedOnChain('WAITING', WORKER_1.toLowerCase(), onChain('WAITING', WORKER_1))).toBe(false);
    expect(orderChangedOnChain('DISPATCHED', WORKER_1, onChain('DISPATCHED', WORKER_1))).toBe(false);
    expect(orderChangedOnChain('DISPATCHED', WORKER_1, onChain('DISPATCHED', WORKER_2))).toBe(true);
    expect(orderChangedOnChain('WAITING', WORKER_1, onChain('DISPATCHED', WORKER_1))).toBe(true);
    expect(orderChangedOnChain('DISPATCHED', WORKER_1, onChain('CONCLUDED', WORKER_1))).toBe(true);
    // nothing read: nothing known
    expect(orderChangedOnChain('WAITING', WORKER_1, null)).toBe(false);
  });

  it('says in one line when the key will appear', () => {
    expect(PICKUP_KEY_NOTICE).toBe('The pickup key appears here once the pickup is recorded on the chain; show it to the worker then.');
  });
});

describe('reading the order again', () => {
  const ESTABLISHMENT = '0x00000000000000000000000000000000000000cc';
  const fields = (status, worker) => ['7', '0x1234', '1000', status, ZERO, '0', '1760000000', '1760000100', worker, '0', '0'];

  it('reads it from its address through Chain, as the establishment', async () => {
    const calls = [];
    const chain = {
      methods: {
        findAddress: (id) => ({ call: () => { calls.push(['findAddress', String(id)]); return Promise.resolve(ORDER); } }),
        getOrder: (address) => ({ call: (options) => { calls.push(['getOrder', address, options]); return Promise.resolve(fields('DISPATCHED', WORKER_1)); } }),
      },
    };
    await expect(readChainOrder(chain, '7', ESTABLISHMENT)).resolves.toEqual({ orderAddress: ORDER, status: 'DISPATCHED', worker: WORKER_1, updatedAt: 1760000100 });
    expect(calls).toEqual([['findAddress', '7'], ['getOrder', ORDER, { from: ESTABLISHMENT }]]);
  });

  it('takes the answer of web3 (an object with numeric keys) and of ethers (numbers as objects)', () => {
    const big = (n) => ({ toString: () => String(n) });
    expect(chainOrderState(ORDER, { 3: 'WAITING', 7: '1760000100', 8: WORKER_1 })).toEqual({ orderAddress: ORDER, status: 'WAITING', worker: WORKER_1, updatedAt: 1760000100 });
    expect(chainOrderState(ORDER, [big(7), '', big(1), 'WAITING', ZERO, big(0), big(1), big(1760000100), WORKER_1, big(0), big(0)]).updatedAt).toBe(1760000100);
  });

  it('throws when the chain cannot be read or does not show the order to this account', async () => {
    const down = { methods: { findAddress: () => ({ call: () => Promise.reject(new Error('network')) }) } };
    await expect(readChainOrder(down, '7', ESTABLISHMENT)).rejects.toThrow('network');
    // the view of an account that is not a party: no status
    expect(() => chainOrderState(ORDER, ['7', '', '0', '', ZERO, '0', '0', '0', ZERO, '0', '0'])).toThrow('could not be read');
    expect(() => chainOrderState(ORDER, undefined)).toThrow('could not be read');
  });
});

describe('pickup confirmation', () => {
  // Throwaway keys, made for this run only.
  const web3 = new Web3();
  const accounts = web3.eth.accounts;
  const worker = accounts.create();
  const otherWorker = accounts.create();
  const ORDER_A = '0x00000000000000000000000000000000000000aa';
  const ORDER_B = '0x00000000000000000000000000000000000000bb';
  const ORDER_ADDRESSES = { 7: ORDER_A, 8: ORDER_B };
  const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

  // Same bytes as Order.handoverDigest
  const digestOf = (orderAddress, action, workerAddress) => web3.utils.soliditySha3(
    { t: 'string', v: 'DeliveryChain handover' }, { t: 'uint256', v: 31337 },
    { t: 'address', v: orderAddress }, { t: 'uint8', v: action }, { t: 'address', v: workerAddress });
  const sign = (digest, account) => accounts.sign(digest, account.privateKey).signature;

  let calls;
  const chain = {
    methods: {
      findAddress: (orderId) => ({ call: () => { calls.push(['findAddress', String(orderId)]); return Promise.resolve(ORDER_ADDRESSES[orderId]); } }),
      handoverDigest: (orderAddress, action, workerAddress) => ({
        call: () => { calls.push(['handoverDigest', orderAddress, action, workerAddress]); return Promise.resolve(digestOf(orderAddress, action, workerAddress)); },
      }),
    },
  };

  beforeEach(() => { calls = []; });

  const digest = digestOf(ORDER_A, HANDOVER_PICKUP, worker.address);
  const signature = sign(digest, worker);

  it('accepts the signature of the committed worker over the digest of the order', () => {
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/);
    expect(isPickupConfirmationOf(accounts, digest, signature, worker.address)).toBe(true);
    expect(isPickupConfirmationOf(accounts, digest, signature, worker.address.toLowerCase())).toBe(true);
  });

  it('accepts v written as 0 or 1, as the contract does', () => {
    const v = parseInt(signature.slice(130), 16);
    const low = signature.slice(0, 130) + (v - 27).toString(16).padStart(2, '0');
    expect(isPickupConfirmationOf(accounts, digest, low, worker.address)).toBe(true);
  });

  it('refuses the signature of another worker', () => {
    const theirs = sign(digestOf(ORDER_A, HANDOVER_PICKUP, otherWorker.address), otherWorker);
    expect(isPickupConfirmationOf(accounts, digest, theirs, worker.address)).toBe(false);
    // another worker signing the digest of the committed worker
    expect(isPickupConfirmationOf(accounts, digest, sign(digest, otherWorker), worker.address)).toBe(false);
  });

  it('refuses a signature of the same worker for another order or another action', () => {
    const otherOrder = sign(digestOf(ORDER_B, HANDOVER_PICKUP, worker.address), worker);
    expect(isPickupConfirmationOf(accounts, digest, otherOrder, worker.address)).toBe(false);
    const delivery = sign(digestOf(ORDER_A, 2, worker.address), worker);
    expect(isPickupConfirmationOf(accounts, digest, delivery, worker.address)).toBe(false);
  });

  it('refuses the high-s twin of a valid signature and an impossible v, as the contract does', () => {
    const s = BigInt('0x' + signature.slice(66, 130));
    const v = parseInt(signature.slice(130), 16);
    const twin = signature.slice(0, 66) + (CURVE_ORDER - s).toString(16).padStart(64, '0') + (v === 27 ? '1c' : '1b');
    expect(isPickupConfirmationOf(accounts, digest, twin, worker.address)).toBe(false);
    expect(isPickupConfirmationOf(accounts, digest, signature.slice(0, 130) + '1d', worker.address)).toBe(false);
  });

  it('refuses malformed input without throwing', () => {
    expect(isPickupConfirmationOf(accounts, digest, signature.slice(0, -2), worker.address)).toBe(false);
    expect(isPickupConfirmationOf(accounts, digest, '0x' + '00'.repeat(65), worker.address)).toBe(false);
    expect(isPickupConfirmationOf(accounts, digest, undefined, worker.address)).toBe(false);
    expect(isPickupConfirmationOf(accounts, '0x1234', signature, worker.address)).toBe(false);
    expect(isPickupConfirmationOf(accounts, undefined, signature, worker.address)).toBe(false);
    expect(isPickupConfirmationOf(accounts, digest, signature, undefined)).toBe(false);
    expect(isPickupConfirmationOf(accounts, digest, signature, '0x0000000000000000000000000000000000000000')).toBe(false);
    const broken = { recover: () => { throw new Error('boom'); } };
    expect(isPickupConfirmationOf(broken, digest, signature, worker.address)).toBe(false);
  });

  it('checks against the digest the contract gives for this order, the pickup and the committed worker', async () => {
    await expect(checkPickupConfirmation(web3, chain, '7', worker.address, signature)).resolves.toBe(true);
    expect(calls).toEqual([['findAddress', '7'], ['handoverDigest', ORDER_A, 1, worker.address]]);
  });

  it('refuses, through the contract digest, another order and another committed worker', async () => {
    // the confirmation of order 7 shown at order 8
    await expect(checkPickupConfirmation(web3, chain, '8', worker.address, signature)).resolves.toBe(false);
    // the order was offered to another worker after this one signed
    await expect(checkPickupConfirmation(web3, chain, '7', otherWorker.address, signature)).resolves.toBe(false);
    // no committed worker
    await expect(checkPickupConfirmation(web3, chain, '7', undefined, signature)).resolves.toBe(false);
  });

  it('follows the digest of the contract if it changes', async () => {
    const changed = web3.utils.soliditySha3('another digest');
    const newChain = { methods: { findAddress: chain.methods.findAddress, handoverDigest: () => ({ call: () => Promise.resolve(changed) }) } };
    await expect(checkPickupConfirmation(web3, newChain, '7', worker.address, signature)).resolves.toBe(false);
    await expect(checkPickupConfirmation(web3, newChain, '7', worker.address, sign(changed, worker))).resolves.toBe(true);
  });

  it('throws when the chain cannot be read, so that the caller can say so', async () => {
    const down = { methods: { findAddress: () => ({ call: () => Promise.reject(new Error('network')) }) } };
    await expect(checkPickupConfirmation(web3, down, '7', worker.address, signature)).rejects.toThrow('network');
  });

  describe('kept until dispatch', () => {
    afterEach(() => localStorage.clear());

    it('returns the confirmation of the same order and the same worker only', () => {
      expect(storedPickupConfirmation('7', worker.address)).toBeNull();
      storePickupConfirmation('7', worker.address, signature);
      expect(storedPickupConfirmation('7', worker.address)).toBe(signature);
      expect(storedPickupConfirmation(7, worker.address.toLowerCase())).toBe(signature);
      expect(storedPickupConfirmation('8', worker.address)).toBeNull();
      expect(storedPickupConfirmation('7', otherWorker.address)).toBeNull();
      expect(storedPickupConfirmation('7', undefined)).toBeNull();
    });

    it('forgets it after dispatch and leaves the other orders', () => {
      storePickupConfirmation('7', worker.address, signature);
      storePickupConfirmation('8', worker.address, signature);
      forgetPickupConfirmation('7');
      expect(storedPickupConfirmation('7', worker.address)).toBeNull();
      expect(storedPickupConfirmation('8', worker.address)).toBe(signature);
      forgetPickupConfirmation('8');
      forgetPickupConfirmation('9');
      expect(localStorage.getItem(deploymentKey('pickupConfirmations'))).toBeNull();
    });

    it('does not store or return text that is not a signature, and survives a malformed store', () => {
      storePickupConfirmation('7', worker.address, 'hello');
      storePickupConfirmation('7', 'hello', signature);
      expect(localStorage.getItem(deploymentKey('pickupConfirmations'))).toBeNull();
      localStorage.setItem(deploymentKey('pickupConfirmations'), JSON.stringify({ 7: { worker: worker.address.toLowerCase(), signature: 'hello' }, 8: 'x' }));
      expect(storedPickupConfirmation('7', worker.address)).toBeNull();
      expect(storedPickupConfirmation('8', worker.address)).toBeNull();
      localStorage.setItem(deploymentKey('pickupConfirmations'), 'not json');
      expect(storedPickupConfirmation('7', worker.address)).toBeNull();
      storePickupConfirmation('7', worker.address, signature);
      expect(storedPickupConfirmation('7', worker.address)).toBe(signature);
    });
  });
});

describe('decryptErrorMessage', () => {
  const failure = (fn) => { try { fn(); } catch (err) { return err; } return null; };

  it('says that the MetaMask prompt was rejected', () => {
    const byCode = Object.assign(new Error('anything'), { code: 4001 });
    expect(decryptErrorMessage(byCode)).toBe('The request was rejected in MetaMask. The order was not opened.');
    expect(decryptErrorMessage(new Error('MetaMask Decryption: User denied message decryption.')))
      .toBe('The request was rejected in MetaMask. The order was not opened.');
    expect(decryptErrorMessage({ message: 'User rejected the request.' }))
      .toBe('The request was rejected in MetaMask. The order was not opened.');
  });

  it('says that the order has an unexpected format, without quoting it', () => {
    const notAnOrder = failure(() => parseEstablishmentOrder(JSON.stringify({ name: 'Segredo' })));
    expect(decryptErrorMessage(notAnOrder)).toBe('This order is not in a format this app can open.');
    const notJson = failure(() => parseEstablishmentOrder('Segredo de queijo'));
    expect(notJson).toBeInstanceOf(SyntaxError);
    expect(decryptErrorMessage(notJson)).toBe('This order is not in a format this app can open.');
    expect(decryptErrorMessage(notJson)).not.toContain('Segredo');
  });

  it('gives the reason of any other failure, and always some text', () => {
    expect(decryptErrorMessage(new Error('Internal JSON-RPC error.'))).toBe('Could not open the order: Internal JSON-RPC error.');
    expect(decryptErrorMessage(undefined)).toBe('Could not open the order.');
    expect(decryptErrorMessage(new Error('x'.repeat(400))).length).toBeLessThan(200);
  });
});
