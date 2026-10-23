import {
  setDeployment, deploymentScope, loadDeployment, deploymentKey, readDeploymentStore, writeDeploymentStore,
} from './deploymentStorage';
import { CHAIN_ADDRESS } from '../services/config';

const OTHER_CHAIN = '0x00000000000000000000000000000000000000C1';

afterEach(() => {
  localStorage.clear();
  setDeployment(null);
  delete window.ethereum;
});

describe('the deployment', () => {
  it('is the chain id and the Chain contract of this app, in one form whatever the input', () => {
    const scope = '11155111:' + CHAIN_ADDRESS.toLowerCase();
    expect(setDeployment(11155111)).toBe(scope);
    expect(setDeployment('11155111')).toBe(scope);
    expect(setDeployment('0xaa36a7')).toBe(scope);
    expect(deploymentScope()).toBe(scope);
    expect(deploymentKey('orderSecrets')).toBe('orderSecrets@' + scope);
    expect(setDeployment(31337, OTHER_CHAIN.toUpperCase().replace('0X', '0x')))
      .toBe('31337:' + OTHER_CHAIN.toLowerCase());
  });

  it('is not set from a value that is not a chain id or an address', () => {
    [null, undefined, '', 'abc', 0, -1, 1.5, [1], {}, ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']].forEach((chainId) => {
      setDeployment(1);
      expect(setDeployment(chainId)).toBeNull();
      expect(deploymentScope()).toBeNull();
      expect(deploymentKey('orderSecrets')).toBeNull();
    });
    expect(setDeployment(1, '0x1234')).toBeNull();
    expect(setDeployment(1, null)).toBeNull();
  });

  it('is read from the wallet each time, or from web3 without a wallet', async () => {
    let chainId = '0xaa36a7';
    const asked = [];
    window.ethereum = { request: async ({ method }) => { asked.push(method); return chainId; } };
    await expect(loadDeployment()).resolves.toBe('11155111:' + CHAIN_ADDRESS.toLowerCase());
    chainId = '0x7a69';
    await expect(loadDeployment()).resolves.toBe('31337:' + CHAIN_ADDRESS.toLowerCase());
    expect(asked).toEqual(['eth_chainId', 'eth_chainId']);
    delete window.ethereum;
    await expect(loadDeployment({ eth: { getChainId: async () => 1337 } })).resolves.toBe('1337:' + CHAIN_ADDRESS.toLowerCase());
  });

  it('throws, and sets no deployment, when the chain id cannot be read', async () => {
    setDeployment(1);
    window.ethereum = { request: async () => ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'] };
    await expect(loadDeployment()).rejects.toThrow('The network of the wallet could not be read');
    expect(deploymentScope()).toBeNull();
    delete window.ethereum;
    await expect(loadDeployment()).rejects.toThrow('could not be read');
    window.ethereum = { request: async () => { throw new Error('disconnected'); } };
    await expect(loadDeployment()).rejects.toThrow('disconnected');
  });
});

describe('a store of a deployment', () => {
  it('is kept apart for each chain id and each Chain contract', () => {
    setDeployment(11155111);
    expect(writeDeploymentStore('orders', { 1: 'sepolia' })).toBe(true);
    setDeployment(31337);
    expect(readDeploymentStore('orders')).toEqual({});
    writeDeploymentStore('orders', { 1: 'local' });
    setDeployment(31337, OTHER_CHAIN);
    expect(readDeploymentStore('orders')).toEqual({});
    writeDeploymentStore('orders', { 1: 'local, redeployed' });

    setDeployment(11155111);
    expect(readDeploymentStore('orders')).toEqual({ 1: 'sepolia' });
    setDeployment(31337);
    expect(readDeploymentStore('orders')).toEqual({ 1: 'local' });
    setDeployment(31337, OTHER_CHAIN);
    expect(readDeploymentStore('orders')).toEqual({ 1: 'local, redeployed' });
    expect(Object.keys(localStorage).sort()).toEqual([
      'orders@11155111:' + CHAIN_ADDRESS.toLowerCase(),
      'orders@31337:' + OTHER_CHAIN.toLowerCase(),
      'orders@31337:' + CHAIN_ADDRESS.toLowerCase(),
    ].sort());
  });

  it('never reads or changes what is stored under the bare name', () => {
    localStorage.setItem('orders', JSON.stringify({ 1: 'before' }));
    setDeployment(11155111);
    expect(readDeploymentStore('orders')).toEqual({});
    writeDeploymentStore('orders', { 1: 'now' });
    expect(localStorage.getItem('orders')).toBe(JSON.stringify({ 1: 'before' }));
  });

  it('reads nothing and writes nothing while no deployment is set', () => {
    setDeployment(11155111);
    writeDeploymentStore('orders', { 1: 'sepolia' });
    setDeployment(null);
    expect(readDeploymentStore('orders')).toEqual({});
    expect(writeDeploymentStore('orders', { 2: 'lost' })).toBe(false);
    expect(Object.keys(localStorage)).toHaveLength(1);
  });

  it('survives a malformed store', () => {
    setDeployment(1);
    ['not json', '[1]', 'null', '"text"', '5'].forEach((content) => {
      localStorage.setItem(deploymentKey('orders'), content);
      expect(readDeploymentStore('orders')).toEqual({});
    });
  });
});
