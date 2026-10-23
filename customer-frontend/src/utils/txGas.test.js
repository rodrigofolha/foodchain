import { GAS_MARGIN_PERCENT, gasLimitFor, estimateUnavailable, withEstimatedGas } from './txGas';

// A contract method call as web3 gives it: `estimate` is what the node answers.
function fakeTx(estimate) {
  const asked = [];
  return {
    asked,
    estimateGas: async (options) => { asked.push(options); return estimate(); },
  };
}

describe('gasLimitFor', () => {
  it('is the estimate with the margin, rounded up', () => {
    expect(GAS_MARGIN_PERCENT).toBeGreaterThanOrEqual(120);
    expect(gasLimitFor(100000)).toBe(125000);
    expect(gasLimitFor('5927035')).toBe(7408794);
    expect(gasLimitFor(21001)).toBe(26252);
  });

  it('follows the estimate, whatever the schedule', () => {
    // makeOrder: locally, on Sepolia with one item, and with a longer item list
    [1230393, 5927035, 9000000, 28000000].forEach((estimate) => {
      expect(gasLimitFor(estimate)).toBeGreaterThanOrEqual(estimate * 1.2);
    });
  });

  it('is null for an answer that is not a positive number', () => {
    [0, -5, NaN, undefined, null, 'abc', {}].forEach((estimate) => expect(gasLimitFor(estimate)).toBeNull());
  });
});

describe('withEstimatedGas', () => {
  it('asks the estimate with the sender and the value, and adds the gas limit', async () => {
    const tx = fakeTx(() => 6045576);
    const options = { from: '0xabc', value: '2000000000000000' };
    await expect(withEstimatedGas(tx, options)).resolves.toEqual({ from: '0xabc', value: '2000000000000000', gas: 7556970 });
    expect(tx.asked).toEqual([{ from: '0xabc', value: '2000000000000000' }]);
    // the caller's object is not changed
    expect(options).toEqual({ from: '0xabc', value: '2000000000000000' });
  });

  it('ignores a gas limit given by the caller', async () => {
    const tx = fakeTx(() => 200000);
    await expect(withEstimatedGas(tx, { from: '0xabc', gas: 5000000 })).resolves.toEqual({ from: '0xabc', gas: 250000 });
    expect(tx.asked).toEqual([{ from: '0xabc' }]);
  });

  it('throws the node\'s error as it is when the call would fail', async () => {
    const failures = [
      new Error("VM Exception while processing transaction: reverted with reason string 'Function cannot be called at this step'"),
      Object.assign(new Error('execution reverted: This caller is unauthorized'), { code: 3, data: '0x08c379a0' }),
      Object.assign(new Error('Internal JSON-RPC error.'), { code: -32603, data: { message: 'execution reverted' } }),
      new Error('insufficient funds for gas * price + value'),
      new Error('gas required exceeds allowance (30000000)'),
      new Error('something nobody expected'),
    ];
    for (const failure of failures) {
      const tx = fakeTx(() => { throw failure; });
      await expect(withEstimatedGas(tx, { from: '0xabc' })).rejects.toBe(failure);
    }
  });

  it('falls back to the wallet\'s own limit when no estimate could be made, and prints a message only', async () => {
    const written = [];
    const spy = jest.spyOn(console, 'warn').mockImplementation((...args) => { written.push(args); });
    const unavailable = [
      new Error('Too Many Requests'),
      Object.assign(new Error('The method eth_estimateGas does not exist/is not available'), { code: -32601 }),
      Object.assign(new Error('request limit reached'), { code: -32005 }),
      new Error('Invalid JSON RPC response: ""'),
      new Error('CONNECTION TIMEOUT'),
      new TypeError('Failed to fetch'),
    ];
    for (const failure of unavailable) {
      const tx = fakeTx(() => { throw failure; });
      await expect(withEstimatedGas(tx, { from: '0xabc', value: '1', gas: 4000000 })).resolves.toEqual({ from: '0xabc', value: '1' });
    }
    // an answer that is not a number is no estimate either
    await expect(withEstimatedGas(fakeTx(() => null), { from: '0xabc' })).resolves.toEqual({ from: '0xabc' });
    spy.mockRestore();
    expect(written).toHaveLength(unavailable.length + 1);
    written.forEach((args) => {
      expect(args[0]).toBe('Gas could not be estimated; the wallet sets the limit:');
      args.forEach(arg => expect(typeof arg).toBe('string'));
    });
  });
});

describe('estimateUnavailable', () => {
  it('never takes an execution failure for a missing answer', () => {
    expect(estimateUnavailable(new Error('execution reverted: request timeout of the order'))).toBe(false);
    expect(estimateUnavailable(Object.assign(new Error('timeout'), { data: '0x08c379a0' }))).toBe(false);
    expect(estimateUnavailable(new Error('insufficient funds'))).toBe(false);
    expect(estimateUnavailable(null)).toBe(false);
    expect(estimateUnavailable(new Error('rate limit exceeded'))).toBe(true);
    expect(estimateUnavailable('timeout')).toBe(true);
  });
});
