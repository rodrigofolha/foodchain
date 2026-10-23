import {
  deploymentId, deploymentKey, configuredChainId, readDeployment, writeDeployment, removeDeployment,
  DEPLOYMENT_KEYS, PERSON_KEYS,
} from './deploymentStorage';
import { storePaymentNote, getPaymentNotes, claimRevenueNote } from './zkWithdraw';
import { paymentCommitmentFor } from './paymentSecrets';
import { getCashoutLedger, addPendingWithdrawal, hasPendingCashouts, setAsidePendingCashouts, countSetAsideCashouts, getRevenueSummary } from './cashout';
import { storePickupConfirmation, storedPickupConfirmation } from './pickupKeyDisplay';
import { recordFunding, recordedFunding } from './orderFunding';
import { hasPendingGasReturns } from './gasReturn';
import { getOrCreateSpendKey, storeStealthKey, getStealthKey } from './stealth';

// The configuration the helper reads; the tests change it to stand for another deployment
jest.mock('../services/config', () => ({
  CHAIN_ADDRESS: '0x00000000000000000000000000000000000000A1',
  SEPOLIA_RPC_URL: 'https://sepolia.example/v3/key',
}));
const config = require('../services/config');

const FIRST = { CHAIN_ADDRESS: '0x00000000000000000000000000000000000000A1', SEPOLIA_RPC_URL: 'https://sepolia.example/v3/key' };
const WORKER = '0x00000000000000000000000000000000000000b2';
const SIGNATURE = '0x' + 'ab'.repeat(65);

function deploy(settings) {
  delete config.CHAIN_ID;
  Object.assign(config, FIRST, settings);
}

beforeAll(() => {
  // jsdom of this setup has no window.crypto
  if (!window.crypto) window.crypto = require('crypto').webcrypto;
});

beforeEach(() => {
  localStorage.clear();
  deploy({});
});

describe('the name of a deployment', () => {
  it('is the chain id and the Chain address in lower case', () => {
    expect(deploymentId()).toBe('11155111:0x00000000000000000000000000000000000000a1');
    expect(deploymentKey('restaurantPaymentNotes')).toBe('restaurantPaymentNotes@11155111:0x00000000000000000000000000000000000000a1');
  });

  it('takes the chain id from the configuration when it names one, else from the RPC address', () => {
    expect(configuredChainId()).toBe(11155111);
    deploy({ SEPOLIA_RPC_URL: 'http://127.0.0.1:8545' });
    expect(configuredChainId()).toBe(31337);
    deploy({ SEPOLIA_RPC_URL: 'http://localhost:8545/' });
    expect(configuredChainId()).toBe(31337);
    deploy({ SEPOLIA_RPC_URL: 'https://ethereum-hoodi-rpc.publicnode.com' });
    expect(configuredChainId()).toBe(560048);
    deploy({ SEPOLIA_RPC_URL: 'https://hoodi.drpc.org' });
    expect(configuredChainId()).toBe(560048);
    deploy({ SEPOLIA_RPC_URL: 'https://rpc.example.org' });
    expect(configuredChainId()).toBe(0);
    deploy({ SEPOLIA_RPC_URL: 'https://rpc.example.org', CHAIN_ID: 1 });
    expect(configuredChainId()).toBe(1);
    deploy({ CHAIN_ID: '31337' });
    expect(deploymentId()).toBe('31337:0x00000000000000000000000000000000000000a1');
  });

  it('refuses a name that is not on the list, so that nothing is bound by accident', () => {
    expect(() => deploymentKey('restaurantSpendKey')).toThrow(/Not a storage name/);
    expect(() => readDeployment('somethingElse', 1)).toThrow(/Not a storage name/);
    PERSON_KEYS.forEach((name) => expect(DEPLOYMENT_KEYS).not.toContain(name));
  });

  it('reads, writes and removes under the deployment only', () => {
    expect(readDeployment('poolCashoutLedger', { none: true })).toEqual({ none: true });
    writeDeployment('poolCashoutLedger', { cashedOutWei: '5' });
    expect(readDeployment('poolCashoutLedger', null)).toEqual({ cashedOutWei: '5' });
    expect(localStorage.getItem('poolCashoutLedger')).toBeNull();
    removeDeployment('poolCashoutLedger');
    expect(readDeployment('poolCashoutLedger', null)).toBeNull();
  });
});

// Leaves a record of every kind, as the dApp's own modules write them
function useEverything() {
  storePaymentNote({ nullifier: '1', trapdoor: '2', amount: '1000', leafIndex: 1, commitment: '77' });
  paymentCommitmentFor('7', '0x00000000000000000000000000000000000000c3', '1760000000',
    () => ({ nullifier: '3', trapdoor: '4', commitment: '88' }));
  addPendingWithdrawal({ spent: ['1'], nullifierHash: '9', change: { nullifier: '5', trapdoor: '6', amount: '10' }, changeLeaf: '99', withdrawAmount: '990', all: false });
  storePickupConfirmation('7', WORKER, SIGNATURE);
  recordFunding(WORKER, '500');
}

describe('what a browser keeps of one deployment', () => {
  it('is not there for another Chain address or another chain id, and is back with the first', () => {
    useEverything();
    setAsidePendingCashouts();
    addPendingWithdrawal({ spent: [], nullifierHash: '8', change: { nullifier: '7', trapdoor: '8', amount: '1' }, changeLeaf: '98', withdrawAmount: '1', all: false });
    writeDeployment('gasReturns', [{ leaf: '5' }]);
    writeDeployment('poolCashoutLedger', { countedNotes: 2, cashedOutWei: '30', open: true, withdrawals: [] });

    const empty = () => {
      expect(getPaymentNotes()).toEqual([]);
      expect(hasPendingCashouts()).toBe(false);
      expect(countSetAsideCashouts()).toBe(0);
      expect(getCashoutLedger()).toEqual({ countedNotes: 0, cashedOutWei: '0', open: false, withdrawals: [] });
      expect(getRevenueSummary()).toEqual({ revenueCount: 0, revenueWei: '0' });
      expect(storedPickupConfirmation('7', WORKER)).toBeNull();
      expect(recordedFunding(WORKER)).toBe(0n);
      expect(hasPendingGasReturns()).toBe(false);
      // the payment secrets of order 7 of the other deployment are not sent again
      let made = 0;
      expect(paymentCommitmentFor('7', '0x00000000000000000000000000000000000000c3', '1760000000',
        () => { made += 1; return { nullifier: '30', trapdoor: '40', commitment: '880' }; })).toBe('880');
      expect(made).toBe(1);
    };

    deploy({ CHAIN_ADDRESS: '0x00000000000000000000000000000000000000B9' });
    empty();
    deploy({ SEPOLIA_RPC_URL: 'http://127.0.0.1:8545' });
    empty();

    deploy({});
    expect(getPaymentNotes()).toHaveLength(1);
    expect(hasPendingCashouts()).toBe(true);
    expect(countSetAsideCashouts()).toBe(1);
    expect(getCashoutLedger()).toMatchObject({ countedNotes: 2, cashedOutWei: '30', open: true });
    expect(storedPickupConfirmation('7', WORKER)).toBe(SIGNATURE);
    expect(recordedFunding(WORKER)).toBe(500n);
    expect(hasPendingGasReturns()).toBe(true);
    expect(paymentCommitmentFor('7', '0x00000000000000000000000000000000000000c3', '1760000000', () => { throw new Error('not made again'); })).toBe('88');
  });

  it('writes nothing under a plain name', () => {
    useEverything();
    setAsidePendingCashouts();
    writeDeployment('gasReturns', []);
    const keys = Object.keys(localStorage);
    expect(keys.length).toBeGreaterThan(0);
    keys.forEach((key) => expect(key).toMatch(/@11155111:0x00000000000000000000000000000000000000a1$/));
    DEPLOYMENT_KEYS.forEach((name) => expect(localStorage.getItem(name)).toBeNull());
  });

  it('leaves the data stored under the old plain names in place and does not read it', () => {
    const old = {
      restaurantPaymentNotes: JSON.stringify([{ nullifier: '1', trapdoor: '2', amount: '5', leafIndex: 1, commitment: '7', spent: false }]),
      paymentNoteSecrets: JSON.stringify({ 7: { nullifier: '3', trapdoor: '4', commitment: '8', claimed: true } }),
      poolCashoutPending: JSON.stringify([{ changeLeaf: '9' }]),
      poolCashoutAside: JSON.stringify([{ changeLeaf: '10' }]),
      poolCashoutLedger: JSON.stringify({ countedNotes: 4, cashedOutWei: '100' }),
      pickupConfirmations: JSON.stringify({ 7: { worker: WORKER, signature: SIGNATURE } }),
    };
    Object.keys(old).forEach((key) => localStorage.setItem(key, old[key]));

    expect(getPaymentNotes()).toEqual([]);
    expect(hasPendingCashouts()).toBe(false);
    expect(countSetAsideCashouts()).toBe(0);
    expect(getCashoutLedger().cashedOutWei).toBe('0');
    expect(getRevenueSummary().revenueCount).toBe(0);
    expect(storedPickupConfirmation('7', WORKER)).toBeNull();
    expect(claimRevenueNote('7', '5', { allLeaves: [] })).toBe(false);

    useEverything();
    Object.keys(old).forEach((key) => expect(localStorage.getItem(key)).toBe(old[key]));
  });
});

describe('what belongs to the person', () => {
  it('stays under its plain name and is the same for every deployment', () => {
    const keys = getOrCreateSpendKey();
    storeStealthKey('0x00000000000000000000000000000000000000D4', '0x' + '12'.repeat(32));
    localStorage.setItem('authorization', 'token');
    expect(localStorage.getItem('restaurantSpendKey')).not.toBeNull();
    expect(localStorage.getItem('restaurantStealthKeys')).not.toBeNull();

    deploy({ CHAIN_ADDRESS: '0x00000000000000000000000000000000000000B9', SEPOLIA_RPC_URL: 'http://127.0.0.1:8545' });
    expect(getOrCreateSpendKey()).toEqual(keys);
    expect(getStealthKey('0x00000000000000000000000000000000000000d4')).toBe('0x' + '12'.repeat(32));
    expect(localStorage.getItem('authorization')).toBe('token');
  });
});
