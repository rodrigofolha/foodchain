import {
  GAS_MARGIN_PERCENT, withGasMargin, formatEth, sendFromWallet, upfrontCost, oneTimeOverrides, sendOneTime,
  isEstimateError, isShortOfGasError, sendErrorText,
} from './oneTimeSend';

const ADDRESS = '0x00000000000000000000000000000000000000e1';
const big = (x) => ({ toString: () => String(x) });

// A contract of the one-time wallet: the node estimates `estimate` gas for every call
function oneTime({ balance, gasPrice, estimate }) {
  const node = { sent: [], estimates: [] };
  node.contract = {
    provider: { getBalance: async () => big(node.balance), getGasPrice: async () => big(gasPrice) },
    signer: { getAddress: async () => ADDRESS },
    estimateGas: {
      cancelOrder: async (...args) => {
        node.estimates.push(args);
        if (estimate instanceof Error) throw estimate;
        return big(estimate);
      },
    },
    cancelOrder: async (...args) => {
      node.sent.push(args);
      return { wait: async () => ({ status: 1 }) };
    },
  };
  node.balance = balance;
  return node;
}

describe('the gas limit of a transaction', () => {
  it('is the estimate times 1.2, rounded up', () => {
    expect(GAS_MARGIN_PERCENT).toBe(120);
    expect(withGasMargin(1000000)).toBe(1200000n);
    expect(withGasMargin('492172')).toBe(590607n);
    expect(withGasMargin(1)).toBe(2n);
    expect(withGasMargin(big(1349001))).toBe(1618802n);
  });

  it('follows the estimate under either gas schedule: prepareOrder and an ending that inserts a note', () => {
    // main network's schedule, then Sepolia's since 2026-10-06
    expect(withGasMargin(137392) > 137392n).toBe(true);
    expect(withGasMargin(511859) > 511859n).toBe(true);
    // 400,000 gas is below both Sepolia needs
    expect(withGasMargin(511859) > 400000n && withGasMargin(1073800) > 400000n).toBe(true);
  });
});

describe('a transaction from the wallet', () => {
  it('is sent with the estimate times the margin and no fixed limit', async () => {
    const seen = [];
    const call = { estimateGas: async (options) => { seen.push(options); return 963123; }, send: async (options) => { seen.push(options); return { status: true }; } };
    expect(await sendFromWallet(call, { from: ADDRESS, value: '5' })).toEqual({ status: true });
    expect(seen).toEqual([{ from: ADDRESS, value: '5' }, { from: ADDRESS, value: '5', gas: '1155748' }]);
  });

  it('is not sent when the node cannot estimate it, and the reason is kept', async () => {
    let sent = 0;
    const call = { estimateGas: async () => { throw new Error('execution reverted: Function cannot be called at this step'); }, send: async () => { sent += 1; } };
    const err = await sendFromWallet(call, { from: ADDRESS }).catch((e) => e);
    expect(isEstimateError(err)).toBe(true);
    expect(sent).toBe(0);
    expect(sendErrorText(err)).toBe('This is not possible in the current state of the order. Reload the page to see its state. Nothing was sent.');
  });
});

describe('a transaction from an order one-time address', () => {
  const PRICE = 1500000000n; // 1.5 gwei

  it('carries the estimate times the margin and a legacy gas price', async () => {
    const node = oneTime({ balance: 10n ** 16n, gasPrice: PRICE, estimate: 1349001 });
    expect(await oneTimeOverrides(node.contract, 'cancelOrder', ['0xorder'])).toEqual({ gasLimit: '1618802', gasPrice: PRICE.toString() });
    // the estimate is asked without a gas price: the node would cap it by the balance
    expect(node.estimates).toEqual([['0xorder', {}]]);
    await sendOneTime(node.contract, 'cancelOrder', ['0xorder']);
    expect(node.sent).toEqual([['0xorder', { gasLimit: '1618802', gasPrice: PRICE.toString() }]]);
  });

  it('sends the value and counts it in what the address must hold', async () => {
    const fee = 3n * 10n ** 15n;
    const exact = 600000n * PRICE + fee;
    const node = oneTime({ balance: exact, gasPrice: PRICE, estimate: 500000 });
    expect(await oneTimeOverrides(node.contract, 'cancelOrder', ['0xorder'], { value: fee.toString() }))
      .toEqual({ gasLimit: '600000', gasPrice: PRICE.toString(), value: fee.toString() });
    expect(node.estimates[0][1]).toEqual({ value: fee.toString() });

    node.balance = exact - 1n;
    const err = await sendOneTime(node.contract, 'cancelOrder', ['0xorder'], { value: fee.toString() }).catch((e) => e);
    expect(isShortOfGasError(err)).toBe(true);
    expect(err.missing).toBe(1n);
    expect(node.sent).toHaveLength(0);
  });

  it('sends nothing when the balance does not cover limit times price, and says what is missing', async () => {
    // 1.6 million gas at 1.5 gwei is 0.0024 ETH; the address holds 0.002
    const node = oneTime({ balance: 2n * 10n ** 15n, gasPrice: PRICE, estimate: 1333334 });
    const err = await sendOneTime(node.contract, 'cancelOrder', ['0xorder']).catch((e) => e);
    expect(isShortOfGasError(err)).toBe(true);
    expect(err.cost).toBe(1600001n * PRICE);
    expect(err.missing).toBe(1600001n * PRICE - 2n * 10n ** 15n);
    expect(err.message).toMatch(/holds 0\.002 ETH and this transaction needs up to 0\.0024 ETH \(a gas limit of 1600001 at the current gas price\): 0\.0004 ETH is missing\. Nothing was sent\./);
    expect(sendErrorText(err)).toBe(err.message);
    expect(node.sent).toHaveLength(0);
  });

  it('does not ask for an estimate when the address cannot even pay the value', async () => {
    const node = oneTime({ balance: 5n, gasPrice: PRICE, estimate: 500000 });
    const err = await sendOneTime(node.contract, 'cancelOrder', [], { value: '9' }).catch((e) => e);
    expect(isShortOfGasError(err)).toBe(true);
    expect(err.missing).toBe(4n);
    expect(err.message).toMatch(/the amount sent with it, before any gas/);
    expect(node.estimates).toHaveLength(0);
  });

  it('sends nothing when the node cannot estimate the call', async () => {
    const reverted = oneTime({ balance: 10n ** 18n, gasPrice: PRICE, estimate: new Error('cannot estimate gas; reason="execution reverted: This caller is unauthorized"') });
    const err = await sendOneTime(reverted.contract, 'cancelOrder', ['0xorder']).catch((e) => e);
    expect(isEstimateError(err)).toBe(true);
    expect(isShortOfGasError(err)).toBe(false);
    expect(sendErrorText(err)).toBe('This account is not allowed to do this on this order. Nothing was sent.');
    expect(reverted.sent).toHaveLength(0);

    const silent = oneTime({ balance: 10n ** 18n, gasPrice: PRICE, estimate: new Error('timeout') });
    const down = await sendOneTime(silent.contract, 'cancelOrder', ['0xorder']).catch((e) => e);
    expect(isEstimateError(down)).toBe(true);
    expect(sendErrorText(down)).toBe('Transaction failed: timeout Nothing was sent.');
    expect(silent.sent).toHaveLength(0);
  });
});

describe('amounts shown to the person', () => {
  it('are in ETH with up to six decimals, and never 0 for an amount that is not', () => {
    expect(formatEth(0)).toBe('0 ETH');
    expect(formatEth(10n ** 18n)).toBe('1 ETH');
    expect(formatEth('2400000000000000')).toBe('0.0024 ETH');
    expect(formatEth(1234567890123456789n)).toBe('1.234567 ETH');
    expect(formatEth(2400016000000n)).toBe('0.000002 ETH');
    expect(formatEth(1000016n)).toBe('0.000000000001 ETH');
    expect(upfrontCost(10, 3, 2, 5)).toEqual({ cost: 11n, missing: 1n });
    expect(upfrontCost(11, 3, 2, 5)).toEqual({ cost: 11n, missing: 0n });
  });
});
