import React from 'react';
import { render, fireEvent, wait } from '@testing-library/react';
import PastOrder, { CANCEL_GAS_NOTE } from './index';
import { useWeb3 } from '../../services/getWeb3';
import { REPUTATION_ADDRESS, STORAGE_ADDRESS } from '../../services/config';
import { INFORMATION_TOPIC, uintTopic } from '../../utils/orderWorkers';
import { setDeployment, deploymentKey } from '../../utils/deploymentStorage';
import { pickupKeyFor, openDetails } from '../../utils/pickupSeal';

jest.mock('../../services/getWeb3');

const CUSTOMER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const STEALTH = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const WORKER_1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const WORKER_2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const ZERO = '0x0000000000000000000000000000000000000000';
const ORDER = '0x00000000000000000000000000000000000000A1';

// Chain.getOrder as the customer sees it (11 fields)
function orderBlock(status, worker) {
  return { 0: '7', 1: '0x7b7d', 2: '5000000000000000', 3: status, 4: STEALTH, 5: '0', 6: '1760000000', 7: '1760000100', 8: worker, 9: '0', 10: '0' };
}

// Stand-ins for the contracts. `ratings` maps a worker to the answer of
// orderRatings; every call and transaction is noted in `trace`.
function fakeWeb3(ratings, trace, informationLogs) {
  const orderRatings = (order, worker) => ({
    call: async () => { trace.push(['orderRatings', order, worker]); return ratings[worker] || { 0: '0', 1: '0', 2: '0' }; },
  });
  const reader = {
    eth: {
      Contract: function (abi, address) {
        trace.push(['reader contract', address]);
        this.methods = { orderRatings: orderRatings };
      },
      getPastLogs: async (filter) => { trace.push(['getPastLogs', filter]); return informationLogs || []; },
    },
  };
  return {
    web3: reader,
    logWeb3: reader,
    chain: {
      methods: {
        findAddress: (id) => ({ call: async () => { trace.push(['findAddress', id]); return ORDER; } }),
        rateOrder: (...args) => ({
          estimateGas: async (options) => { trace.push(['estimate rateOrder', options]); return 60000; },
          send: async (options) => { trace.push(['rateOrder', args, options.from]); trace.push(['rateOrder gas', options.gas]); return {}; },
        }),
      },
    },
    storage: { methods: {} },
    reputation: { methods: { orderRatings: orderRatings } },
  };
}

// The wallet: a local chain. The browser's records are kept for that chain and
// this app's Chain contract.
const CHAIN_ID = '0x7a69';
function wallet(more) {
  return {
    request: async ({ method, params }) => {
      if (method === 'eth_chainId') return CHAIN_ID;
      if (more && method in more) return more[method](params);
      return [CUSTOMER];
    },
  };
}

beforeEach(() => {
  window.ethereum = wallet();
  window.alert = jest.fn();
  setDeployment(CHAIN_ID);
});

afterEach(() => {
  delete window.ethereum;
  localStorage.clear();
});

describe('PastOrder: rating', () => {
  it('rates the worker who delivered with one call to Chain.rateOrder(order, worker, score)', async () => {
    const trace = [];
    const ratings = { [WORKER_1]: { 0: '3', 1: '0', 2: '0' } };
    useWeb3.mockReturnValue(fakeWeb3(ratings, trace));
    const commitments = [{ worker: WORKER_1, position: 1, blockNumber: 12 }];
    const { container, getByLabelText } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('CONCLUDED', WORKER_1)} orderAddress={ORDER} commitments={commitments} />
    );
    await wait(() => expect(container.textContent).toContain(WORKER_1 + ' delivered this order.'));
    expect(trace).toContainEqual(['reader contract', REPUTATION_ADDRESS]);
    expect(trace).toContainEqual(['orderRatings', ORDER, WORKER_1]);
    expect(container.textContent).not.toMatch(/anonym/i);
    expect(container.textContent).not.toContain('Rating Token');

    fireEvent.click(getByLabelText('5 of 5'));
    await wait(() => expect(container.textContent).toContain('You rated them ★★★★★ (5 of 5).'));
    const sent = trace.filter(entry => entry[0] === 'rateOrder');
    expect(sent).toEqual([['rateOrder', [ORDER, WORKER_1, 5], CUSTOMER]]);
    // the gas limit is the estimate (60000, asked for the same sender) with the margin
    expect(trace).toContainEqual(['estimate rateOrder', { from: CUSTOMER }]);
    expect(trace).toContainEqual(['rateOrder gas', 75000]);
    expect(trace).toContainEqual(['findAddress', '7']);
    expect(window.alert).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[aria-label$="of 5"]')).toHaveLength(0);
  });

  it('prints a message, not the error object, when the rating fails', async () => {
    const trace = [];
    const ratings = { [WORKER_1]: { 0: '3', 1: '0', 2: '0' } };
    const fake = fakeWeb3(ratings, trace);
    const failure = Object.assign(new Error('MetaMask Tx Signature: User denied transaction signature.'), { data: { from: CUSTOMER } });
    fake.chain.methods.rateOrder = () => ({ estimateGas: async () => 60000, send: async () => { throw failure; } });
    useWeb3.mockReturnValue(fake);
    const written = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args) => { written.push(args); });
    const { container, getByLabelText } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('CONCLUDED', WORKER_1)} orderAddress={ORDER} commitments={[]} />
    );
    await wait(() => expect(container.textContent).toContain('Rate them:'));
    fireEvent.click(getByLabelText('5 of 5'));
    await wait(() => expect(window.alert).toHaveBeenCalledWith('Transaction was rejected in MetaMask.'));
    spy.mockRestore();
    const line = written.filter(args => args[0] === 'Rating submission failed:');
    expect(line).toEqual([['Rating submission failed:', 'Transaction was rejected in MetaMask.']]);
  });

  it('sends nothing when the chain says the worker was already rated', async () => {
    const trace = [];
    const ratings = { [WORKER_1]: { 0: '3', 1: '0', 2: '0' } };
    useWeb3.mockReturnValue(fakeWeb3(ratings, trace));
    const { container, getByLabelText } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('CONCLUDED', WORKER_1)} orderAddress={ORDER} commitments={[]} />
    );
    await wait(() => expect(container.textContent).toContain('Rate them:'));
    // rated from another tab since the page loaded
    ratings[WORKER_1] = { 0: '3', 1: '2', 2: '0' };
    fireEvent.click(getByLabelText('5 of 5'));
    await wait(() => expect(window.alert).toHaveBeenCalledWith('You have already rated this delivery worker on this order.'));
    expect(trace.filter(entry => entry[0] === 'rateOrder')).toEqual([]);
    await wait(() => expect(container.textContent).toContain('You rated them ★★ (2 of 5).'));
  });

  it('shows both workers of a canceled order: only the one who left after pickup can be rated', async () => {
    const trace = [];
    const ratings = { [WORKER_1]: { 0: '1', 1: '0', 2: '4' }, [WORKER_2]: { 0: '2', 1: '0', 2: '0' } };
    useWeb3.mockReturnValue(fakeWeb3(ratings, trace));
    const commitments = [{ worker: WORKER_1, position: 1, blockNumber: 12 }, { worker: WORKER_2, position: 2, blockNumber: 15 }];
    const { container, getByLabelText } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('CANCELED BY SECOND DELIVERYMAN', ZERO)} orderAddress={ORDER} commitments={commitments} />
    );
    await wait(() => expect(container.textContent).toContain(WORKER_2 + ' left this order after pickup.'));
    expect(container.textContent).toContain(WORKER_1 + ' left this order before pickup.');
    expect(container.textContent).toContain('Only the establishment can rate a worker who left before pickup.');
    expect(container.querySelectorAll('[aria-label$="of 5"]')).toHaveLength(5);
    fireEvent.click(getByLabelText('1 of 5'));
    await wait(() => expect(trace.filter(entry => entry[0] === 'rateOrder')).toEqual([['rateOrder', [ORDER, WORKER_2, 1], CUSTOMER]]));
  });

  it('reads no rating for an order nobody accepted yet', async () => {
    const trace = [];
    useWeb3.mockReturnValue(fakeWeb3({}, trace));
    const { container } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('ORDERED', ZERO)} orderAddress={ORDER} commitments={[]} />
    );
    await wait(() => expect(container.textContent).toContain('Status: ORDERED'));
    expect(trace).toEqual([]);
  });
});

describe('PastOrder: a reopened order', () => {
  it('says that the worker left and that the order is offered again', async () => {
    const trace = [];
    useWeb3.mockReturnValue(fakeWeb3({ [WORKER_1]: { 0: '1', 1: '0', 2: '0' } }, trace));
    const commitments = [{ worker: WORKER_1, position: 1, blockNumber: 12 }];
    const { container } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('PREPARATION', ZERO)} orderAddress={ORDER} commitments={commitments} />
    );
    expect(container.textContent).toContain('The order is offered again and your payment stays in it.');
    await wait(() => expect(container.textContent).toContain(WORKER_1 + ' left this order before pickup.'));
    expect(container.querySelectorAll('[aria-label$="of 5"]')).toHaveLength(0);
    // no "Send my address" while nobody is committed
    expect(container.textContent).not.toContain('Send my address');
    expect(trace.filter(entry => entry[0] === 'getPastLogs')).toEqual([]);
  });

  it('asks for the address again when a second worker committed and nothing was sent to them', async () => {
    const trace = [];
    useWeb3.mockReturnValue(fakeWeb3({}, trace, []));
    const commitments = [{ worker: WORKER_1, position: 1, blockNumber: 12 }, { worker: WORKER_2, position: 2, blockNumber: 15 }];
    const { container } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('WAITING', WORKER_2)} orderAddress={ORDER} commitments={commitments} />
    );
    await wait(() => expect(container.textContent).toContain('Send your address again.'));
    expect(container.textContent).toContain('A second delivery worker committed to this order after the first one left.');
    expect(container.textContent).toContain('Send my address');
    const queries = trace.filter(entry => entry[0] === 'getPastLogs');
    expect(queries).toHaveLength(1);
    expect(queries[0][1].address).toBe(STORAGE_ADDRESS);
    expect(queries[0][1].topics).toEqual([INFORMATION_TOPIC, uintTopic(7), uintTopic(2)]);
  });

  it('says so when the address was already sent to the second worker', async () => {
    const trace = [];
    useWeb3.mockReturnValue(fakeWeb3({}, trace, [{ address: STORAGE_ADDRESS }]));
    const commitments = [{ worker: WORKER_1, position: 1, blockNumber: 12 }, { worker: WORKER_2, position: 2, blockNumber: 15 }];
    const { container } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('WAITING', WORKER_2)} orderAddress={ORDER} commitments={commitments} />
    );
    await wait(() => expect(container.textContent).toContain('Your address was sent to them.'));
  });
});

describe('PastOrder: "Send my address"', () => {
  const commitments = [{ worker: WORKER_1, position: 1, blockNumber: 12 }];

  it('says what is missing instead of doing nothing', async () => {
    const trace = [];
    useWeb3.mockReturnValue(fakeWeb3({}, trace, []));
    window.ethereum = wallet({ eth_decrypt: () => JSON.stringify([{ name: 'Tea', quantity: 1, price: 2 }]) });
    const { container, getByText, getByPlaceholderText } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('WAITING', WORKER_1)} orderAddress={ORDER} commitments={commitments} />
    );

    // the items were not opened
    fireEvent.click(getByText('Send my address'));
    await wait(() => expect(window.alert).toHaveBeenCalledTimes(1));
    expect(window.alert.mock.calls[0][0]).toMatch(/Nothing was sent\. Press "More details" first/);

    // the items are open, the address field is empty, then only spaces
    fireEvent.click(getByText('More details'));
    await wait(() => expect(container.textContent).toContain('Tea'));
    fireEvent.click(getByText('Send my address'));
    await wait(() => expect(window.alert).toHaveBeenCalledTimes(2));
    expect(window.alert.mock.calls[1][0]).toMatch(/Nothing was sent\. Type your name and delivery address/);
    fireEvent.change(getByPlaceholderText('Your name and delivery address'), { target: { value: '   ' } });
    fireEvent.click(getByText('Send my address'));
    await wait(() => expect(window.alert).toHaveBeenCalledTimes(3));
    expect(window.alert.mock.calls[2][0]).toMatch(/Type your name and delivery address/);

    // nothing was read from the chain or sent for these three clicks
    expect(trace.filter(entry => entry[0] === 'findAddress')).toEqual([]);
    expect(container.textContent).toContain('Send my address');
  });

  it('says when the worker can open the address, for an order this browser can seal', async () => {
    const trace = [];
    useWeb3.mockReturnValue(fakeWeb3({}, trace, []));
    localStorage.setItem(deploymentKey('orderSecrets'), JSON.stringify({ 7: { pickupSecret: '8OHSw7Sllod4aVpLPC0eDw', orderAddress: ORDER } }));
    const { container } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('WAITING', WORKER_1)} orderAddress={ORDER} commitments={commitments} />
    );
    await wait(() => expect(container.textContent).toContain('only after the establishment has recorded the pickup of your order'));
  });

  it('does not say it for an order without a pickup secret here, or after pickup', async () => {
    const trace = [];
    useWeb3.mockReturnValue(fakeWeb3({}, trace, []));
    const first = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('WAITING', WORKER_1)} orderAddress={ORDER} commitments={commitments} />
    );
    await wait(() => expect(first.container.textContent).toContain('Status: WAITING'));
    expect(first.container.textContent).not.toContain('recorded the pickup');
    first.unmount();

    localStorage.setItem(deploymentKey('orderSecrets'), JSON.stringify({ 7: { pickupSecret: '8OHSw7Sllod4aVpLPC0eDw', orderAddress: ORDER } }));
    const second = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('DISPATCHED', WORKER_1)} orderAddress={ORDER} commitments={commitments} />
    );
    await wait(() => expect(second.container.textContent).toContain('Status: DISPATCHED'));
    expect(second.container.textContent).not.toContain('recorded the pickup');
  });
});

describe('PastOrder: cancelling', () => {
  const commitments = [{ worker: WORKER_1, position: 1, blockNumber: 12 }];
  const DENIED = Object.assign(new Error('MetaMask Tx Signature: User denied transaction signature.'), { code: 4001 });

  // cancelOrder of Chain: `estimate` and `send` say what the node and the wallet answer
  function withCancel(fake, trace, estimate, send) {
    fake.chain.methods.cancelOrder = (order) => ({
      estimateGas: async (options) => { trace.push(['estimate cancelOrder', order, options]); return estimate(); },
      send: async (options) => { trace.push(['cancelOrder', order, options]); return send(); },
    });
    return fake;
  }

  it('says near the button that the cancellation costs more gas, once the establishment accepted', () => {
    useWeb3.mockReturnValue(fakeWeb3({}, [], []));
    ['PREPARATION', 'WAITING', 'DISPATCHED'].forEach((status) => {
      const { container, unmount } = render(
        <PastOrder restaurant={{}} orderBlock={orderBlock(status, status === 'PREPARATION' ? ZERO : WORKER_1)} orderAddress={ORDER} commitments={commitments} />
      );
      expect(container.textContent).toContain(CANCEL_GAS_NOTE);
      unmount();
    });
    expect(CANCEL_GAS_NOTE).toMatch(/returns the establishment's money to the payment pool/);
    expect(CANCEL_GAS_NOTE).toMatch(/more gas than the other steps/);
    // in ORDERED nothing was paid by the establishment yet; an ended order has no button
    ['ORDERED', 'CONCLUDED', 'CANCELED BY CLIENT'].forEach((status) => {
      const { container, unmount } = render(
        <PastOrder restaurant={{}} orderBlock={orderBlock(status, ZERO)} orderAddress={ORDER} commitments={[]} />
      );
      expect(container.textContent).not.toContain('payment pool');
      unmount();
    });
  });

  it('sends the cancellation with the estimate and its margin, never a fixed limit', async () => {
    const trace = [];
    useWeb3.mockReturnValue(withCancel(fakeWeb3({}, trace, []), trace, () => 1234567, () => ({})));
    const { getByText } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('PREPARATION', ZERO)} orderAddress={ORDER} commitments={[]} />
    );
    fireEvent.click(getByText('Cancel my order'));
    await wait(() => expect(trace.filter(entry => entry[0] === 'cancelOrder')).toHaveLength(1));
    expect(trace).toContainEqual(['estimate cancelOrder', ORDER, { from: CUSTOMER }]);
    expect(trace).toContainEqual(['cancelOrder', ORDER, { from: CUSTOMER, gas: 1543209 }]);
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('takes the spinner away and says why when the request is rejected in the wallet', async () => {
    const trace = [];
    useWeb3.mockReturnValue(withCancel(fakeWeb3({}, trace, []), trace, () => 100000, () => { throw DENIED; }));
    const errors = [];
    const logs = [];
    const errorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args); });
    const logSpy = jest.spyOn(console, 'log').mockImplementation((...args) => { logs.push(args); });
    const { container, getByText } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('PREPARATION', ZERO)} orderAddress={ORDER} commitments={[]} />
    );
    fireEvent.click(getByText('Cancel my order'));
    await wait(() => expect(window.alert).toHaveBeenCalledWith('Transaction was rejected in MetaMask.'));
    // the card is back, with its button
    await wait(() => expect(container.textContent).toContain('Cancel my order'));
    errorSpy.mockRestore();
    logSpy.mockRestore();
    expect(errors).toEqual([['Cancelling the order failed:', 'Transaction was rejected in MetaMask.']]);
    // neither the order's address nor a receipt is printed
    expect(logs).toEqual([]);
  });

  it('sends nothing and shows the contract\'s reason when the estimate says the call would fail', async () => {
    const trace = [];
    const revert = new Error("VM Exception while processing transaction: reverted with reason string 'Function cannot be called at this step'");
    useWeb3.mockReturnValue(withCancel(fakeWeb3({}, trace, []), trace, () => { throw revert; }, () => ({})));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { container, getByText } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('ORDERED', ZERO)} orderAddress={ORDER} commitments={[]} />
    );
    fireEvent.click(getByText('Cancel my order by time (free of charge)'));
    await wait(() => expect(window.alert).toHaveBeenCalledWith('The order is not at the step this action needs. Reload the page and try again.'));
    spy.mockRestore();
    expect(trace.filter(entry => entry[0] === 'cancelOrder')).toEqual([]);
    await wait(() => expect(container.textContent).toContain('Cancel my order by time'));
  });
});

describe('PastOrder: "More details"', () => {
  it('shows and prints a fixed text for an error that is not of the wallet or of a contract', async () => {
    useWeb3.mockReturnValue(fakeWeb3({}, [], []));
    window.ethereum = wallet({ eth_decrypt: () => { throw new Error('bad payload: 2 x Tea, Rua das Flores 12'); } });
    const written = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args) => { written.push(args); });
    const { getByText } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('PREPARATION', ZERO)} orderAddress={ORDER} commitments={[]} />
    );
    fireEvent.click(getByText('More details'));
    await wait(() => expect(window.alert).toHaveBeenCalledWith('The details of this order could not be opened.'));
    spy.mockRestore();
    expect(written).toEqual([['Could not open the order details:', 'The details of this order could not be opened.']]);
  });

  it('names a wallet refusal', async () => {
    useWeb3.mockReturnValue(fakeWeb3({}, [], []));
    window.ethereum = wallet({ eth_decrypt: () => { throw Object.assign(new Error('MetaMask Decryption: User denied message decryption.'), { code: 4001 }); } });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { getByText } = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('PREPARATION', ZERO)} orderAddress={ORDER} commitments={[]} />
    );
    fireEvent.click(getByText('More details'));
    await wait(() => expect(window.alert).toHaveBeenCalledWith('Transaction was rejected in MetaMask.'));
    spy.mockRestore();
  });
});

describe('PastOrder: sending the address', () => {
  const sigUtil = require('eth-sig-util');
  const { ethers } = require('ethers');
  const commitments = [{ worker: WORKER_1, position: 1, blockNumber: 12 }];
  const WORKER_KEY = '11'.repeat(32);
  const K = '8OHSw7Sllod4aVpLPC0eDw';
  const ITEMS = [{ name: 'Tea', quantity: 1, price: 2 }];

  // The contracts as addAddress reads them: the order is WAITING with WORKER_1,
  // whose encryption key is in Storage. `send` is what the wallet answers.
  function withDetails(fake, trace, send) {
    const publicKey = sigUtil.getEncryptionPublicKey(WORKER_KEY);
    fake.chain.methods.getOrder = () => ({ call: async () => orderBlock('WAITING', WORKER_1) });
    fake.storage.methods.getDeliveryman = () => ({
      call: async () => [ethers.utils.formatBytes32String(publicKey.substring(0, 31)), ethers.utils.formatBytes32String(publicKey.substring(31))],
    });
    fake.storage.methods.addInformation = (...args) => ({
      estimateGas: async () => 80000,
      send: async (options) => { trace.push(['addInformation', args, options]); return send(); },
    });
    return fake;
  }

  async function typeAndSend(utils) {
    fireEvent.click(utils.getByText('More details'));
    await wait(() => expect(utils.container.textContent).toContain('Tea'));
    fireEvent.change(utils.getByPlaceholderText('Your name and delivery address'), { target: { value: 'Ana, Rua A, 1' } });
    fireEvent.click(utils.getByText('Send my address'));
  }

  beforeEach(() => {
    window.ethereum = wallet({ eth_decrypt: () => JSON.stringify(ITEMS) });
    window.confirm = jest.fn(() => false);
  });

  it('seals the details with the pickup secret kept for this deployment and sends them with the estimated gas', async () => {
    const trace = [];
    useWeb3.mockReturnValue(withDetails(fakeWeb3({}, trace, []), trace, () => ({})));
    localStorage.setItem(deploymentKey('orderSecrets'), JSON.stringify({ 7: { pickupSecret: K, orderAddress: ORDER } }));
    const utils = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('WAITING', WORKER_1)} orderAddress={ORDER} commitments={commitments} />
    );
    await typeAndSend(utils);
    await wait(() => expect(trace.filter(entry => entry[0] === 'addInformation')).toHaveLength(1));
    const sent = trace.find(entry => entry[0] === 'addInformation');
    expect(sent[2]).toEqual({ from: CUSTOMER, gas: 100000 });
    // sealed for the pickup key of this worker: the worker's wallet opens only `s`
    const first = JSON.parse(sigUtil.decrypt(JSON.parse(Buffer.from(sent[1][1].slice(2), 'hex').toString('utf8')), WORKER_KEY));
    expect(openDetails(pickupKeyFor(K, '7', WORKER_1), first.s, sent[1][2]))
      .toEqual({ deliveryAddress: 'Ana, Rua A, 1', items: ITEMS });
    expect(window.confirm).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('does not use a pickup secret kept under the old name or for another deployment', async () => {
    const trace = [];
    useWeb3.mockReturnValue(withDetails(fakeWeb3({}, trace, []), trace, () => ({})));
    // before the records were kept per deployment
    localStorage.setItem('orderSecrets', JSON.stringify({ 7: { pickupSecret: K } }));
    // the same order number on another chain, and under another Chain contract
    setDeployment(11155111);
    localStorage.setItem(deploymentKey('orderSecrets'), JSON.stringify({ 7: { pickupSecret: K } }));
    setDeployment(CHAIN_ID, '0x00000000000000000000000000000000000000C1');
    localStorage.setItem(deploymentKey('orderSecrets'), JSON.stringify({ 7: { pickupSecret: K } }));
    setDeployment(CHAIN_ID);
    const utils = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('WAITING', WORKER_1)} orderAddress={ORDER} commitments={commitments} />
    );
    expect(utils.container.textContent).not.toContain('recorded the pickup');
    await typeAndSend(utils);
    // no secret for this order here: the customer is asked before the older format is used
    await wait(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    expect(trace.filter(entry => entry[0] === 'addInformation')).toEqual([]);
    expect(JSON.parse(localStorage.getItem('orderSecrets'))).toEqual({ 7: { pickupSecret: K } });
  });

  it('takes the spinner away and says why when the transaction is rejected', async () => {
    const trace = [];
    const denied = Object.assign(new Error('MetaMask Tx Signature: User denied transaction signature.'), { code: 4001 });
    useWeb3.mockReturnValue(withDetails(fakeWeb3({}, trace, []), trace, () => { throw denied; }));
    localStorage.setItem(deploymentKey('orderSecrets'), JSON.stringify({ 7: { pickupSecret: K, orderAddress: ORDER } }));
    const written = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args) => { written.push(args); });
    const utils = render(
      <PastOrder restaurant={{}} orderBlock={orderBlock('WAITING', WORKER_1)} orderAddress={ORDER} commitments={commitments} />
    );
    await typeAndSend(utils);
    await wait(() => expect(window.alert).toHaveBeenCalledWith('Transaction was rejected in MetaMask.'));
    await wait(() => expect(utils.container.textContent).toContain('Send my address'));
    spy.mockRestore();
    expect(written).toEqual([['Sending the delivery details failed:', 'Transaction was rejected in MetaMask.']]);
  });
});
