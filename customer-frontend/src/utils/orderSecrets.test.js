import { keccak256 } from 'web3-utils';
import {
  ORDER_ACTORS_TOPIC,
  sameAddress,
  orderAddressFromReceipt,
  resolvePlacedOrder,
  saveOrderSecrets,
  orderSecretsFor,
  hasOrderSecrets,
  saveOrderRestaurantInfo,
  orderRestaurantInfoFor,
  savePendingOrder,
  pendingOrderFor,
  removePendingOrder,
  adoptPendingOrder,
} from './orderSecrets';
import { pickupSecretOf } from './lateRelease';
import { setDeployment, deploymentKey } from './deploymentStorage';

const CUSTOMER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const OTHER_CUSTOMER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const ZERO = '0x0000000000000000000000000000000000000000';
const ORDER_A = '0x00000000000000000000000000000000000000A1';
const ORDER_B = '0x00000000000000000000000000000000000000b2';
const ORDER_C = '0x00000000000000000000000000000000000000C3';
const K = 'AAECAwQFBgcICQoLDA0ODw';
// A record written while ratings needed a proof: it also holds the two rating
// secrets. Such records must still load; the tests below also use the two fields
// to tell records apart.
const SECRETS = { nullifier: '1001', trapdoor: '1002', pickupSecret: K };
// A record as checkout writes it now.
const NEW_SECRETS = { pickupSecret: 'EBESExQVFhcYGRobHB0eHw' };

function topicOf(address) {
  return '0x' + '0'.repeat(24) + address.slice(2).toLowerCase();
}

// The OrderActors log of the constructor of an order contract
function actorsLog(orderAddress, client) {
  return {
    address: orderAddress,
    topics: [ORDER_ACTORS_TOPIC, topicOf(client), topicOf(ZERO), topicOf(ZERO)],
    data: topicOf(orderAddress),
  };
}

// The same log as web3 gives it in the receipt of a contract call
function asWeb3Event(log) {
  return { address: log.address, raw: { topics: log.topics, data: log.data } };
}

// Stand-ins for the Chain contract and for web3: `orders` maps an id to its order
// contract, `clients` maps an order contract to its customer.
function fakeChain(orders, lastIndex) {
  return {
    methods: {
      getIndex: () => ({ call: async () => String(lastIndex) }),
      findAddress: (i) => ({ call: async () => orders[i] || ZERO }),
    },
  };
}

function fakeWeb3(clients) {
  return {
    eth: {
      Contract: function (abi, address) {
        this.methods = {
          isClient: (account) => ({ call: async () => sameAddress(clients[address], account) }),
        };
      },
    },
  };
}

// the records are kept per deployment: a local chain and this app's Chain contract
beforeEach(() => setDeployment(31337));
afterEach(() => localStorage.clear());

describe('orderAddressFromReceipt', () => {
  it('uses the topic of OrderActors(address,address,address,address)', () => {
    expect(ORDER_ACTORS_TOPIC).toBe(keccak256('OrderActors(address,address,address,address)'));
  });

  it('returns the emitter of the log that names the customer', () => {
    expect(orderAddressFromReceipt({ logs: [actorsLog(ORDER_A, CUSTOMER)] }, CUSTOMER)).toBe(ORDER_A);
    expect(orderAddressFromReceipt({ logs: [actorsLog(ORDER_A, CUSTOMER)] }, CUSTOMER.toLowerCase())).toBe(ORDER_A);
  });

  it('reads the logs web3 puts under events, also next to named events', () => {
    const receipt = { events: { OrderZone: { address: ORDER_C, raw: { topics: ['0x01'], data: '0x' } }, 0: asWeb3Event(actorsLog(ORDER_B, CUSTOMER)) } };
    expect(orderAddressFromReceipt(receipt, CUSTOMER)).toBe(ORDER_B);
    const repeated = { events: { Something: [{ address: ORDER_C, raw: { topics: [], data: '0x' } }, asWeb3Event(actorsLog(ORDER_A, CUSTOMER))] } };
    expect(orderAddressFromReceipt(repeated, CUSTOMER)).toBe(ORDER_A);
  });

  it('ignores logs of another customer, of another event, and logs that name another contract', () => {
    expect(orderAddressFromReceipt({ logs: [actorsLog(ORDER_A, OTHER_CUSTOMER)] }, CUSTOMER)).toBeNull();
    const otherEvent = actorsLog(ORDER_A, CUSTOMER);
    otherEvent.topics[0] = '0x' + '11'.repeat(32);
    expect(orderAddressFromReceipt({ logs: [otherEvent] }, CUSTOMER)).toBeNull();
    const otherContract = actorsLog(ORDER_A, CUSTOMER);
    otherContract.data = topicOf(ORDER_B);
    expect(orderAddressFromReceipt({ logs: [otherContract] }, CUSTOMER)).toBeNull();
  });

  it('returns null without a receipt or without logs', () => {
    expect(orderAddressFromReceipt(null, CUSTOMER)).toBeNull();
    expect(orderAddressFromReceipt({}, CUSTOMER)).toBeNull();
    expect(orderAddressFromReceipt({ logs: [null, {}, { address: ORDER_A }] }, CUSTOMER)).toBeNull();
    expect(orderAddressFromReceipt({ logs: [actorsLog(ORDER_A, CUSTOMER)] }, undefined)).toBeNull();
  });
});

describe('resolvePlacedOrder', () => {
  const clients = { [ORDER_A]: OTHER_CUSTOMER, [ORDER_B]: CUSTOMER, [ORDER_C]: CUSTOMER };

  it('finds the next id when no other order was mined in between', async () => {
    const chain = fakeChain({ 5: ORDER_B }, 5);
    const receipt = { events: { 0: asWeb3Event(actorsLog(ORDER_B, CUSTOMER)) } };
    await expect(resolvePlacedOrder(fakeWeb3(clients), chain, CUSTOMER, '4', receipt, hasOrderSecrets))
      .resolves.toEqual({ orderId: 5, orderAddress: ORDER_B });
  });

  it('finds the real id when another order was mined in between', async () => {
    // index was 4; another customer got id 5, this order got id 6
    const chain = fakeChain({ 5: ORDER_A, 6: ORDER_B }, 6);
    const receipt = { events: { 0: asWeb3Event(actorsLog(ORDER_B, CUSTOMER)) } };
    await expect(resolvePlacedOrder(fakeWeb3(clients), chain, CUSTOMER, '4', receipt, hasOrderSecrets))
      .resolves.toEqual({ orderId: 6, orderAddress: ORDER_B });
  });

  it('with the receipt, takes only the order contract the receipt names', async () => {
    // id 5 is an order of the same customer, placed from another browser
    const chain = fakeChain({ 5: ORDER_C, 6: ORDER_B }, 6);
    const receipt = { logs: [actorsLog(ORDER_B.toLowerCase(), CUSTOMER)] };
    await expect(resolvePlacedOrder(fakeWeb3(clients), chain, CUSTOMER, 4, receipt, hasOrderSecrets))
      .resolves.toEqual({ orderId: 6, orderAddress: ORDER_B });
    // the named contract is not in the range the node answers yet
    await expect(resolvePlacedOrder(fakeWeb3(clients), fakeChain({ 5: ORDER_C }, 5), CUSTOMER, 4, receipt, hasOrderSecrets))
      .resolves.toBeNull();
  });

  it('without the receipt, takes the first new order of this customer', async () => {
    const chain = fakeChain({ 5: ORDER_A, 6: ORDER_B }, 6);
    await expect(resolvePlacedOrder(fakeWeb3(clients), chain, CUSTOMER, '4', null, hasOrderSecrets))
      .resolves.toEqual({ orderId: 6, orderAddress: ORDER_B });
  });

  it('without the receipt, skips an order that already has its secrets', async () => {
    const chain = fakeChain({ 5: ORDER_C, 6: ORDER_B }, 6);
    saveOrderSecrets(5, SECRETS, ORDER_C);
    await expect(resolvePlacedOrder(fakeWeb3(clients), chain, CUSTOMER, '4', null, hasOrderSecrets))
      .resolves.toEqual({ orderId: 6, orderAddress: ORDER_B });
  });

  it('without the receipt, does not skip an id whose secrets belong to another order contract', async () => {
    const chain = fakeChain({ 5: ORDER_B }, 5);
    saveOrderSecrets(5, SECRETS, ORDER_A);
    await expect(resolvePlacedOrder(fakeWeb3(clients), chain, CUSTOMER, '4', null, hasOrderSecrets))
      .resolves.toEqual({ orderId: 5, orderAddress: ORDER_B });
  });

  it('resolves nothing when no new order exists yet, when none is of this customer, or when the chain cannot be read', async () => {
    await expect(resolvePlacedOrder(fakeWeb3(clients), fakeChain({}, 4), CUSTOMER, '4', null, hasOrderSecrets))
      .resolves.toBeNull();
    await expect(resolvePlacedOrder(fakeWeb3(clients), fakeChain({ 5: ORDER_A }, 5), CUSTOMER, '4', null, hasOrderSecrets))
      .resolves.toBeNull();
    const broken = { methods: { getIndex: () => ({ call: async () => { throw new Error('rpc down'); } }) } };
    await expect(resolvePlacedOrder(fakeWeb3(clients), broken, CUSTOMER, '4', null, hasOrderSecrets))
      .resolves.toBeNull();
  });

  it('never looks at ids that existed before the transaction', async () => {
    const chain = fakeChain({ 3: ORDER_C, 4: ORDER_B }, 4);
    await expect(resolvePlacedOrder(fakeWeb3(clients), chain, CUSTOMER, '4', null, hasOrderSecrets))
      .resolves.toBeNull();
  });
});

describe('stored order secrets', () => {
  it('keeps the order contract next to the secrets and the other orders untouched', () => {
    saveOrderSecrets(5, { nullifier: '1', trapdoor: '2' }, null);
    saveOrderSecrets(6, SECRETS, ORDER_B);
    expect(JSON.parse(localStorage.getItem(deploymentKey('orderSecrets')))).toEqual({
      5: { nullifier: '1', trapdoor: '2' },
      6: { nullifier: '1001', trapdoor: '1002', pickupSecret: K, orderAddress: ORDER_B },
    });
  });

  it('gives the secrets when the id still names the same order contract', () => {
    saveOrderSecrets(6, SECRETS, ORDER_B);
    expect(orderSecretsFor(6, ORDER_B.toLowerCase())).toEqual(Object.assign({ orderAddress: ORDER_B }, SECRETS));
    expect(orderSecretsFor('6', ORDER_B)).not.toBeNull();
    expect(hasOrderSecrets(6, ORDER_B)).toBe(true);
  });

  it('treats the secrets as missing when the id names another order contract', () => {
    // a wrong guess at checkout, or a new deployment where ids start again
    saveOrderSecrets(6, SECRETS, ORDER_B);
    expect(orderSecretsFor(6, ORDER_A)).toBeNull();
    expect(orderSecretsFor(6, ZERO)).toBeNull();
    expect(orderSecretsFor(6, undefined)).toBeNull();
    expect(hasOrderSecrets(6, ORDER_A)).toBe(false);
    expect(pickupSecretOf(orderSecretsFor(6, ORDER_A))).toBeNull();
  });

  it('uses records without an order contract (older orders) as before', () => {
    localStorage.setItem(deploymentKey('orderSecrets'), JSON.stringify({ 6: { nullifier: '1', trapdoor: '2' }, 7: SECRETS }));
    expect(orderSecretsFor(6, ORDER_A)).toEqual({ nullifier: '1', trapdoor: '2' });
    expect(pickupSecretOf(orderSecretsFor(6, ORDER_A))).toBeNull();
    expect(pickupSecretOf(orderSecretsFor(7, ORDER_A))).toBe(K);
  });

  it('returns null for an unknown order and survives a malformed store', () => {
    expect(orderSecretsFor(6, ORDER_B)).toBeNull();
    localStorage.setItem(deploymentKey('orderSecrets'), 'not json');
    expect(orderSecretsFor(6, ORDER_B)).toBeNull();
    saveOrderSecrets(6, SECRETS, ORDER_B);
    expect(orderSecretsFor(6, ORDER_B)).not.toBeNull();
  });

  it('keeps a record as checkout writes it now: the pickup secret and the order contract', () => {
    saveOrderSecrets(6, NEW_SECRETS, ORDER_B);
    expect(JSON.parse(localStorage.getItem(deploymentKey('orderSecrets')))).toEqual({
      6: { pickupSecret: NEW_SECRETS.pickupSecret, orderAddress: ORDER_B },
    });
    expect(pickupSecretOf(orderSecretsFor(6, ORDER_B))).toBe(NEW_SECRETS.pickupSecret);
    expect(hasOrderSecrets(6, ORDER_B)).toBe(true);
  });

  it('still loads older records with rating secrets, next to new ones', () => {
    // as written before 2026-10-12, with and without the order contract and the pickup secret
    localStorage.setItem(deploymentKey('orderSecrets'), JSON.stringify({
      4: { nullifier: '1', trapdoor: '2' },
      5: { nullifier: '1001', trapdoor: '1002', pickupSecret: K, orderAddress: ORDER_A },
    }));
    saveOrderSecrets(6, NEW_SECRETS, ORDER_B);
    expect(pickupSecretOf(orderSecretsFor(4, ORDER_C))).toBeNull();
    expect(pickupSecretOf(orderSecretsFor(5, ORDER_A))).toBe(K);
    expect(pickupSecretOf(orderSecretsFor(6, ORDER_B))).toBe(NEW_SECRETS.pickupSecret);
    // the older records are kept as they were
    expect(JSON.parse(localStorage.getItem(deploymentKey('orderSecrets')))[5])
      .toEqual({ nullifier: '1001', trapdoor: '1002', pickupSecret: K, orderAddress: ORDER_A });
  });

  it('adopts a pending record that holds only the pickup secret', () => {
    const stealth = '0x1111111111111111111111111111111111111111';
    savePendingOrder(stealth, NEW_SECRETS, { id: 12, name: 'Cantina', address: 'Rua A, 1' });
    expect(adoptPendingOrder(6, ORDER_B, stealth)).toBe(true);
    expect(orderSecretsFor(6, ORDER_B)).toEqual({ pickupSecret: NEW_SECRETS.pickupSecret, orderAddress: ORDER_B });
    expect(pendingOrderFor(stealth)).toBeNull();
  });
});

describe('stored establishment of an order', () => {
  const INFO = { id: 12, name: 'Cantina', address: 'Rua A, 1' };

  it('keeps the order contract next to the establishment and the other orders untouched', () => {
    saveOrderRestaurantInfo(5, { id: 3, name: 'Old', address: '' }, null);
    saveOrderRestaurantInfo(6, INFO, ORDER_B);
    expect(JSON.parse(localStorage.getItem(deploymentKey('orderRestaurantInfo')))).toEqual({
      5: { id: 3, name: 'Old', address: '' },
      6: { id: 12, name: 'Cantina', address: 'Rua A, 1', orderAddress: ORDER_B },
    });
  });

  it('gives the establishment when the id still names the same order contract', () => {
    saveOrderRestaurantInfo(6, INFO, ORDER_B);
    expect(orderRestaurantInfoFor(6, ORDER_B.toLowerCase()).id).toBe(12);
    expect(orderRestaurantInfoFor('6', ORDER_B).name).toBe('Cantina');
  });

  it('ignores the establishment when the id names another order contract', () => {
    saveOrderRestaurantInfo(6, INFO, ORDER_B);
    expect(orderRestaurantInfoFor(6, ORDER_A)).toBeNull();
    expect(orderRestaurantInfoFor(6, ZERO)).toBeNull();
    expect(orderRestaurantInfoFor(6, undefined)).toBeNull();
  });

  it('uses records without an order contract (older orders) as before, and survives a malformed store', () => {
    localStorage.setItem(deploymentKey('orderRestaurantInfo'), JSON.stringify({ 6: { id: 3, name: 'Old', address: '' } }));
    expect(orderRestaurantInfoFor(6, ORDER_A)).toEqual({ id: 3, name: 'Old', address: '' });
    expect(orderRestaurantInfoFor(7, ORDER_A)).toBeNull();
    localStorage.setItem(deploymentKey('orderRestaurantInfo'), 'not json');
    expect(orderRestaurantInfoFor(6, ORDER_A)).toBeNull();
  });
});

describe('pending orders', () => {
  const STEALTH = '0x00000000000000000000000000000000000AbCdE';
  const OTHER_STEALTH = '0x00000000000000000000000000000000000F00D1';
  const INFO = { id: 12, name: 'Cantina', address: 'Rua A, 1' };
  const stored = (name) => JSON.parse(localStorage.getItem(deploymentKey(name)) || '{}');

  it('keeps the secrets, the establishment, the stealth address and a time before the order is sent', () => {
    const before = Date.now();
    expect(savePendingOrder(STEALTH, SECRETS, INFO)).toBe(true);
    const record = pendingOrderFor(STEALTH);
    expect(record.secrets).toEqual(SECRETS);
    expect(record.restaurantInfo).toEqual(INFO);
    expect(record.stealthAddress).toBe(STEALTH);
    expect(record.createdAt).toBeGreaterThanOrEqual(before);
    // nothing is in the normal records yet
    expect(stored('orderSecrets')).toEqual({});
    expect(stored('orderRestaurantInfo')).toEqual({});
  });

  it('finds the record whatever the case of the stealth address', () => {
    savePendingOrder(STEALTH, SECRETS, INFO);
    expect(pendingOrderFor(STEALTH.toLowerCase())).not.toBeNull();
    expect(pendingOrderFor('0x' + STEALTH.slice(2).toUpperCase())).not.toBeNull();
    expect(pendingOrderFor(OTHER_STEALTH)).toBeNull();
    expect(pendingOrderFor(undefined)).toBeNull();
  });

  it('does not keep a record without a stealth address', () => {
    expect(savePendingOrder(undefined, SECRETS, INFO)).toBe(false);
    expect(savePendingOrder('0x1234', SECRETS, INFO)).toBe(false);
    expect(localStorage.getItem(deploymentKey('pendingOrders'))).toBeNull();
  });

  it('removes one record and leaves the others', () => {
    savePendingOrder(STEALTH, SECRETS, INFO);
    savePendingOrder(OTHER_STEALTH, { nullifier: '5', trapdoor: '6', pickupSecret: K }, INFO);
    removePendingOrder(STEALTH.toLowerCase());
    expect(pendingOrderFor(STEALTH)).toBeNull();
    expect(pendingOrderFor(OTHER_STEALTH).secrets.nullifier).toBe('5');
    removePendingOrder(ORDER_A);
    expect(pendingOrderFor(OTHER_STEALTH)).not.toBeNull();
  });

  it('checkout: once the order is resolved, the normal records hold it and the pending record is gone', () => {
    // what Checkout does around makeOrder
    savePendingOrder(STEALTH, SECRETS, INFO);
    saveOrderSecrets(6, SECRETS, ORDER_B);
    saveOrderRestaurantInfo(6, INFO, ORDER_B);
    removePendingOrder(STEALTH);
    expect(stored('pendingOrders')).toEqual({});
    expect(pickupSecretOf(orderSecretsFor(6, ORDER_B))).toBe(K);
    expect(orderRestaurantInfoFor(6, ORDER_B).id).toBe(12);
  });

  it('orders page: adopts the pending record of an order that has no secrets (tab closed, order mined late)', () => {
    savePendingOrder(STEALTH, SECRETS, INFO);
    // the chain gives the stealth address in lower case, the record has mixed case
    expect(adoptPendingOrder('6', ORDER_B, STEALTH.toLowerCase())).toBe(true);
    expect(orderSecretsFor(6, ORDER_B)).toEqual(Object.assign({ orderAddress: ORDER_B }, SECRETS));
    expect(orderRestaurantInfoFor(6, ORDER_B)).toEqual(Object.assign({ orderAddress: ORDER_B }, INFO));
    expect(stored('pendingOrders')).toEqual({});
    // the record is stored under the id
    expect(stored('orderSecrets')[6].nullifier).toBe('1001');
    // a second look at the same order changes nothing
    expect(adoptPendingOrder('6', ORDER_B, STEALTH)).toBe(false);
  });

  it('orders page: does not give the record to an order with another stealth address', () => {
    savePendingOrder(STEALTH, SECRETS, INFO);
    expect(adoptPendingOrder(6, ORDER_B, OTHER_STEALTH)).toBe(false);
    expect(adoptPendingOrder(6, ORDER_B, ZERO)).toBe(false);
    expect(adoptPendingOrder(6, ORDER_B, undefined)).toBe(false);
    expect(orderSecretsFor(6, ORDER_B)).toBeNull();
    expect(pendingOrderFor(STEALTH)).not.toBeNull();
  });

  it('orders page: needs the order contract', () => {
    savePendingOrder(STEALTH, SECRETS, INFO);
    expect(adoptPendingOrder(6, ZERO, STEALTH)).toBe(false);
    expect(adoptPendingOrder(6, undefined, STEALTH)).toBe(false);
    expect(stored('orderSecrets')).toEqual({});
    expect(pendingOrderFor(STEALTH)).not.toBeNull();
  });

  it('orders page: keeps the secrets already stored for this order contract and drops the pending record', () => {
    // checkout stored the order and the tab was closed before the pending record was removed
    saveOrderSecrets(6, SECRETS, ORDER_B);
    savePendingOrder(STEALTH, { nullifier: '5', trapdoor: '6', pickupSecret: K }, INFO);
    expect(adoptPendingOrder(6, ORDER_B, STEALTH)).toBe(false);
    expect(orderSecretsFor(6, ORDER_B).nullifier).toBe('1001');
    expect(stored('pendingOrders')).toEqual({});
  });

  it('orders page: replaces secrets kept under the id for another order contract, or for none', () => {
    saveOrderSecrets(6, { nullifier: '5', trapdoor: '6' }, ORDER_A);
    saveOrderRestaurantInfo(6, { id: 3, name: 'Old', address: '' }, ORDER_A);
    savePendingOrder(STEALTH, SECRETS, INFO);
    expect(adoptPendingOrder(6, ORDER_B, STEALTH)).toBe(true);
    expect(orderSecretsFor(6, ORDER_B).nullifier).toBe('1001');
    expect(orderRestaurantInfoFor(6, ORDER_B).id).toBe(12);

    localStorage.clear();
    saveOrderSecrets(7, { nullifier: '5', trapdoor: '6' }, null);
    savePendingOrder(STEALTH, SECRETS, INFO);
    expect(adoptPendingOrder(7, ORDER_C, STEALTH)).toBe(true);
    expect(orderSecretsFor(7, ORDER_C)).toEqual(Object.assign({ orderAddress: ORDER_C }, SECRETS));
  });

  it('orders page: leaves an order alone when no pending record exists, and survives a malformed store', () => {
    saveOrderSecrets(6, { nullifier: '5', trapdoor: '6' }, null);
    expect(adoptPendingOrder(6, ORDER_B, STEALTH)).toBe(false);
    expect(orderSecretsFor(6, ORDER_B)).toEqual({ nullifier: '5', trapdoor: '6' });
    localStorage.setItem(deploymentKey('pendingOrders'), 'not json');
    expect(adoptPendingOrder(6, ORDER_B, STEALTH)).toBe(false);
    localStorage.setItem(deploymentKey('pendingOrders'), JSON.stringify({ [STEALTH.toLowerCase()]: 'broken' }));
    expect(adoptPendingOrder(6, ORDER_B, STEALTH)).toBe(false);
  });

  it('gives each of two pending orders to its own order', () => {
    savePendingOrder(STEALTH, SECRETS, INFO);
    savePendingOrder(OTHER_STEALTH, { nullifier: '5', trapdoor: '6', pickupSecret: K }, { id: 4, name: 'Bar', address: '' });
    expect(adoptPendingOrder(8, ORDER_C, OTHER_STEALTH)).toBe(true);
    expect(adoptPendingOrder(7, ORDER_B, STEALTH)).toBe(true);
    expect(orderSecretsFor(7, ORDER_B).nullifier).toBe('1001');
    expect(orderSecretsFor(8, ORDER_C).nullifier).toBe('5');
    expect(orderRestaurantInfoFor(8, ORDER_C).id).toBe(4);
  });
});

describe('records of another deployment', () => {
  const OTHER_CHAIN = '0x00000000000000000000000000000000000000C1';
  const STEALTH = '0x00000000000000000000000000000000000AbCdE';
  const INFO = { id: 12, name: 'Cantina', address: 'Rua A, 1' };
  // a record that names no order contract is used for whatever order has its number
  const UNRESOLVED = { pickupSecret: K };

  it('does not give order 6 the secret or the establishment kept for order 6 of another deployment', () => {
    setDeployment(11155111);
    saveOrderSecrets(6, UNRESOLVED, null);
    saveOrderRestaurantInfo(6, INFO, null);
    expect(pickupSecretOf(orderSecretsFor(6, ORDER_A))).toBe(K);

    // the contracts deployed again on the same chain: order numbers start again
    setDeployment(11155111, OTHER_CHAIN);
    expect(orderSecretsFor(6, ORDER_A)).toBeNull();
    expect(hasOrderSecrets(6, ORDER_A)).toBe(false);
    expect(orderRestaurantInfoFor(6, ORDER_A)).toBeNull();
    // another chain
    setDeployment(31337);
    expect(orderSecretsFor(6, ORDER_A)).toBeNull();
    expect(orderRestaurantInfoFor(6, ORDER_A)).toBeNull();

    // a new order 6 there gets its own record, and the first one is still whole
    saveOrderSecrets(6, NEW_SECRETS, ORDER_B);
    setDeployment(11155111);
    expect(orderSecretsFor(6, ORDER_A)).toEqual(UNRESOLVED);
    expect(orderRestaurantInfoFor(6, ORDER_A)).toEqual(INFO);
  });

  it('keeps pending orders per deployment too', () => {
    setDeployment(11155111);
    expect(savePendingOrder(STEALTH, NEW_SECRETS, INFO)).toBe(true);
    setDeployment(31337);
    expect(pendingOrderFor(STEALTH)).toBeNull();
    expect(adoptPendingOrder(6, ORDER_B, STEALTH)).toBe(false);
    expect(orderSecretsFor(6, ORDER_B)).toBeNull();
    removePendingOrder(STEALTH);
    setDeployment(11155111);
    expect(pendingOrderFor(STEALTH).secrets).toEqual(NEW_SECRETS);
    expect(adoptPendingOrder(6, ORDER_B, STEALTH)).toBe(true);
  });

  it('leaves what is stored under the old names in place and does not read it', () => {
    const before = {
      orderSecrets: JSON.stringify({ 6: UNRESOLVED }),
      orderRestaurantInfo: JSON.stringify({ 6: INFO }),
      pendingOrders: JSON.stringify({ [STEALTH.toLowerCase()]: { stealthAddress: STEALTH, secrets: NEW_SECRETS, restaurantInfo: INFO } }),
    };
    Object.keys(before).forEach(name => localStorage.setItem(name, before[name]));
    expect(orderSecretsFor(6, ORDER_A)).toBeNull();
    expect(orderRestaurantInfoFor(6, ORDER_A)).toBeNull();
    expect(pendingOrderFor(STEALTH)).toBeNull();
    expect(adoptPendingOrder(6, ORDER_A, STEALTH)).toBe(false);
    saveOrderSecrets(6, NEW_SECRETS, ORDER_B);
    saveOrderRestaurantInfo(6, INFO, ORDER_B);
    savePendingOrder(STEALTH, NEW_SECRETS, INFO);
    removePendingOrder(STEALTH);
    Object.keys(before).forEach(name => expect(localStorage.getItem(name)).toBe(before[name]));
  });

  it('writes nothing while the deployment is not known, and keeps a pending record for the next try', () => {
    savePendingOrder(STEALTH, NEW_SECRETS, INFO);
    setDeployment(null);
    expect(saveOrderSecrets(6, NEW_SECRETS, ORDER_B)).toBe(false);
    expect(saveOrderRestaurantInfo(6, INFO, ORDER_B)).toBe(false);
    expect(savePendingOrder(STEALTH, NEW_SECRETS, INFO)).toBe(false);
    expect(adoptPendingOrder(6, ORDER_B, STEALTH)).toBe(false);
    expect(Object.keys(localStorage)).toHaveLength(1);
    setDeployment(31337);
    expect(orderSecretsFor(6, ORDER_B)).toBeNull();
    expect(adoptPendingOrder(6, ORDER_B, STEALTH)).toBe(true);
    expect(pickupSecretOf(orderSecretsFor(6, ORDER_B))).toBe(NEW_SECRETS.pickupSecret);
  });
});
