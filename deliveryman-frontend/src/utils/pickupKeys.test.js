import { storedPickupKey, storePickupKey, openSealedDetails, detailsState } from './pickupKeys';
import { sealDetailsWith } from './pickupSeal';
import { setDeployment, deploymentKey } from './deploymentStorage';

const S = '8OHSw7Sllod4aVpLPC0eDw';
const KEY_WORKER_1 = 'dcpk1:mHyYqQwT6_c5_b6cKAwtyQ';
const KEY_WORKER_2 = 'dcpk1:Vh32Dp3DFxebtDusHX79Hw';
const ITEMS = [{ name: 'Pão de queijo', quantity: 1, price: 7 }];
const deploymentKeyOf = (chainId) => { setDeployment(chainId); return deploymentKey('pickupKeys'); };

// the keys are kept per deployment: a local chain and this app's Chain contract
beforeEach(() => setDeployment(31337));
afterEach(() => localStorage.clear());

describe('stored pickup keys', () => {
  it('keeps one key per order', () => {
    expect(storedPickupKey('7')).toBeNull();
    storePickupKey('7', KEY_WORKER_1);
    storePickupKey('9', KEY_WORKER_2);
    expect(storedPickupKey('7')).toBe(KEY_WORKER_1);
    expect(storedPickupKey(7)).toBe(KEY_WORKER_1);
    expect(storedPickupKey('9')).toBe(KEY_WORKER_2);
    expect(JSON.parse(localStorage.getItem(deploymentKey('pickupKeys')))).toEqual({ 7: KEY_WORKER_1, 9: KEY_WORKER_2 });
  });

  it('does not store or return text that is not a pickup key', () => {
    storePickupKey('7', 'hello');
    expect(localStorage.getItem(deploymentKey('pickupKeys'))).toBeNull();
    localStorage.setItem(deploymentKey('pickupKeys'), JSON.stringify({ 7: 'hello' }));
    expect(storedPickupKey('7')).toBeNull();
  });

  it('survives a malformed store', () => {
    localStorage.setItem(deploymentKey('pickupKeys'), 'not json');
    expect(storedPickupKey('7')).toBeNull();
    storePickupKey('7', KEY_WORKER_1);
    expect(storedPickupKey('7')).toBe(KEY_WORKER_1);

    localStorage.setItem(deploymentKey('pickupKeys'), '[1]');
    expect(storedPickupKey('0')).toBeNull();
    localStorage.setItem(deploymentKey('pickupKeys'), 'null');
    expect(storedPickupKey('7')).toBeNull();
  });
});

describe('stored pickup keys of another deployment', () => {
  const OTHER_CHAIN = '0x00000000000000000000000000000000000000C1';

  it('does not give order 7 the key that opened order 7 of another deployment', () => {
    setDeployment(11155111);
    storePickupKey('7', KEY_WORKER_1);
    // the same chain, the contracts deployed again: order numbers start again
    setDeployment(11155111, OTHER_CHAIN);
    expect(storedPickupKey('7')).toBeNull();
    storePickupKey('7', KEY_WORKER_2);
    // another chain, the same Chain address
    setDeployment(31337);
    expect(storedPickupKey('7')).toBeNull();

    setDeployment(11155111);
    expect(storedPickupKey('7')).toBe(KEY_WORKER_1);
    setDeployment(11155111, OTHER_CHAIN);
    expect(storedPickupKey('7')).toBe(KEY_WORKER_2);
  });

  it('leaves a store kept under the old name in place and does not read it', () => {
    localStorage.setItem('pickupKeys', JSON.stringify({ 7: KEY_WORKER_1 }));
    expect(storedPickupKey('7')).toBeNull();
    storePickupKey('7', KEY_WORKER_2);
    expect(JSON.parse(localStorage.getItem('pickupKeys'))).toEqual({ 7: KEY_WORKER_1 });
    expect(storedPickupKey('7')).toBe(KEY_WORKER_2);
  });

  it('keeps and gives no key while the deployment is not known', () => {
    storePickupKey('7', KEY_WORKER_1);
    setDeployment(null);
    expect(storedPickupKey('7')).toBeNull();
    storePickupKey('9', KEY_WORKER_2);
    expect(Object.keys(localStorage)).toEqual([deploymentKeyOf(31337)]);
    setDeployment(31337);
    expect(storedPickupKey('7')).toBe(KEY_WORKER_1);
    expect(storedPickupKey('9')).toBeNull();
  });
});

describe('openSealedDetails', () => {
  it('returns the address and the items', () => {
    const sealed = sealDetailsWith(KEY_WORKER_1, S, { deliveryAddress: 'Rua São João, 100, apto 3', items: ITEMS });
    expect(openSealedDetails(KEY_WORKER_1, S, sealed))
      .toEqual({ deliveryAddress: 'Rua São João, 100, apto 3', items: ITEMS });
  });

  it('refuses a key that does not match', () => {
    const sealed = sealDetailsWith(KEY_WORKER_1, S, { deliveryAddress: '1 Main St', items: ITEMS });
    expect(() => openSealedDetails(KEY_WORKER_2, S, sealed)).toThrow('PICKUP_KEY_MISMATCH');
    expect(() => openSealedDetails('hello', S, sealed)).toThrow('PICKUP_KEY_MISMATCH');
  });

  it('gives values the page can show when fields are missing or of another type', () => {
    expect(openSealedDetails(KEY_WORKER_1, S, sealDetailsWith(KEY_WORKER_1, S, {})))
      .toEqual({ deliveryAddress: '', items: [] });
    expect(openSealedDetails(KEY_WORKER_1, S, sealDetailsWith(KEY_WORKER_1, S, { deliveryAddress: 5, items: 'x' })))
      .toEqual({ deliveryAddress: '', items: [] });
    expect(openSealedDetails(KEY_WORKER_1, S, sealDetailsWith(KEY_WORKER_1, S, [1, 2])))
      .toEqual({ deliveryAddress: '', items: [] });
    expect(openSealedDetails(KEY_WORKER_1, S, sealDetailsWith(KEY_WORKER_1, S, { deliveryAddress: 'x', items: [null, 3, ITEMS[0]] })))
      .toEqual({ deliveryAddress: 'x', items: ITEMS });
  });
});

describe('detailsState', () => {
  const sealed = sealDetailsWith(KEY_WORKER_1, S, { deliveryAddress: '1 Main St', items: ITEMS });

  it('is none while the customer has sent nothing, or only one of the two strings', () => {
    expect(detailsState(['', ''])).toBe('none');
    expect(detailsState({ 0: '', 1: '' })).toBe('none');
    expect(detailsState(['0xa1', ''])).toBe('none');
    expect(detailsState(['', sealed])).toBe('none');
    expect(detailsState(null)).toBe('none');
    expect(detailsState(undefined)).toBe('none');
  });

  it('tells a sealed order from one placed before the pickup key existed', () => {
    // web3 returns an object with numeric keys
    expect(detailsState({ 0: '0xf1', 1: sealed })).toBe('sealed');
    expect(detailsState(['0xf1', sealed])).toBe('sealed');
    expect(detailsState({ 0: '0xa1', 1: '0xa2' })).toBe('legacy');
  });
});
