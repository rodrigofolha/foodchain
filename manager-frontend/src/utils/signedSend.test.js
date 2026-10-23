import { ethers } from 'ethers';
import { sendRecorded, wasRefusedByNode } from './signedSend';

const REPUTATION = '0x00000000000000000000000000000000000000f1';
const ABI = ['function depositPayment(uint256 _commitment) payable'];

// A stand-in for the node: it knows the account's nonce and takes, refuses or loses a transaction
function fakeProvider(behaviour) {
  const provider = {
    _isProvider: true,
    received: [],
    getNetwork: async () => ({ chainId: 31337, name: 'local' }),
    getTransactionCount: async () => 4,
    // a network without EIP-1559 fees: the gas price given is used as it is
    getFeeData: async () => ({ gasPrice: ethers.BigNumber.from(1000000000), maxFeePerGas: null, maxPriorityFeePerGas: null }),
    resolveName: async (name) => name,
    sendTransaction: async (signed) => {
      provider.received.push(signed);
      if (behaviour) throw behaviour;
      return { hash: ethers.utils.keccak256(signed), wait: async () => ({ status: 1 }) };
    },
  };
  return provider;
}

function setup(behaviour) {
  const provider = fakeProvider(behaviour);
  // a throwaway key, made for this run only
  const wallet = ethers.Wallet.createRandom().connect(provider);
  const contract = new ethers.Contract(REPUTATION, ABI, wallet);
  return { provider, wallet, contract };
}

const OVERRIDES = { gasLimit: 300000, gasPrice: 1000000000, value: 5 };

describe('sendRecorded', () => {
  it('reports the hash, nonce and sender before the transaction is broadcast, and broadcasts that transaction', async () => {
    const { provider, wallet, contract } = setup(null);
    const order = [];
    let recorded = null;
    const response = await sendRecorded(ethers, wallet, contract, 'depositPayment', ['77'], OVERRIDES, (sentAs) => {
      order.push('recorded with ' + provider.received.length + ' broadcast');
      recorded = sentAs;
    });
    expect(order).toEqual(['recorded with 0 broadcast']);
    expect(provider.received).toHaveLength(1);

    const parsed = ethers.utils.parseTransaction(provider.received[0]);
    expect(recorded).toEqual({ txHash: parsed.hash, nonce: 4, from: wallet.address, rawTx: provider.received[0] });
    expect(response.hash).toBe(parsed.hash);
    expect(parsed.from).toBe(wallet.address);
    expect(parsed.to.toLowerCase()).toBe(REPUTATION);
    expect(parsed.nonce).toBe(4);
    expect(parsed.gasLimit.toString()).toBe('300000');
    expect(parsed.gasPrice.toString()).toBe('1000000000');
    expect(parsed.value.toString()).toBe('5');
    expect(parsed.data).toBe(contract.interface.encodeFunctionData('depositPayment', ['77']));
  });

  it('does not broadcast when the record could not be kept', async () => {
    const { provider, wallet, contract } = setup(null);
    await expect(sendRecorded(ethers, wallet, contract, 'depositPayment', ['77'], OVERRIDES, () => { throw new Error('storage full'); }))
      .rejects.toThrow('storage full');
    expect(provider.received).toEqual([]);
  });

  it('marks a transaction the node refused as not sent', async () => {
    const refused = Object.assign(new Error('insufficient funds for gas * price + value'), { code: -32000 });
    const { wallet, contract } = setup(refused);
    const error = await sendRecorded(ethers, wallet, contract, 'depositPayment', ['77'], OVERRIDES, () => {}).catch((e) => e);
    expect(error).toBe(refused);
    expect(error.notSent).toBe(true);
  });

  it('does not say "not sent" after a connection error: the transaction may have arrived', async () => {
    const lost = Object.assign(new Error('timeout'), { code: 'TIMEOUT' });
    const { wallet, contract } = setup(lost);
    const error = await sendRecorded(ethers, wallet, contract, 'depositPayment', ['77'], OVERRIDES, () => {}).catch((e) => e);
    expect(error.notSent).toBe(false);
  });
});

describe('wasRefusedByNode', () => {
  it('takes a JSON-RPC error and the refusals ethers names as refused', () => {
    expect(wasRefusedByNode({ code: -32000, message: 'nonce too low' })).toBe(true);
    expect(wasRefusedByNode({ code: 'INSUFFICIENT_FUNDS', message: 'insufficient funds' })).toBe(true);
    expect(wasRefusedByNode({ code: 'NONCE_EXPIRED', message: 'nonce has already been used' })).toBe(true);
  });

  it('takes "already known" and connection errors as possibly sent', () => {
    expect(wasRefusedByNode({ code: -32000, message: 'already known' })).toBe(false);
    expect(wasRefusedByNode({ code: 'SERVER_ERROR', message: 'bad response', error: { message: 'already known' } })).toBe(false);
    expect(wasRefusedByNode({ code: 'NETWORK_ERROR', message: 'could not detect network' })).toBe(false);
    expect(wasRefusedByNode({ code: 'SERVER_ERROR', message: 'missing response' })).toBe(false);
    expect(wasRefusedByNode(new Error('anything'))).toBe(false);
    expect(wasRefusedByNode(null)).toBe(false);
  });
});
