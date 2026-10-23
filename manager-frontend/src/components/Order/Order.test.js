import React from 'react';
import { render, screen, fireEvent, wait } from '@testing-library/react';
import Web3 from 'web3';

import OrderCard from './index';
import { currentPickupKey } from '../../utils/pickupKeyDisplay';
import { ORDER_ACTORS_TOPIC } from '../../utils/orderRatings';
import { REPUTATION_ADDRESS, CHAIN_ABI } from '../../services/config';
import { deploymentKey } from '../../utils/deploymentStorage';

// The camera is not used here: the confirmation is pasted.
jest.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { QR_CODE: 0 },
  Html5Qrcode: class {
    start() { return Promise.resolve(null); }
    stop() { return Promise.resolve(); }
    clear() {}
  },
}));

// Throwaway keys, made for this run only.
const web3 = new Web3();
const worker = web3.eth.accounts.create();
const otherWorker = web3.eth.accounts.create();
// What the card gets: the real signature recovery, and no network. The reputation
// contract answers from `records` and `ratings`, the log provider from `actorLogs`.
let records;
let ratings;
let actorLogs;
let logFilters;
const NOTHING = { outcome: '0', byClient: '0', byEstablishment: '0' };
const cardWeb3 = {
  eth: {
    accounts: web3.eth.accounts,
    Contract: function () {
      this.methods = {
        workers: (address) => ({ call: () => (records[address.toLowerCase()] ? Promise.resolve(records[address.toLowerCase()]) : new Promise(() => {})) }),
        orderRatings: (order, address) => ({ call: () => Promise.resolve(ratings[address.toLowerCase()] || NOTHING) }),
        reputationContract: () => ({ call: () => Promise.resolve(REPUTATION_ADDRESS) }),
      };
    },
    getPastLogs: (filter) => { logFilters.push(filter); return Promise.resolve(actorLogs); },
    getBlock: () => Promise.resolve({ timestamp: latestBlockTime }),
  },
};

const K = 'AAECAwQFBgcICQoLDA0ODw';
const ITEMS = [{ name: 'Pão de queijo', quantity: 2, price: 7 }];
const ORDER_ADDRESSES = { 7: '0x00000000000000000000000000000000000000aa', 8: '0x00000000000000000000000000000000000000bb' };
const ESTABLISHMENT = '0x00000000000000000000000000000000000000cc';

// Same bytes as Order.handoverDigest (the last field is the number of commitments so far)
const digestOf = (orderAddress, action, workerAddress) => web3.utils.soliditySha3(
  { t: 'string', v: 'DeliveryChain handover' }, { t: 'uint256', v: 31337 },
  { t: 'address', v: orderAddress }, { t: 'uint8', v: action }, { t: 'address', v: workerAddress },
  { t: 'uint256', v: 1 });
const confirmationOf = (orderId, account) =>
  web3.eth.accounts.sign(digestOf(ORDER_ADDRESSES[orderId], 1, account.address), account.privateKey).signature;

let sent;
let calls;
let estimated;
let estimates;
let pickupOptions;
let chainDown;
let alerts;
// What the chain answers to getOrder: the order as the card got it (`shown`), unless a
// test says that the chain has moved on since (`chainSays`) or cannot be read
let shown;
let chainSays;
let orderReads;
let orderDown;
let latestBlockTime;
const ZERO = '0x0000000000000000000000000000000000000000';
// Records a transaction of the establishment with its arguments, as the fallback
// (no one-time key in this browser) sends it
const records_call = (name) => (...args) => ({
  // the node's estimate for the call: `estimates` can make it fail, as for a call that would revert
  estimateGas: (options) => {
    estimated.push({ name: name, options: options });
    return estimates[name] instanceof Error ? Promise.reject(estimates[name]) : Promise.resolve(estimates[name] || 100000);
  },
  send: (options) => { calls.push({ name: name, args: args, options: options }); return Promise.resolve({}); },
});
// The log an order emits at each commitment
const topicOf = (address) => '0x' + '0'.repeat(24) + address.slice(2).toLowerCase();
const commitment = (orderId, workerAddress, blockNumber) => ({
  address: ORDER_ADDRESSES[orderId], blockNumber: blockNumber, logIndex: 0,
  topics: [ORDER_ACTORS_TOPIC, topicOf(ESTABLISHMENT), topicOf(ESTABLISHMENT), topicOf(workerAddress)],
  data: '0x' + '0'.repeat(24) + ORDER_ADDRESSES[orderId].slice(2),
});
const chain = {
  options: { jsonInterface: [] },
  methods: {
    findAddress: (orderId) => ({
      call: () => (chainDown ? Promise.reject(new Error('network')) : Promise.resolve(ORDER_ADDRESSES[orderId])),
    }),
    handoverDigest: (orderAddress, action, workerAddress) => ({
      call: () => Promise.resolve(digestOf(orderAddress, action, workerAddress)),
    }),
    getOrder: (orderAddress) => ({
      call: (options) => {
        orderReads.push({ orderAddress: orderAddress, from: options && options.from });
        if (chainDown || orderDown) return Promise.reject(new Error('network'));
        return Promise.resolve(chainSays || shown);
      },
    }),
    // as on the chain: once the pickup is mined, the order is DISPATCHED for the same worker
    pickupOrder: (orderAddress, signature) => ({
      estimateGas: () => Promise.resolve(165000),
      send: (options) => {
        pickupOptions = options;
        sent.push([orderAddress, signature]);
        chainSays = orderBlock('DISPATCHED', { id: shown[0], committed: shown[8] });
        return Promise.resolve({});
      },
    }),
    cancelOrder: records_call('cancelOrder'),
    prepareOrder: records_call('prepareOrder'),
    rateOrder: records_call('rateOrder'),
    callSecondDeliveryman: records_call('callSecondDeliveryman'),
  },
};

// The items are given in clear (as for an order that is not encrypted), so no
// wallet decryption is involved.
function orderBlock(status, { id = '7', committed = worker.address, legacy = false } = {}) {
  const order = legacy ? JSON.stringify(ITEMS) : JSON.stringify({ items: ITEMS, k: K });
  return [id, order, '1000000000000000', status, ESTABLISHMENT, '0', '1760000000', '1760000100', committed, '0', '0'];
}

function card(block) {
  shown = block;
  return <OrderCard web3={cardWeb3} logWeb3={cardWeb3} chain={chain} orderBlock={block} total={0} />;
}

const keyField = () => screen.queryByLabelText('Pickup key');
const paste = (text) => fireEvent.change(screen.getByPlaceholderText("Worker's pickup confirmation"), { target: { value: text } });

beforeEach(() => {
  localStorage.clear();
  sent = [];
  calls = [];
  estimated = [];
  estimates = {};
  pickupOptions = null;
  records = {};
  ratings = {};
  actorLogs = [];
  logFilters = [];
  chainDown = false;
  orderDown = false;
  shown = null;
  chainSays = null;
  orderReads = [];
  latestBlockTime = 1760000100 + 7200;
  alerts = [];
  window.alert = (text) => { alerts.push(text); };
  window.ethereum = {
    request: ({ method }) => (method === 'eth_requestAccounts' || method === 'eth_accounts'
      ? Promise.resolve([ESTABLISHMENT])
      : Promise.reject(new Error('unexpected ' + method))),
  };
});

function mockReload() {
  const reload = jest.fn();
  const location = window.location;
  delete window.location;
  window.location = { reload: reload };
  return { reload: reload, restore: () => { window.location = location; } };
}

const dispatchButton = () => screen.getByText('Dispatch order');
const htmlHasKey = (container) => container.innerHTML.includes('dcpk1:') ||
  container.querySelector('svg[aria-label="Pickup key QR code"]') !== null;

describe('order card before pickup', () => {
  it('shows no pickup key in WAITING, whatever was scanned, and says when it will appear', async () => {
    const { container } = render(card(orderBlock('WAITING')));
    expect(screen.getByText(/The pickup key appears here once the pickup is recorded on the chain; show it to the worker then\./)).toBeTruthy();
    expect(screen.queryByText('Show pickup key')).toBeNull();
    expect(dispatchButton().disabled).toBe(true);

    // opening the order shows the items, and still no key
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');
    expect(htmlHasKey(container)).toBe(false);

    // text that is not a signature
    paste('hello');
    expect(screen.getByText(/Not a valid confirmation/)).toBeTruthy();
    expect(dispatchButton().disabled).toBe(true);

    // the checked confirmation of the committed worker enables the dispatch and shows no key
    paste(confirmationOf('7', worker));
    await screen.findByText(/Confirmation checked/);
    expect(dispatchButton().disabled).toBe(false);
    expect(keyField()).toBeNull();
    expect(htmlHasKey(container)).toBe(false);
    expect(screen.queryByText('Show pickup key')).toBeNull();
    expect(screen.getByText(/The pickup key appears here once the pickup is recorded/)).toBeTruthy();
    // the order was read again from its address, as the establishment
    expect(orderReads).toEqual([{ orderAddress: ORDER_ADDRESSES[7], from: ESTABLISHMENT }]);

    // changing the confirmation disables the dispatch again
    paste(confirmationOf('7', otherWorker));
    await screen.findByText(/was not signed for this order by the worker committed to it/);
    expect(dispatchButton().disabled).toBe(true);
    expect(htmlHasKey(container)).toBe(false);
    expect(alerts).toEqual([]);
  });

  it('refuses the confirmation of another worker and of another order, and does not dispatch with it', async () => {
    render(card(orderBlock('WAITING')));
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');

    paste(confirmationOf('7', otherWorker));
    await screen.findByText(/was not signed for this order by the worker committed to it/);
    expect(keyField()).toBeNull();

    // the same worker, for another order
    paste(confirmationOf('8', worker));
    await wait(() => expect(screen.queryByText(/Checking the confirmation/)).toBeNull());
    expect(screen.getByText(/was not signed for this order by the worker committed to it/)).toBeTruthy();
    expect(keyField()).toBeNull();
    expect(localStorage.getItem(deploymentKey('pickupConfirmations'))).toBeNull();

    expect(dispatchButton().disabled).toBe(true);
    fireEvent.click(dispatchButton());
    expect(sent).toHaveLength(0);
  });

  it('says so when the confirmation could not be checked, and checks again on request', async () => {
    chainDown = true;
    render(card(orderBlock('WAITING')));
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');

    paste(confirmationOf('7', worker));
    await screen.findByText(/Could not check the confirmation/);
    expect(keyField()).toBeNull();
    expect(dispatchButton().disabled).toBe(true);
    fireEvent.click(dispatchButton());
    expect(sent).toHaveLength(0);

    chainDown = false;
    fireEvent.click(screen.getByText('Check again'));
    await screen.findByText(/Confirmation checked/);
    expect(dispatchButton().disabled).toBe(false);
    expect(keyField()).toBeNull();
  });

  it('does not enable the dispatch while the order itself cannot be read again', async () => {
    orderDown = true;
    render(card(orderBlock('WAITING')));
    paste(confirmationOf('7', worker));
    await screen.findByText(/Could not check the confirmation/);
    expect(dispatchButton().disabled).toBe(true);
    expect(localStorage.getItem(deploymentKey('pickupConfirmations'))).toBeNull();
  });

  it('keeps a checked confirmation over a page reload, and checks it again', async () => {
    const signature = confirmationOf('7', worker);
    const first = render(card(orderBlock('WAITING')));
    paste(signature);
    await screen.findByText(/Confirmation checked/);
    first.unmount();

    orderReads = [];
    const second = render(card(orderBlock('WAITING')));
    await screen.findByText(/Confirmation checked/);
    expect(screen.getByPlaceholderText("Worker's pickup confirmation").value).toBe(signature);
    expect(orderReads).toHaveLength(1);
    expect(dispatchButton().disabled).toBe(false);
    // still no key, and no way to ask for one
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');
    expect(htmlHasKey(second.container)).toBe(false);
    expect(screen.queryByText('Show pickup key')).toBeNull();
  });

  it('does not reuse a kept confirmation after the order was offered to another worker', async () => {
    const first = render(card(orderBlock('WAITING')));
    paste(confirmationOf('7', worker));
    await screen.findByText(/Confirmation checked/);
    first.unmount();

    render(card(orderBlock('WAITING', { committed: otherWorker.address })));
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');
    expect(screen.getByPlaceholderText("Worker's pickup confirmation").value).toBe('');
    expect(screen.queryByText(/Confirmation checked/)).toBeNull();
    expect(keyField()).toBeNull();

    // pasted by hand, the old confirmation is refused for the new worker
    paste(confirmationOf('7', worker));
    await screen.findByText(/was not signed for this order by the worker committed to it/);
    expect(keyField()).toBeNull();
    expect(dispatchButton().disabled).toBe(true);
  });

  it('dispatches with a checked confirmation, forgets it, and shows the key once the pickup is recorded', async () => {
    const page = mockReload();
    const signature = confirmationOf('7', worker);
    const { container } = render(card(orderBlock('WAITING')));
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');
    paste(signature);
    await screen.findByText(/Confirmation checked/);
    expect(JSON.parse(localStorage.getItem(deploymentKey('pickupConfirmations')))[7].signature).toBe(signature);
    expect(htmlHasKey(container)).toBe(false);

    fireEvent.click(dispatchButton());
    await wait(() => expect(keyField()).not.toBeNull());
    expect(sent).toEqual([[ORDER_ADDRESSES[7], signature]]);
    expect(alerts).toHaveLength(0);
    expect(localStorage.getItem(deploymentKey('pickupConfirmations'))).toBeNull();
    // the card goes on as DISPATCHED without a reload, with the key of the chain's worker
    expect(page.reload).not.toHaveBeenCalled();
    expect(keyField().value).toBe(currentPickupKey(K, '7', worker.address));
    expect(container.querySelector('svg[aria-label="Pickup key QR code"]')).not.toBeNull();
    expect(screen.getByText(/The pickup is recorded on the chain/)).toBeTruthy();
    expect(screen.getByText('DISPATCHED')).toBeTruthy();
    expect(screen.queryByText('Dispatch order')).toBeNull();
    // read before the check, before sending, and after the pickup was mined
    expect(orderReads).toHaveLength(3);
    page.restore();
  });

  it('asks to open the order after the dispatch when it was not opened before', async () => {
    const page = mockReload();
    render(card(orderBlock('WAITING')));
    paste(confirmationOf('7', worker));
    await screen.findByText(/Confirmation checked/);
    fireEvent.click(dispatchButton());
    await screen.findByText('Show pickup key');
    expect(keyField()).toBeNull();
    fireEvent.click(screen.getByText('Show pickup key'));
    await wait(() => expect(keyField()).not.toBeNull());
    expect(keyField().value).toBe(currentPickupKey(K, '7', worker.address));
    expect(page.reload).not.toHaveBeenCalled();
    page.restore();
  });

  it('reloads the page after the dispatch when the recorded pickup cannot be read', async () => {
    const page = mockReload();
    const { container } = render(card(orderBlock('WAITING')));
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');
    paste(confirmationOf('7', worker));
    await screen.findByText(/Confirmation checked/);
    const send = chain.methods.pickupOrder;
    chain.methods.pickupOrder = (...args) => ({ estimateGas: () => Promise.resolve(165000), send: () => { orderDown = true; return send(...args).send(); } });
    fireEvent.click(dispatchButton());
    await wait(() => expect(page.reload).toHaveBeenCalled());
    expect(sent).toHaveLength(1);
    expect(htmlHasKey(container)).toBe(false);
    chain.methods.pickupOrder = send;
    page.restore();
  });

  it('has no key to show for an order placed before the pickup key existed, and dispatches it', async () => {
    const page = mockReload();
    const { container } = render(card(orderBlock('WAITING', { legacy: true })));
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');
    expect(screen.getByText(/there is no key to show/)).toBeTruthy();

    const signature = confirmationOf('7', worker);
    paste(signature);
    await screen.findByText(/Confirmation checked/);
    expect(screen.getByText(/there is no key to show/).textContent).toMatch(/The confirmation is valid: press Dispatch order/);
    expect(keyField()).toBeNull();

    fireEvent.click(dispatchButton());
    await wait(() => expect(screen.getByText('DISPATCHED')).toBeTruthy());
    expect(sent).toEqual([[ORDER_ADDRESSES[7], signature]]);
    expect(htmlHasKey(container)).toBe(false);
    page.restore();
  });
});

// The card was loaded while the first worker was committed;
// since then they left the order (it is back in PREPARATION) and the card was not reloaded.
// Their signed confirmation is still valid against the contract's digest.
describe('a card that holds an older copy of the order', () => {
  const reopened = () => orderBlock('PREPARATION', { committed: ZERO });

  it('gives no key and no dispatch to the first worker who left, says that the order changed and reloads', async () => {
    const page = mockReload();
    const { container } = render(card(orderBlock('WAITING')));
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');

    chainSays = reopened();
    paste(confirmationOf('7', worker));
    await wait(() => expect(page.reload).toHaveBeenCalled());
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatch(/This order changed on the chain since this page was loaded/);
    expect(screen.queryByText(/Confirmation checked/)).toBeNull();
    expect(htmlHasKey(container)).toBe(false);
    expect(dispatchButton().disabled).toBe(true);
    fireEvent.click(dispatchButton());
    expect(sent).toEqual([]);
    expect(localStorage.getItem(deploymentKey('pickupConfirmations'))).toBeNull();
    // the card itself says so and offers the reload
    expect(screen.getByText(/This order changed on the chain since this page was loaded/)).toBeTruthy();
    expect(screen.getByText('Reload the order')).toBeTruthy();
    page.restore();
  });

  it('sends no dispatch when the worker leaves between the check and the dispatch', async () => {
    const page = mockReload();
    const { container } = render(card(orderBlock('WAITING')));
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');
    paste(confirmationOf('7', worker));
    await screen.findByText(/Confirmation checked/);
    expect(dispatchButton().disabled).toBe(false);

    chainSays = reopened();
    fireEvent.click(dispatchButton());
    await wait(() => expect(page.reload).toHaveBeenCalled());
    expect(alerts[0]).toMatch(/This order changed on the chain/);
    expect(sent).toEqual([]);
    expect(htmlHasKey(container)).toBe(false);
    page.restore();
  });

  it('does not trust a kept confirmation after a reload of the component alone: it says that the order changed', async () => {
    const page = mockReload();
    const first = render(card(orderBlock('WAITING')));
    paste(confirmationOf('7', worker));
    await screen.findByText(/Confirmation checked/);
    first.unmount();

    chainSays = reopened();
    const { container } = render(card(orderBlock('WAITING')));
    await screen.findByText(/This order changed on the chain since this page was loaded/);
    expect(screen.queryByText(/Confirmation checked/)).toBeNull();
    expect(dispatchButton().disabled).toBe(true);
    expect(htmlHasKey(container)).toBe(false);
    // nobody acted: no alert and no reload by itself
    expect(alerts).toEqual([]);
    expect(page.reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Reload the order'));
    expect(page.reload).toHaveBeenCalled();
    page.restore();
  });

  it('does the same when a second worker committed meanwhile', async () => {
    const page = mockReload();
    const { container } = render(card(orderBlock('WAITING')));
    chainSays = orderBlock('WAITING', { committed: otherWorker.address });
    // the confirmation of the worker the card shows, and the one of the worker on the chain
    paste(confirmationOf('7', worker));
    await wait(() => expect(page.reload).toHaveBeenCalledTimes(1));
    paste(confirmationOf('7', otherWorker));
    await wait(() => expect(page.reload).toHaveBeenCalledTimes(2));
    expect(dispatchButton().disabled).toBe(true);
    expect(sent).toEqual([]);
    expect(htmlHasKey(container)).toBe(false);
    page.restore();
  });
});

describe('order card on the way', () => {
  it('shows the pickup key after a fresh read says DISPATCHED with the same worker, without a confirmation', async () => {
    localStorage.setItem(deploymentKey('pickupConfirmations'), JSON.stringify({ 7: { worker: worker.address.toLowerCase(), signature: confirmationOf('7', worker) } }));
    const { container } = render(card(orderBlock('DISPATCHED')));
    expect(localStorage.getItem(deploymentKey('pickupConfirmations'))).toBeNull();
    expect(htmlHasKey(container)).toBe(false);

    fireEvent.click(await screen.findByText('Show pickup key'));
    await wait(() => expect(keyField()).not.toBeNull());
    expect(keyField().value).toBe(currentPickupKey(K, '7', worker.address));
    expect(screen.getByText(/let them scan this key before they leave/)).toBeTruthy();
    // read when the card appeared and again when the key was asked for
    expect(orderReads).toEqual([
      { orderAddress: ORDER_ADDRESSES[7], from: ESTABLISHMENT },
      { orderAddress: ORDER_ADDRESSES[7], from: ESTABLISHMENT },
    ]);
  });

  it('shows the key with the items when the order is opened', async () => {
    render(card(orderBlock('DISPATCHED')));
    await screen.findByText('Show pickup key');
    fireEvent.click(screen.getByText('Show items'));
    await wait(() => expect(keyField()).not.toBeNull());
    expect(keyField().value).toBe(currentPickupKey(K, '7', worker.address));
  });

  it('shows no key when the chain names another worker or another step', async () => {
    const page = mockReload();
    chainSays = orderBlock('DISPATCHED', { committed: otherWorker.address });
    const first = render(card(orderBlock('DISPATCHED')));
    await screen.findByText(/This order changed on the chain since this page was loaded/);
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');
    expect(htmlHasKey(first.container)).toBe(false);
    expect(screen.queryByText('Show pickup key')).toBeNull();
    first.unmount();

    chainSays = orderBlock('CANCELED BY FIRST DELIVERYMAN');
    const second = render(card(orderBlock('DISPATCHED')));
    await screen.findByText(/This order changed on the chain since this page was loaded/);
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');
    expect(htmlHasKey(second.container)).toBe(false);
    expect(page.reload).not.toHaveBeenCalled();
    page.restore();
  });

  it('shows no key while the chain cannot be read, and reads again on request', async () => {
    orderDown = true;
    const { container } = render(card(orderBlock('DISPATCHED')));
    await screen.findByText(/could not be read from the chain, so the pickup key is not shown/);
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');
    expect(htmlHasKey(container)).toBe(false);

    orderDown = false;
    fireEvent.click(screen.getByText('Read the order again'));
    await wait(() => expect(keyField()).not.toBeNull());
    expect(keyField().value).toBe(currentPickupKey(K, '7', worker.address));
  });

  it('shows no key when the chain does not show the order to this account', async () => {
    // the view of an outsider: no status
    chainSays = ['7', '', '0', '', ZERO, '0', '0', '0', ZERO, '0', '0'];
    const { container } = render(card(orderBlock('DISPATCHED')));
    await screen.findByText(/could not be read from the chain, so the pickup key is not shown/);
    fireEvent.click(screen.getByText('Show items'));
    await screen.findByText('Pão de queijo');
    expect(htmlHasKey(container)).toBe(false);
  });
});

describe('the timeout of an order that waits for its worker', () => {
  const NOW = Math.floor(Date.now() / 1000);
  const waitingSince = (seconds) => {
    const block = orderBlock('WAITING');
    block[7] = String(seconds);
    return block;
  };

  it('offers no cancellation before one hour since the commitment, and says when it will', () => {
    render(card(waitingSince(NOW - 600)));
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(screen.getByText(/If the worker does not come, you can cancel this order after/)).toBeTruthy();
  });

  it('offers it after the hour, says what it does, and sends it for the order', async () => {
    const page = mockReload();
    latestBlockTime = NOW - 2;
    render(card(waitingSince(NOW - 3700)));
    expect(screen.getByText(/The worker did not come within one hour/).textContent)
      .toMatch(/the customer is refunded what they paid, except the gas stipend that came with the order, your collateral \(the delivery fee\) comes back as a note in the payment pool, and the worker is paid nothing, is counted as having left before pickup and can be rated by you/);
    // the stipend stays at the order's one-time address: the refund is not "in full"
    expect(screen.queryByText(/refunded in full/)).toBeNull();

    fireEvent.click(screen.getByText('Cancel'));
    await wait(() => expect(page.reload).toHaveBeenCalled());
    expect(calls.map((c) => [c.name, c.args])).toEqual([['cancelOrder', [ORDER_ADDRESSES[7]]]]);
    expect(calls[0].args).toHaveLength(arity('cancelOrder'));
    expect(alerts).toEqual([]);
    page.restore();
  });

  it('sends nothing when the hour has not passed by the time of the chain', async () => {
    const page = mockReload();
    latestBlockTime = NOW - 3700 + 3600;
    render(card(waitingSince(NOW - 3700)));
    fireEvent.click(screen.getByText('Cancel'));
    await wait(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]).toMatch(/has not passed on the chain yet\. Nothing was sent/);
    expect(calls).toEqual([]);
    expect(page.reload).not.toHaveBeenCalled();
    page.restore();
  });

  it('sends nothing from a card that holds an older copy of the order', async () => {
    const page = mockReload();
    latestBlockTime = NOW;
    render(card(waitingSince(NOW - 3700)));
    chainSays = orderBlock('PREPARATION', { committed: ZERO });
    fireEvent.click(screen.getByText('Cancel'));
    await wait(() => expect(page.reload).toHaveBeenCalled());
    expect(alerts[0]).toMatch(/This order changed on the chain/);
    expect(calls).toEqual([]);
    page.restore();
  });
});

describe('the timeout of an order that is on the way', () => {
  const NOW = Math.floor(Date.now() / 1000);
  const dispatchedSince = (seconds) => {
    const block = orderBlock('DISPATCHED');
    block[7] = String(seconds);
    return block;
  };

  it('offers no cancellation before one hour since the pickup, and says why', async () => {
    render(card(dispatchedSince(NOW - 600)));
    await wait(() => expect(orderReads.length).toBeGreaterThan(0));
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(screen.getByText(/If the delivery is not concluded, you can cancel this order after/).textContent)
      .toMatch(/one hour after the pickup\) and get your collateral back as a note in the payment pool\. Before that, a cancellation would cost you the collateral/);
    expect(screen.getByText('Contest order')).toBeTruthy();
  });

  it('offers none either on the card that has just seen its own dispatch', async () => {
    const signature = confirmationOf('7', worker);
    render(card(orderBlock('WAITING')));
    paste(signature);
    await screen.findByText(/Confirmation checked/);
    await wait(() => expect(screen.getByText('Dispatch order').disabled).toBe(false));
    // as on the chain: the pickup is recorded now
    const pickup = chain.methods.pickupOrder;
    chain.methods.pickupOrder = (orderAddress, sig) => ({
      estimateGas: () => Promise.resolve(165000),
      send: () => {
        sent.push([orderAddress, sig]);
        chainSays = orderBlock('DISPATCHED');
        chainSays[7] = String(NOW);
        return Promise.resolve({});
      },
    });
    fireEvent.click(screen.getByText('Dispatch order'));
    await screen.findByText(/If the delivery is not concluded, you can cancel this order after/);
    chain.methods.pickupOrder = pickup;
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('offers it after the hour, says what it does, and sends it for the order', async () => {
    const page = mockReload();
    latestBlockTime = NOW - 2;
    render(card(dispatchedSince(NOW - 3700)));
    expect(screen.getByText(/The delivery was not concluded within one hour of the pickup/).textContent)
      .toMatch(/the customer is refunded what they paid, except the gas stipend that came with the order, your collateral \(the delivery fee\) comes back as a note in the payment pool, you are not paid for the items, and the worker is paid nothing, is counted as having left after pickup and can be rated by you and by the customer/);

    fireEvent.click(screen.getByText('Cancel'));
    await wait(() => expect(page.reload).toHaveBeenCalled());
    expect(calls.map((c) => [c.name, c.args])).toEqual([['cancelOrder', [ORDER_ADDRESSES[7]]]]);
    expect(alerts).toEqual([]);
    page.restore();
  });

  it('sends nothing when the hour has not passed by the time of the chain', async () => {
    const page = mockReload();
    latestBlockTime = NOW - 3700 + 3600;
    render(card(dispatchedSince(NOW - 3700)));
    fireEvent.click(screen.getByText('Cancel'));
    await wait(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]).toMatch(/The hour since the pickup has not passed on the chain yet\. Nothing was sent/);
    expect(calls).toEqual([]);
    expect(page.reload).not.toHaveBeenCalled();
    page.restore();
  });

  it('sends nothing from a card that holds an older copy of the order', async () => {
    const page = mockReload();
    latestBlockTime = NOW;
    render(card(dispatchedSince(NOW - 3700)));
    await wait(() => expect(orderReads.length).toBeGreaterThan(0));
    chainSays = orderBlock('CONCLUDED');
    fireEvent.click(screen.getByText('Cancel'));
    await wait(() => expect(page.reload).toHaveBeenCalled());
    expect(alerts[0]).toMatch(/This order changed on the chain/);
    expect(calls).toEqual([]);
    page.restore();
  });
});

// Number of arguments Chain takes, from the ABI the dApp ships
const arity = (name) => CHAIN_ABI.find((e) => e.type === 'function' && e.name === name).inputs.length;

describe('accepting an order', () => {
  it('calls prepareOrder with the payment commitment and the two minimums, and no rating commitment', async () => {
    if (!window.crypto) window.crypto = {};
    if (!window.crypto.getRandomValues) window.crypto.getRandomValues = (bytes) => require('crypto').randomFillSync(bytes);
    const page = mockReload();

    render(card(orderBlock('ORDERED', { committed: '0x0000000000000000000000000000000000000000' })));
    fireEvent.click(screen.getByText('Accept order'));
    await wait(() => expect(page.reload).toHaveBeenCalled());

    expect(alerts).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('prepareOrder');
    expect(calls[0].args).toHaveLength(arity('prepareOrder'));
    const stored = JSON.parse(localStorage.getItem(deploymentKey('paymentNoteSecrets')))[7];
    expect(calls[0].args).toEqual([ORDER_ADDRESSES[7], stored.commitment, 0, 0]);
    expect(calls[0].options).toMatchObject({ from: ESTABLISHMENT, value: '1000000000000000' });
    // nothing is kept for a rating proof any more
    expect(localStorage.getItem(deploymentKey('restaurantOrderSecrets'))).toBeNull();
    // the workers of the order are not read before somebody can have committed
    expect(logFilters).toEqual([]);
    page.restore();
  });
});

describe('accepting an order again', () => {
  it('uses the payment secrets of the earlier attempt, so that they are never replaced', async () => {
    if (!window.crypto) window.crypto = {};
    if (!window.crypto.getRandomValues) window.crypto.getRandomValues = (bytes) => require('crypto').randomFillSync(bytes);
    const page = mockReload();
    chain.methods.prepareOrder = () => ({ estimateGas: () => Promise.resolve(500000), send: () => Promise.reject(new Error('Failed to check for transaction receipt')) });

    render(card(orderBlock('ORDERED', { committed: ZERO })));
    fireEvent.click(screen.getByText('Accept order'));
    await wait(() => expect(alerts).toHaveLength(1));
    const first = JSON.parse(localStorage.getItem(deploymentKey('paymentNoteSecrets')))[7];
    expect(first.commitment).toMatch(/^[0-9]+$/);

    chain.methods.prepareOrder = records_call('prepareOrder');
    fireEvent.click(await screen.findByText('Accept order'));
    await wait(() => expect(page.reload).toHaveBeenCalled());
    expect(JSON.parse(localStorage.getItem(deploymentKey('paymentNoteSecrets')))[7]).toEqual(first);
    expect(calls[0].args).toEqual([ORDER_ADDRESSES[7], first.commitment, 0, 0]);
    page.restore();
  });
});

describe('accepting an order whose number was used before', () => {
  const accept = async () => {
    if (!window.crypto) window.crypto = {};
    if (!window.crypto.getRandomValues) window.crypto.getRandomValues = (bytes) => require('crypto').randomFillSync(bytes);
    const page = mockReload();
    render(card(orderBlock('ORDERED', { committed: ZERO })));
    fireEvent.click(screen.getByText('Accept order'));
    await wait(() => expect(page.reload).toHaveBeenCalled());
    page.restore();
    return JSON.parse(localStorage.getItem(deploymentKey('paymentNoteSecrets')));
  };
  const OLD = { nullifier: '11', trapdoor: '22', commitment: '123456789' };

  it('does not send the commitment kept for order 7 of another deployment', async () => {
    const old = Object.assign({ order: ORDER_ADDRESSES[8], placedAt: '1760000000' }, OLD);
    localStorage.setItem(deploymentKey('paymentNoteSecrets'), JSON.stringify({ 7: old }));
    const stored = await accept();
    expect(calls[0].name).toBe('prepareOrder');
    expect(calls[0].args[1]).not.toBe(OLD.commitment);
    expect(calls[0].args[1]).toBe(stored[7].commitment);
    expect(stored[7]).toMatchObject({ order: ORDER_ADDRESSES[7], placedAt: '1760000000' });
    // the older secrets are kept
    expect(stored['7@' + ORDER_ADDRESSES[8] + '@1760000000']).toEqual(old);
  });

  it('does not send one kept for the same address on a chain that started again', async () => {
    localStorage.setItem(deploymentKey('paymentNoteSecrets'), JSON.stringify({ 7: Object.assign({ order: ORDER_ADDRESSES[7], placedAt: '1750000000' }, OLD) }));
    const stored = await accept();
    expect(calls[0].args[1]).not.toBe(OLD.commitment);
    expect(stored[7].placedAt).toBe('1760000000');
  });

  it('does not send one that names no order', async () => {
    localStorage.setItem(deploymentKey('paymentNoteSecrets'), JSON.stringify({ 7: OLD }));
    await accept();
    expect(calls[0].args[1]).not.toBe(OLD.commitment);
  });
});

describe('replacing the worker', () => {
  it('offers it for the first worker, says what it does, and calls it with the order alone', async () => {
    const page = mockReload();
    actorLogs = [commitment('7', worker.address, 20)];
    render(card(orderBlock('WAITING')));
    await wait(() => expect(logFilters).toHaveLength(1));
    expect(logFilters[0]).toMatchObject({ address: ORDER_ADDRESSES[7], topics: [ORDER_ACTORS_TOPIC] });
    expect(screen.getByText(/Possible once per order/).textContent).toMatch(/counted as having left it and you can rate them/);

    fireEvent.click(screen.getByText('Call other deliveryman'));
    await wait(() => expect(page.reload).toHaveBeenCalled());
    expect(calls.map((c) => [c.name, c.args])).toEqual([['callSecondDeliveryman', [ORDER_ADDRESSES[7]]]]);
    expect(calls[0].args).toHaveLength(arity('callSecondDeliveryman'));
    page.restore();
  });

  it('hides it for the second worker and explains why', async () => {
    actorLogs = [commitment('7', otherWorker.address, 20), commitment('7', worker.address, 31)];
    ratings[otherWorker.address.toLowerCase()] = { outcome: '1', byClient: '0', byEstablishment: '0' };
    render(card(orderBlock('WAITING')));
    await screen.findByText(/This is the second worker of this order/);
    expect(screen.queryByText('Call other deliveryman')).toBeNull();
    // the order can still be dispatched
    expect(screen.getByText('Dispatch order')).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it('keeps the button when the commitments could not be read: the contract decides', async () => {
    cardWeb3.eth.getPastLogs = () => Promise.reject(new Error('network'));
    render(card(orderBlock('WAITING')));
    await wait(() => expect(screen.getByText('Call other deliveryman')).toBeTruthy());
    cardWeb3.eth.getPastLogs = (filter) => { logFilters.push(filter); return Promise.resolve(actorLogs); };
  });
});

describe('rating the workers of an order', () => {
  const short = (address) => address.toLowerCase().slice(0, 6) + '...' + address.toLowerCase().slice(-4);

  it('lists the worker who delivered and rates them through the order, once', async () => {
    actorLogs = [commitment('7', worker.address, 20)];
    ratings[worker.address.toLowerCase()] = { outcome: '3', byClient: '4', byEstablishment: '0' };
    render(card(orderBlock('CONCLUDED')));

    await screen.findByText(/delivered, not rated yet/);
    expect(screen.getByText(/A rating is public/)).toBeTruthy();
    expect(screen.queryByText(/anonymous/i)).toBeNull();

    fireEvent.click(screen.getByLabelText('Rate ' + short(worker.address) + ' 4 of 5'));
    await screen.findByText(/delivered: you rated ★★★★$/);
    expect(calls.map((c) => [c.name, c.args])).toEqual([['rateOrder', [ORDER_ADDRESSES[7], worker.address.toLowerCase(), 4]]]);
    expect(calls[0].args).toHaveLength(arity('rateOrder'));
    expect(screen.queryByLabelText(/^Rate /)).toBeNull();
    expect(alerts).toEqual([]);
  });

  it('shows a worker who left before pickup while the order goes on with the second one', async () => {
    actorLogs = [commitment('7', otherWorker.address, 20), commitment('7', worker.address, 31)];
    ratings[otherWorker.address.toLowerCase()] = { outcome: '1', byClient: '0', byEstablishment: '0' };
    render(card(orderBlock('WAITING')));

    await screen.findByText(/left before pickup, not rated yet/);
    // the worker committed now cannot be rated yet: no line for them
    expect(screen.queryByLabelText('Rate ' + short(worker.address) + ' 1 of 5')).toBeNull();
    fireEvent.click(screen.getByLabelText('Rate ' + short(otherWorker.address) + ' 2 of 5'));
    await screen.findByText(/left before pickup: you rated ★★$/);
    expect(calls.map((c) => [c.name, c.args])).toEqual([['rateOrder', [ORDER_ADDRESSES[7], otherWorker.address.toLowerCase(), 2]]]);
  });

  it('shows both workers of a concluded order and which one was rated already', async () => {
    actorLogs = [commitment('7', otherWorker.address, 20), commitment('7', worker.address, 31)];
    ratings[otherWorker.address.toLowerCase()] = { outcome: '1', byClient: '0', byEstablishment: '5' };
    ratings[worker.address.toLowerCase()] = { outcome: '3', byClient: '0', byEstablishment: '0' };
    render(card(orderBlock('CONCLUDED')));

    await screen.findByText(/left before pickup: you rated ★★★★★$/);
    expect(screen.getByText(/delivered, not rated yet/)).toBeTruthy();
    expect(screen.queryByLabelText('Rate ' + short(otherWorker.address) + ' 1 of 5')).toBeNull();
    expect(screen.getByLabelText('Rate ' + short(worker.address) + ' 5 of 5')).toBeTruthy();
  });

  it('shows a worker who left after pickup on a cancelled order', async () => {
    actorLogs = [commitment('7', worker.address, 20)];
    ratings[worker.address.toLowerCase()] = { outcome: '2', byClient: '0', byEstablishment: '0' };
    render(card(orderBlock('CANCELED BY FIRST DELIVERYMAN')));
    await screen.findByText(/left after pickup, not rated yet/);
  });

  it('shows no rating when the order reported nothing about its worker', async () => {
    actorLogs = [commitment('7', worker.address, 20)];
    render(card(orderBlock('CANCELED BY CLIENT')));
    await wait(() => expect(logFilters).toHaveLength(1));
    await wait(() => {});
    expect(screen.queryByText(/Delivery workers of this order/)).toBeNull();
  });

  it('says why a rating was refused and leaves it to be given again', async () => {
    actorLogs = [commitment('7', worker.address, 20)];
    ratings[worker.address.toLowerCase()] = { outcome: '3', byClient: '0', byEstablishment: '0' };
    chain.methods.rateOrder = () => ({ estimateGas: () => Promise.resolve(70000), send: () => Promise.reject(new Error('execution reverted: Already rated')) });
    render(card(orderBlock('CONCLUDED')));
    await screen.findByText(/delivered, not rated yet/);
    fireEvent.click(screen.getByLabelText('Rate ' + short(worker.address) + ' 3 of 5'));
    await wait(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]).toMatch(/already rated/);
    expect(screen.getByText(/delivered, not rated yet/)).toBeTruthy();
    chain.methods.rateOrder = records_call('rateOrder');
  });
});

describe("the worker's public record", () => {
  it('shows average, ratings, deliveries, leavings and ratings received after leaving', async () => {
    records[worker.address.toLowerCase()] = { totalScore: '9', totalRatings: '2', completedOrders: '3', leftOrders: '1', ratingsAfterLeaving: '1' };
    render(card(orderBlock('WAITING')));
    await screen.findByText('4.5★ · 2 ratings · 3 deliveries · left 1 order · 1 rating received after leaving');
  });

  it('shows a worker without ratings', async () => {
    records[worker.address.toLowerCase()] = { totalScore: '0', totalRatings: '0', completedOrders: '0', leftOrders: '2', ratingsAfterLeaving: '0' };
    render(card(orderBlock('WAITING')));
    await screen.findByText('No ratings yet · 0 deliveries · left 2 orders · 0 ratings received after leaving');
  });
});

describe('gas limits of the calls sent from the wallet (an order without a one-time key)', () => {
  it('sends every call with the estimate of the node times 1.2 and no fixed limit', async () => {
    const page = mockReload();
    estimates = { cancelOrder: 1349001, prepareOrder: 511859 };
    const first = render(card(orderBlock('PREPARATION', { committed: ZERO })));
    fireEvent.click(screen.getByText('Cancel'));
    await wait(() => expect(calls).toHaveLength(1));
    expect(estimated[0]).toEqual({ name: 'cancelOrder', options: { from: ESTABLISHMENT } });
    expect(calls[0].options).toEqual({ from: ESTABLISHMENT, gas: '1618802' });
    first.unmount();

    if (!window.crypto) window.crypto = {};
    if (!window.crypto.getRandomValues) window.crypto.getRandomValues = (bytes) => require('crypto').randomFillSync(bytes);
    const second = render(card(orderBlock('ORDERED', { committed: ZERO })));
    fireEvent.click(screen.getByText('Accept order'));
    await wait(() => expect(calls).toHaveLength(2));
    // 400,000 gas is below what prepareOrder needs on Sepolia
    expect(calls[1].options).toEqual({ from: ESTABLISHMENT, value: '1000000000000000', gas: '614231' });
    second.unmount();

    const signature = confirmationOf('7', worker);
    render(card(orderBlock('WAITING')));
    paste(signature);
    await wait(() => expect(dispatchButton().disabled).toBe(false));
    fireEvent.click(dispatchButton());
    await wait(() => expect(sent).toHaveLength(1));
    expect(pickupOptions).toEqual({ from: ESTABLISHMENT, gas: '198000' });
    page.restore();
  });

  it('sends nothing when the node cannot estimate the call, and says why', async () => {
    const page = mockReload();
    estimates = { cancelOrder: new Error('execution reverted: Function cannot be called at this step') };
    render(card(orderBlock('PREPARATION', { committed: ZERO })));
    fireEvent.click(screen.getByText('Cancel'));
    await wait(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]).toBe('This is not possible in the current state of the order. Reload the page to see its state. Nothing was sent.');
    expect(calls).toHaveLength(0);
    expect(page.reload).not.toHaveBeenCalled();
    page.restore();
  });
});
