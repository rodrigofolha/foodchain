import { pickupSecretOf, isCommittedWorker, committedWorkerNow, committedWorkerAndKey, sealForWorker, NO_PICKUP_SECRET_WARNING } from './lateRelease';
import { pickupKeyFor, openDetails, isSealed, parseWorkerPayload } from './pickupSeal';

const sigUtil = require('eth-sig-util');

// Test key pair of a worker (not a real account).
const WORKER_PRIVATE_KEY = '7e5374ec2ef0d91761a6e72fdf8f6ac665519bfdf6da0a2329cf0d804514b816';
const WORKER_ENCRYPTION_KEY = sigUtil.getEncryptionPublicKey(WORKER_PRIVATE_KEY);

const K = 'AAECAwQFBgcICQoLDA0ODw';
const WORKER_1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const WORKER_2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const ADDRESS = 'Rua São João, 100, apto 3';
const ITEMS = [{ name: 'Pão de queijo', quantity: 1, price: 7 }];

// What MetaMask's eth_decrypt does with the first string.
function workerDecrypt(hex) {
  const json = Buffer.from(hex.slice(2), 'hex').toString('utf8');
  return sigUtil.decrypt(JSON.parse(json), WORKER_PRIVATE_KEY);
}

describe('isCommittedWorker', () => {
  it('accepts an address and rejects the zero address and other values', () => {
    expect(isCommittedWorker(WORKER_1)).toBe(true);
    expect(isCommittedWorker('0x0000000000000000000000000000000000000000')).toBe(false);
    expect(isCommittedWorker('0x1234')).toBe(false);
    expect(isCommittedWorker(undefined)).toBe(false);
  });
});

describe('pickupSecretOf', () => {
  it('reads the pickup secret of a record, with or without the order contract', () => {
    expect(pickupSecretOf({ nullifier: '1', trapdoor: '2', pickupSecret: K })).toBe(K);
    expect(pickupSecretOf({ pickupSecret: K, orderAddress: WORKER_2 })).toBe(K);
    expect(pickupSecretOf({ nullifier: '1', trapdoor: '2' })).toBeNull();
    expect(pickupSecretOf({ pickupSecret: 'abc' })).toBeNull();
    expect(pickupSecretOf(null)).toBeNull();
  });
});

describe('committedWorkerNow', () => {
  const ORDER = '0x00000000000000000000000000000000000000A1';
  const CUSTOMER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  // Chain.getOrder as the customer sees it: [3] is the status, [8] the committed worker
  function fakeChain(status, worker, calls) {
    return {
      methods: {
        getOrder: (orderAddress) => ({
          call: async (options) => {
            calls.push([orderAddress, options.from]);
            return { 0: '7', 3: status, 8: worker };
          },
        }),
      },
    };
  }

  it('reads the status and the worker from the chain, as the customer', async () => {
    const calls = [];
    await expect(committedWorkerNow(fakeChain('WAITING', WORKER_2, calls), ORDER, CUSTOMER))
      .resolves.toEqual({ status: 'WAITING', worker: WORKER_2 });
    expect(calls).toEqual([[ORDER, CUSTOMER]]);
  });

  it('gives no worker when none is committed', async () => {
    await expect(committedWorkerNow(fakeChain('PREPARATION', '0x0000000000000000000000000000000000000000', []), ORDER, CUSTOMER))
      .resolves.toEqual({ status: 'PREPARATION', worker: null });
  });

  it('seals for the worker read now, not for the one the page loaded', () => {
    // the page was loaded with WORKER_1; WORKER_2 committed meanwhile
    const strings = sealForWorker(WORKER_ENCRYPTION_KEY, K, '7', WORKER_2, 12, ADDRESS, ITEMS);
    const s = JSON.parse(workerDecrypt(strings.first)).s;
    expect(openDetails(pickupKeyFor(K, 7, WORKER_2), s, strings.second)).toEqual({ deliveryAddress: ADDRESS, items: ITEMS });
    expect(() => openDetails(pickupKeyFor(K, 7, WORKER_1), s, strings.second)).toThrow('PICKUP_KEY_MISMATCH');
  });
});

describe('committedWorkerAndKey', () => {
  const ORDER = '0x00000000000000000000000000000000000000A1';
  const CUSTOMER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const ZERO = '0x0000000000000000000000000000000000000000';

  // Chain.getOrder answers with the next [status, worker] of `answers` at each read;
  // every read and the key read are noted in `trace`.
  function fakeChain(answers, trace) {
    let read = 0;
    return {
      methods: {
        getOrder: () => ({
          call: async () => {
            const answer = answers[Math.min(read, answers.length - 1)];
            read++;
            trace.push('worker');
            return { 0: '7', 3: answer[0], 8: answer[1] };
          },
        }),
      },
    };
  }
  const keyReader = (trace, key) => async () => { trace.push('key'); return key; };

  it('reads the worker, then the key, then the worker again', async () => {
    const trace = [];
    const chain = fakeChain([['WAITING', WORKER_1]], trace);
    await expect(committedWorkerAndKey(chain, ORDER, CUSTOMER, keyReader(trace, WORKER_ENCRYPTION_KEY)))
      .resolves.toEqual({ status: 'WAITING', worker: WORKER_1, encryptPublicKey: WORKER_ENCRYPTION_KEY, changed: false });
    expect(trace).toEqual(['worker', 'key', 'worker']);
  });

  it('gives no key when another worker committed between the two reads', async () => {
    // the key read falls after the second worker committed: it is the key of WORKER_2
    const trace = [];
    const chain = fakeChain([['WAITING', WORKER_1], ['WAITING', WORKER_2]], trace);
    await expect(committedWorkerAndKey(chain, ORDER, CUSTOMER, keyReader(trace, WORKER_ENCRYPTION_KEY)))
      .resolves.toEqual({ status: 'WAITING', worker: WORKER_2, encryptPublicKey: null, changed: true });
  });

  it('gives no key when the order left WAITING between the two reads', async () => {
    // the establishment called another worker: the order is back in PREPARATION
    const trace = [];
    const chain = fakeChain([['WAITING', WORKER_1], ['PREPARATION', ZERO]], trace);
    await expect(committedWorkerAndKey(chain, ORDER, CUSTOMER, keyReader(trace, WORKER_ENCRYPTION_KEY)))
      .resolves.toEqual({ status: 'PREPARATION', worker: null, encryptPublicKey: null, changed: true });
  });

  it('does not read the key when no worker is committed', async () => {
    const trace = [];
    await expect(committedWorkerAndKey(fakeChain([['PREPARATION', ZERO]], trace), ORDER, CUSTOMER, keyReader(trace, 'unused')))
      .resolves.toEqual({ status: 'PREPARATION', worker: null, encryptPublicKey: null, changed: false });
    await expect(committedWorkerAndKey(fakeChain([['DISPATCHED', WORKER_1]], trace), ORDER, CUSTOMER, keyReader(trace, 'unused')))
      .resolves.toEqual({ status: 'DISPATCHED', worker: null, encryptPublicKey: null, changed: false });
    expect(trace).toEqual(['worker', 'worker']);
  });

  it('lets a failed read reach the caller', async () => {
    const chain = fakeChain([['WAITING', WORKER_1]], []);
    await expect(committedWorkerAndKey(chain, ORDER, CUSTOMER, async () => { throw new Error('rpc down'); }))
      .rejects.toThrow('rpc down');
  });
});

describe('NO_PICKUP_SECRET_WARNING', () => {
  it('says why and what happens if they continue', () => {
    expect(NO_PICKUP_SECRET_WARNING).toMatch(/does not hold the pickup secret/);
    expect(NO_PICKUP_SECRET_WARNING).toMatch(/another browser/);
    expect(NO_PICKUP_SECRET_WARNING).toMatch(/read your address as soon as it is sent/);
  });
});

describe('sealForWorker', () => {
  const strings = sealForWorker(WORKER_ENCRYPTION_KEY, K, '7', WORKER_1, 12, ADDRESS, ITEMS);

  it('writes the first string in the existing format, without the address or the items', () => {
    expect(strings.first).toMatch(/^0x[0-9a-f]+$/);
    const wrapper = JSON.parse(Buffer.from(strings.first.slice(2), 'hex').toString('utf8'));
    expect(wrapper.version).toBe('x25519-xsalsa20-poly1305');

    const plaintext = workerDecrypt(strings.first);
    const payload = JSON.parse(plaintext);
    expect(Object.keys(payload).sort()).toEqual(['restaurantId', 's']);
    expect(payload.restaurantId).toBe(12);
    expect(plaintext).not.toContain('Rua');
    expect(plaintext).not.toContain('queijo');
    expect(parseWorkerPayload(plaintext)).toEqual({ restaurantId: 12, s: payload.s });
  });

  it('writes the second string sealed, not wrapped for the worker', () => {
    expect(isSealed(strings.second)).toBe(true);
    expect(strings.second.startsWith('0x')).toBe(false);
  });

  it('opens only with s and the pickup key of this worker and order', () => {
    const s = JSON.parse(workerDecrypt(strings.first)).s;
    expect(openDetails(pickupKeyFor(K, 7, WORKER_1), s, strings.second))
      .toEqual({ deliveryAddress: ADDRESS, items: ITEMS });
    expect(() => openDetails(pickupKeyFor(K, 7, WORKER_2), s, strings.second)).toThrow('PICKUP_KEY_MISMATCH');
    expect(() => openDetails(pickupKeyFor(K, 8, WORKER_1), s, strings.second)).toThrow('PICKUP_KEY_MISMATCH');
  });

  it('uses a fresh s every time, also for the same worker', () => {
    const again = sealForWorker(WORKER_ENCRYPTION_KEY, K, '7', WORKER_1, 12, ADDRESS, ITEMS);
    expect(JSON.parse(workerDecrypt(again.first)).s).not.toBe(JSON.parse(workerDecrypt(strings.first)).s);
    expect(again.second).not.toBe(strings.second);
  });

  it('does not seal without a committed worker', () => {
    expect(() => sealForWorker(WORKER_ENCRYPTION_KEY, K, '7', undefined, 12, ADDRESS, ITEMS))
      .toThrow('Invalid worker address');
  });
});
