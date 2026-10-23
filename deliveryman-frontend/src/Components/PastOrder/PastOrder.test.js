import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import PastOrder from './index';
import { sealDetailsWith } from '../../utils/pickupSeal';
import { setDeployment, deploymentKey } from '../../utils/deploymentStorage';
import { GIVE_UP_GAS_NOTE, CANCEL_GAS_NOTE, ENDING_GAS_NOTE } from '../../utils/leaving';

// Fakes of the wallet, the contracts, the API and the camera. Plain functions
// instead of jest.fn() where an implementation is needed, because CRA resets
// mock implementations before each test.
// What the customer posted for this worker, as the two strings of the Information
// event of Storage: ['', ''] = nothing posted.
let mockInformation = ['', ''];
// 1 = this worker is the order's first worker, 2 = its second, 0 = not a worker of it
let mockPosition = 1;
const mockSigned = [];
const mockLogQueries = [];
const mockCancelled = [];
// what the node answers to an estimate, the estimates asked and the options of each send
let mockEstimate = () => Promise.resolve(1000000);
const mockEstimates = [];
const mockSent = [];
// the order's step as the chain reports it now (the card starts from the page's copy)
let mockChainStatus = 'WAITING';

jest.mock('../../services/getWeb3', () => {
  const Web3 = require('web3');
  const { STORAGE_ADDRESS, DEPLOY_BLOCK } = require('../../services/config');
  const { ORDER_ACTORS_TOPIC, INFORMATION_TOPIC, addressTopic } = require('../../utils/orderLogs');
  const web3 = new Web3();
  const ORDER = '0x00000000000000000000000000000000000000aa';
  const ME = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
  const OTHER_WORKER = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
  const uintTopic = (number) => web3.utils.padLeft(web3.utils.numberToHex(number), 64);

  const actors = (worker, blockNumber) => ({
    address: ORDER, blockNumber, logIndex: 0,
    topics: [ORDER_ACTORS_TOPIC, addressTopic(ORDER), addressTopic(ORDER), addressTopic(worker)],
    data: web3.eth.abi.encodeParameter('address', ORDER),
  });
  const information = (position, strings, blockNumber) => ({
    address: STORAGE_ADDRESS, blockNumber, logIndex: 0,
    topics: [INFORMATION_TOPIC, uintTopic(7), uintTopic(position)],
    data: web3.eth.abi.encodeParameters(['string', 'string'], strings),
  });

  // The logs of the chain: the order's commitments and the customer's posts.
  // A post for the other worker is always there, to show that it is not read.
  function chainLogs() {
    const logs = [];
    if (mockPosition === 1) logs.push(actors(ME, DEPLOY_BLOCK + 20));
    if (mockPosition === 2) logs.push(actors(OTHER_WORKER, DEPLOY_BLOCK + 20), information(1, ['0xother1', '0xother2'], DEPLOY_BLOCK + 21), actors(ME, DEPLOY_BLOCK + 30));
    if (mockPosition === 0) logs.push(actors(OTHER_WORKER, DEPLOY_BLOCK + 20), information(1, ['0xother1', '0xother2'], DEPLOY_BLOCK + 21));
    if (mockPosition !== 0 && mockInformation[0] !== '') logs.push(information(mockPosition, mockInformation, DEPLOY_BLOCK + 40));
    return logs;
  }

  const logWeb3 = {
    utils: web3.utils,
    eth: {
      abi: web3.eth.abi,
      getPastLogs: (filter) => {
        mockLogQueries.push(filter);
        return Promise.resolve(chainLogs().filter((log) =>
          log.address.toLowerCase() === filter.address.toLowerCase() &&
          log.blockNumber >= filter.fromBlock &&
          filter.topics.every((topic, i) => log.topics[i] === topic)));
      },
    },
  };

  return {
    useWeb3: () => ({
      chain: {
        methods: {
          findAddress: () => ({ call: () => Promise.resolve(ORDER) }),
          getOrder: () => ({ call: () => Promise.resolve(['7', '', '1000000000000000', mockChainStatus]) }),
          handoverDigest: () => ({ call: () => Promise.resolve('0x' + '11'.repeat(32)) }),
          cancelOrder: (order) => ({
            estimateGas: (options) => { mockEstimates.push(['cancelOrder', options]); return mockEstimate(); },
            send: (options) => { mockCancelled.push(order); mockSent.push(['cancelOrder', options]); return Promise.resolve({}); },
          }),
          deliveryOrder: (order, signature) => ({
            estimateGas: (options) => { mockEstimates.push(['deliveryOrder', options]); return mockEstimate(); },
            send: (options) => { mockSent.push(['deliveryOrder', options, signature]); return Promise.resolve({}); },
          }),
        },
      },
      logWeb3,
    }),
  };
});

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    defaults: { baseURL: 'http://localhost/deliveryman' },
    get: () => Promise.resolve({ data: { restaurant: { restaurant_name: 'Padaria Central', restaurant_address: 'Av. Brasil, 10' } } }),
  },
}));

const mockScanners = [];
jest.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { QR_CODE: 0 },
  Html5Qrcode: class {
    constructor() {
      this.onSuccess = null;
      mockScanners.push(this);
    }
    start(camera, configuration, onSuccess) {
      this.onSuccess = onSuccess;
      return Promise.resolve(null);
    }
    stop() { return Promise.resolve(); }
    clear() {}
  },
}));

const WORKER = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const S = '8OHSw7Sllod4aVpLPC0eDw';
const KEY_WORKER_1 = 'dcpk1:mHyYqQwT6_c5_b6cKAwtyQ';
const KEY_WORKER_2 = 'dcpk1:Vh32Dp3DFxebtDusHX79Hw';
const DELIVERY_ADDRESS = 'Rua São João, 100, apto 3';
const ITEMS = [{ name: 'Pão de queijo', quantity: 2, price: 7 }];
const SIGNATURE = '0x' + 'ab'.repeat(64) + '1b';

// The first string is opaque here: the fake wallet maps it to its plaintext.
const FIRST_SEALED = '0xf1';
const FIRST_LEGACY = '0xa1';
const ITEMS_LEGACY = '0xa2';
const PLAINTEXT = {
  [FIRST_SEALED]: JSON.stringify({ restaurantId: 12, s: S }),
  [FIRST_LEGACY]: JSON.stringify({ deliveryAddress: DELIVERY_ADDRESS, restaurantId: 12 }),
  [ITEMS_LEGACY]: JSON.stringify(ITEMS),
};
const SEALED = sealDetailsWith(KEY_WORKER_1, S, { deliveryAddress: DELIVERY_ADDRESS, items: ITEMS });

// the wallet's chain: a local one. The pickup keys are kept for it and this app's Chain contract.
const CHAIN_ID = '0x7a69';
let mockChainId = CHAIN_ID;
let decryptCalls;
let alerts;
let confirms;
let confirmAnswer;

function orderBlock(status) {
  return ['7', '', '1000000000000000', status, '0x00000000000000000000000000000000000000bb', '0', '1760000000', '1760000100',
    '0x0000000000000000000000000000000000000000', '0', '0'];
}

function decryptedCount() {
  return decryptCalls.length;
}

beforeEach(() => {
  localStorage.clear();
  mockInformation = [FIRST_SEALED, SEALED];
  mockPosition = 1;
  mockSigned.length = 0;
  mockLogQueries.length = 0;
  mockCancelled.length = 0;
  mockEstimate = () => Promise.resolve(1000000);
  mockEstimates.length = 0;
  mockSent.length = 0;
  setDeployment(CHAIN_ID);
  mockChainStatus = 'WAITING';
  confirms = [];
  confirmAnswer = false;
  window.confirm = (text) => { confirms.push(text); return confirmAnswer; };
  mockScanners.length = 0;
  decryptCalls = [];
  mockChainId = CHAIN_ID;
  alerts = [];
  window.alert = (text) => { alerts.push(text); };
  window.ethereum = {
    request: ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return Promise.resolve([WORKER]);
      if (method === 'eth_chainId') return Promise.resolve(mockChainId);
      if (method === 'eth_decrypt') {
        decryptCalls.push(params[0]);
        return Promise.resolve(PLAINTEXT[params[0]]);
      }
      if (method === 'personal_sign') {
        mockSigned.push(params[0]);
        return Promise.resolve(SIGNATURE);
      }
      return Promise.reject(new Error('unexpected ' + method));
    },
  };
});

async function openMoreDetails() {
  fireEvent.click(screen.getByText('More details'));
  await waitFor(() => expect(decryptedCount()).toBeGreaterThan(0));
}

describe('PastOrder with a sealed order', () => {
  it('shows the establishment after one decryption, and neither the address nor the items', async () => {
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    await openMoreDetails();

    await screen.findByText(/released at pickup/);
    expect(decryptCalls).toEqual([FIRST_SEALED]);
    expect(screen.getByText('Padaria Central')).toBeTruthy();
    expect(screen.queryByText(/Rua São João/)).toBeNull();
    expect(screen.queryByText('Pão de queijo')).toBeNull();
    expect(localStorage.getItem(deploymentKey('pickupKeys'))).toBeNull();
    // before pickup the card says what will happen and takes no key
    expect(screen.getByText(/when they dispatch the order they show you the pickup key/)).toBeTruthy();
    expect(screen.queryByPlaceholderText('Pickup key')).toBeNull();
    expect(screen.queryByText('Scan pickup key')).toBeNull();
    expect(screen.queryByText('Open delivery details')).toBeNull();
  });

  it('shows the confirmation while the order waits, and takes the key only once the order is dispatched', async () => {
    const { container } = render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);

    // before "More details": the confirmation is produced, and the next step is named
    fireEvent.click(screen.getByText('Confirm pickup'));
    await waitFor(() => expect(mockSigned).toHaveLength(1));
    await screen.findByText(/Show this code to the establishment/);
    expect(screen.getByText(/When they dispatch the order they show you the pickup key, which opens the delivery address/)).toBeTruthy();
    expect(mockSigned[0]).toBe('0x' + '11'.repeat(32));
    expect(screen.getByText(SIGNATURE)).toBeTruthy();
    expect(alerts).toHaveLength(0);
    expect(decryptCalls).toHaveLength(0);
    expect(screen.queryByPlaceholderText('Pickup key')).toBeNull();
    expect(screen.queryByText('Scan pickup key')).toBeNull();

    // "More details" names the establishment and still offers no key field
    await openMoreDetails();
    await screen.findByText(/show the code above to the establishment/);
    expect(screen.queryByPlaceholderText('Pickup key')).toBeNull();
    expect(screen.queryByText('Scan pickup key')).toBeNull();
    expect(screen.queryByText(/Rua São João/)).toBeNull();
    expect(screen.getByText(SIGNATURE)).toBeTruthy();

    // the establishment has not dispatched yet
    fireEvent.click(screen.getByText('The establishment dispatched the order'));
    await screen.findByText(/has not dispatched this order yet/);
    expect(screen.queryByPlaceholderText('Pickup key')).toBeNull();
    expect(screen.getByText(SIGNATURE)).toBeTruthy();

    // once the pickup is recorded, the scan of the key is the first thing on the card
    mockChainStatus = 'DISPATCHED';
    fireEvent.click(screen.getByText('The establishment dispatched the order'));
    await screen.findByText(/not open here yet/);
    expect(container.querySelector('.details').firstChild.textContent).toMatch(/Scan pickup key/);
    expect(screen.queryByText(SIGNATURE)).toBeNull();
    expect(screen.queryByText(/has not dispatched/)).toBeNull();
    expect(screen.getByText(/Delivery order/)).toBeTruthy();
    expect(screen.queryByText('Confirm pickup')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Pickup key'), { target: { value: KEY_WORKER_1 } });
    fireEvent.click(screen.getByText('Open delivery details'));
    expect(screen.getByText(/Rua São João, 100, apto 3/)).toBeTruthy();
    expect(screen.getByText('Pão de queijo')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Pickup key')).toBeNull();
  });

  it('follows the dispatch by itself while the confirmation is shown', async () => {
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('Confirm pickup'));
    await screen.findByText(/Show this code to the establishment/);

    // nothing is pressed: the card reads the order again every five seconds
    mockChainStatus = 'DISPATCHED';
    await screen.findByText(/The order was dispatched\. Before you leave, scan the pickup key/, {}, { timeout: 8000 });
    expect(screen.queryByText(SIGNATURE)).toBeNull();
    expect(decryptCalls).toHaveLength(0);
  }, 12000);

  it('hides the confirmation when the order is no longer theirs', async () => {
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('Confirm pickup'));
    await screen.findByText(/Show this code to the establishment/);

    // the public view, as a worker who was replaced gets it
    mockChainStatus = 'PREPARATION';
    fireEvent.click(screen.getByText('The establishment dispatched the order'));
    await screen.findByText(/no longer waiting for your pickup/);
    expect(screen.queryByText(SIGNATURE)).toBeNull();
    expect(screen.queryByPlaceholderText('Pickup key')).toBeNull();
  });

  it('signs after "More details" too, and tells the order of the steps', async () => {
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    await openMoreDetails();
    await screen.findByText(/press Confirm pickup and show them the code/);

    fireEvent.click(screen.getByText('Confirm pickup'));
    await waitFor(() => expect(mockSigned).toHaveLength(1));
    await screen.findByText(/show the code above to the establishment/);
    expect(alerts).toHaveLength(0);
    expect(screen.queryByPlaceholderText('Pickup key')).toBeNull();
    expect(screen.queryByText(/Rua São João/)).toBeNull();
  });

  it('offers the scan of the key first on a dispatched order, and loads the details with it', async () => {
    const { container } = render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    expect(container.querySelector('.details').firstChild.textContent).toMatch(/Scan pickup key/);
    expect(screen.getByText(/The order was dispatched\. Before you leave, scan the pickup key/)).toBeTruthy();

    // text that is not a pickup key asks nothing of the wallet
    fireEvent.change(screen.getByPlaceholderText('Pickup key'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Open delivery details'));
    expect(screen.getByText(/already dispatched: do not leave yet/)).toBeTruthy();
    expect(decryptCalls).toHaveLength(0);

    // another worker's key: the details are loaded and stay closed
    fireEvent.change(screen.getByPlaceholderText('Pickup key'), { target: { value: KEY_WORKER_2 } });
    fireEvent.click(screen.getByText('Open delivery details'));
    await screen.findByText(/not open here yet/);
    expect(screen.getByText(/already dispatched: do not leave yet/)).toBeTruthy();
    expect(screen.queryByText(/Rua São João/)).toBeNull();
    expect(localStorage.getItem(deploymentKey('pickupKeys'))).toBeNull();
    expect(container.querySelector('.details').firstChild.textContent).toMatch(/Scan pickup key/);
  });

  it('opens a dispatched order with the scanned key in one step', async () => {
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    fireEvent.click(screen.getByText('Scan pickup key'));
    await screen.findByText(/Point the camera at the pickup key/);
    act(() => { mockScanners[mockScanners.length - 1].onSuccess(KEY_WORKER_1); });

    await screen.findByText(/Rua São João, 100, apto 3/);
    expect(screen.getByText('Pão de queijo')).toBeTruthy();
    expect(decryptCalls).toEqual([FIRST_SEALED]);
    expect(JSON.parse(localStorage.getItem(deploymentKey('pickupKeys')))).toEqual({ 7: KEY_WORKER_1 });
    expect(screen.queryByText('Scan pickup key')).toBeNull();
  });

  it('says that a dispatched order is still closed, and that a wrong key leaves it closed', async () => {
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    await openMoreDetails();
    await screen.findByText(/The order was dispatched, but the delivery address and the items are not open here yet/);

    fireEvent.change(screen.getByPlaceholderText('Pickup key'), { target: { value: KEY_WORKER_2 } });
    fireEvent.click(screen.getByText('Open delivery details'));
    expect(screen.getByText(/already dispatched: do not leave yet/)).toBeTruthy();
    expect(screen.queryByText(/Rua São João/)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Pickup key'), { target: { value: KEY_WORKER_1 } });
    fireEvent.click(screen.getByText('Open delivery details'));
    expect(screen.getByText(/Rua São João, 100, apto 3/)).toBeTruthy();
    expect(screen.queryByText(/do not leave yet/)).toBeNull();
  });

  it('refuses a key that does not open the details and says so', async () => {
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    await openMoreDetails();
    await screen.findByText(/not open here yet/);

    fireEvent.change(screen.getByPlaceholderText('Pickup key'), { target: { value: KEY_WORKER_2 } });
    fireEvent.click(screen.getByText('Open delivery details'));

    expect(screen.getByText(/does not open the delivery details/)).toBeTruthy();
    expect(screen.queryByText(/Rua São João/)).toBeNull();
    expect(screen.queryByText('Pão de queijo')).toBeNull();
    expect(localStorage.getItem(deploymentKey('pickupKeys'))).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Pickup key'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Open delivery details'));
    expect(screen.getByText(/does not open the delivery details/)).toBeTruthy();
    expect(localStorage.getItem(deploymentKey('pickupKeys'))).toBeNull();
  });

  it('opens with the pasted key and keeps it', async () => {
    const written = [];
    ['log', 'info', 'warn', 'error', 'debug'].forEach((level) => {
      jest.spyOn(console, level).mockImplementation((...args) => { written.push(args); });
    });
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    await openMoreDetails();
    await screen.findByText(/not open here yet/);

    fireEvent.change(screen.getByPlaceholderText('Pickup key'), { target: { value: ' ' + KEY_WORKER_1 + '\n' } });
    fireEvent.click(screen.getByText('Open delivery details'));

    expect(screen.getByText(/Rua São João, 100, apto 3/)).toBeTruthy();
    expect(screen.getByText('Pão de queijo')).toBeTruthy();
    expect(screen.queryByText(/not open here yet/)).toBeNull();
    expect(JSON.parse(localStorage.getItem(deploymentKey('pickupKeys')))).toEqual({ 7: KEY_WORKER_1 });
    expect(decryptCalls).toEqual([FIRST_SEALED]);

    expect(alerts).toHaveLength(0);

    // nothing about the order goes to the console on this path
    expect(written).toEqual([]);
    jest.restoreAllMocks();
  });

  it('opens with a scanned key and ignores QR codes that are not pickup keys', async () => {
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    await openMoreDetails();
    await screen.findByText(/not open here yet/);

    fireEvent.click(screen.getByText('Scan pickup key'));
    await screen.findByText(/Point the camera at the pickup key/);
    const scanner = mockScanners[mockScanners.length - 1];

    act(() => { scanner.onSuccess(SIGNATURE); });
    expect(screen.getByText(/not a pickup key/)).toBeTruthy();
    expect(screen.queryByText(/Rua São João/)).toBeNull();

    act(() => { scanner.onSuccess(KEY_WORKER_1); });
    await screen.findByText(/Rua São João, 100, apto 3/);
    expect(screen.queryByText(/Point the camera/)).toBeNull();
    expect(JSON.parse(localStorage.getItem(deploymentKey('pickupKeys')))).toEqual({ 7: KEY_WORKER_1 });
  });

  it('reopens after a reload with the kept key, when the order is on its way', async () => {
    localStorage.setItem(deploymentKey('pickupKeys'), JSON.stringify({ 7: KEY_WORKER_1 }));
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    await openMoreDetails();

    await screen.findByText(/Rua São João, 100, apto 3/);
    expect(screen.getByText('Pão de queijo')).toBeTruthy();
    expect(decryptCalls).toEqual([FIRST_SEALED]);
  });

  it('reopens with the kept key while the order still waits, as before', async () => {
    localStorage.setItem(deploymentKey('pickupKeys'), JSON.stringify({ 7: KEY_WORKER_1 }));
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    await openMoreDetails();

    await screen.findByText(/Rua São João, 100, apto 3/);
    expect(screen.queryByPlaceholderText('Pickup key')).toBeNull();
  });

  it('asks for the key again when the kept key does not open the details', async () => {
    localStorage.setItem(deploymentKey('pickupKeys'), JSON.stringify({ 7: KEY_WORKER_2 }));
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    await openMoreDetails();

    await screen.findByText(/not open here yet/);
    expect(screen.getByPlaceholderText('Pickup key')).toBeTruthy();
    expect(screen.queryByText(/Rua São João/)).toBeNull();
  });

  it('shows nothing when the sealed text was changed', async () => {
    mockInformation = [FIRST_SEALED, SEALED.slice(0, 40) + (SEALED[40] === 'A' ? 'B' : 'A') + SEALED.slice(41)];
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    await openMoreDetails();
    await screen.findByText(/not open here yet/);

    fireEvent.change(screen.getByPlaceholderText('Pickup key'), { target: { value: KEY_WORKER_1 } });
    fireEvent.click(screen.getByText('Open delivery details'));

    expect(screen.getByText(/does not open the delivery details/)).toBeTruthy();
    expect(screen.queryByText(/Rua São João/)).toBeNull();
  });
});

describe('PastOrder with an order placed before the pickup key existed', () => {
  beforeEach(() => {
    mockInformation = [FIRST_LEGACY, ITEMS_LEGACY];
  });

  it('opens the items and the address with the wallet, as before', async () => {
    const written = [];
    ['log', 'info', 'warn', 'error', 'debug'].forEach((level) => {
      jest.spyOn(console, level).mockImplementation((...args) => { written.push(args); });
    });
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    await openMoreDetails();

    await screen.findByText(/Rua São João, 100, apto 3/);
    expect(screen.getByText('Pão de queijo')).toBeTruthy();
    expect(decryptCalls).toEqual([ITEMS_LEGACY, FIRST_LEGACY]);
    expect(screen.queryByText(/released at pickup/)).toBeNull();
    expect(screen.queryByText('Scan pickup key')).toBeNull();
    expect(localStorage.getItem(deploymentKey('pickupKeys'))).toBeNull();

    // the decrypted items and address do not go to the console
    expect(written).toEqual([]);
    jest.restoreAllMocks();
  });

  it('does not print or show the text of items that are not in a readable format', async () => {
    PLAINTEXT[ITEMS_LEGACY] = 'Rua São João, 100, apto 3; 2 Pão de queijo';
    const written = [];
    ['log', 'info', 'warn', 'error', 'debug'].forEach((level) => {
      jest.spyOn(console, level).mockImplementation((...args) => { written.push(args); });
    });
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    await openMoreDetails();
    await waitFor(() => expect(alerts).toHaveLength(1));
    PLAINTEXT[ITEMS_LEGACY] = JSON.stringify(ITEMS);
    jest.restoreAllMocks();

    expect(alerts[0]).toBe('The content is not in a format this app can open.');
    expect(written).toEqual([['Could not open the delivery details:', 'The content is not in a format this app can open.']]);
  });

  it('signs the pickup without a pickup key', async () => {
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('Confirm pickup'));

    await waitFor(() => expect(mockSigned).toHaveLength(1));
    await screen.findByText(/Pickup confirmation/);
    expect(alerts).toHaveLength(0);
    // no pickup key step is announced for such an order
    expect(screen.getByText(/so that they can dispatch the order/)).toBeTruthy();
    expect(screen.queryByText(/pickup key, which opens/)).toBeNull();
  });

  it('opens a dispatched order with the wallet, and then asks for no key', async () => {
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    await openMoreDetails();

    await screen.findByText(/Rua São João, 100, apto 3/);
    expect(decryptCalls).toEqual([ITEMS_LEGACY, FIRST_LEGACY]);
    expect(screen.queryByText('Scan pickup key')).toBeNull();
    expect(screen.queryByPlaceholderText('Pickup key')).toBeNull();
  });

  it('says so when the customer has not sent the details yet', async () => {
    mockInformation = ['', ''];
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('More details'));

    await waitFor(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]).toMatch(/has not sent the delivery details yet/);
    expect(decryptCalls).toHaveLength(0);
  });

  it('does not sign the pickup while the customer has not sent the details', async () => {
    mockInformation = ['', ''];
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('Confirm pickup'));

    await waitFor(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]).toMatch(/Wait for the customer's details/);
    expect(mockSigned).toHaveLength(0);
    expect(screen.queryByText(/Pickup confirmation/)).toBeNull();

    // once the customer has sent them (here in the older format), the worker can sign
    mockInformation = [FIRST_LEGACY, ITEMS_LEGACY];
    fireEvent.click(screen.getByText('Confirm pickup'));
    await waitFor(() => expect(mockSigned).toHaveLength(1));
    await screen.findByText(/Pickup confirmation/);
    expect(alerts).toHaveLength(1);
  });
});

describe('PastOrder reading the customer\'s details from the Information logs', () => {
  it('asks the log provider for the logs of Storage, by order index and own position', async () => {
    const { STORAGE_ADDRESS, DEPLOY_BLOCK } = require('../../services/config');
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    await openMoreDetails();
    await screen.findByText(/released at pickup/);

    expect(mockLogQueries).toHaveLength(2);
    expect(mockLogQueries[0].address).toBe('0x00000000000000000000000000000000000000aa');
    expect(mockLogQueries[0].fromBlock).toBe(DEPLOY_BLOCK);
    expect(mockLogQueries[1].address).toBe(STORAGE_ADDRESS);
    expect(mockLogQueries[1].topics).toHaveLength(3);
    expect(mockLogQueries[1].topics[1]).toBe('0x' + '0'.repeat(63) + '7');
    expect(mockLogQueries[1].topics[2]).toBe('0x' + '0'.repeat(63) + '1');
  });

  it('gives a second worker the post made for them, not the first worker\'s', async () => {
    mockPosition = 2;
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    await openMoreDetails();
    await screen.findByText(/not open here yet/);

    expect(decryptCalls).toEqual([FIRST_SEALED]);
    expect(mockLogQueries[1].topics[2]).toBe('0x' + '0'.repeat(63) + '2');
    fireEvent.change(screen.getByPlaceholderText('Pickup key'), { target: { value: KEY_WORKER_1 } });
    fireEvent.click(screen.getByText('Open delivery details'));
    expect(screen.getByText(/Rua São João, 100, apto 3/)).toBeTruthy();
  });

  it('does not let a second worker sign while the customer has posted for the first worker only', async () => {
    mockPosition = 2;
    mockInformation = ['', ''];
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('Confirm pickup'));

    await waitFor(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]).toMatch(/Wait for the customer's details/);
    expect(mockSigned).toHaveLength(0);
    expect(decryptCalls).toHaveLength(0);
  });

  it('neither signs nor decrypts for an account the order\'s logs do not name as a worker', async () => {
    mockPosition = 0;
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('Confirm pickup'));
    await waitFor(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]).toMatch(/Your commitment to this order was not found/);

    fireEvent.click(screen.getByText('More details'));
    await waitFor(() => expect(alerts).toHaveLength(2));
    expect(alerts[1]).toMatch(/Your commitment to this order was not found/);
    expect(mockSigned).toHaveLength(0);
    expect(decryptCalls).toHaveLength(0);
    // only the order's own logs were read
    expect(mockLogQueries.every((query) => query.address === '0x00000000000000000000000000000000000000aa')).toBe(true);
  });
});

describe('PastOrder when the worker leaves an order', () => {
  it('tells a first worker what leaving before pickup means, and sends nothing if they decline', async () => {
    // committed a minute ago
    const block = orderBlock('WAITING');
    block[7] = String(Math.floor(Date.now() / 1000) - 60);
    render(<PastOrder restaurant={null} orderBlock={block} />);
    fireEvent.click(screen.getByText('Give up this delivery'));

    await waitFor(() => expect(confirms).toHaveLength(1));
    expect(confirms[0]).toMatch(/goes back to the open orders, for another worker/);
    expect(confirms[0]).toMatch(/counted on your public record/);
    expect(confirms[0]).toMatch(/The establishment will be able to rate you/);
    await screen.findByText('Give up this delivery');
    expect(mockCancelled).toHaveLength(0);
  });

  it('tells a first worker who committed more than an hour ago that the order ends', async () => {
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('Give up this delivery'));

    await waitFor(() => expect(confirms).toHaveLength(1));
    expect(confirms[0]).toMatch(/The order ends/);
    expect(confirms[0]).toMatch(/The establishment will be able to rate you/);
  });

  it('tells a second worker that the order ends', async () => {
    mockPosition = 2;
    const block = orderBlock('WAITING');
    block[7] = String(Math.floor(Date.now() / 1000) - 60);
    render(<PastOrder restaurant={null} orderBlock={block} />);
    fireEvent.click(screen.getByText('Give up this delivery'));

    await waitFor(() => expect(confirms).toHaveLength(1));
    expect(confirms[0]).toMatch(/The order ends/);
    expect(confirms[0]).toMatch(/The establishment will be able to rate you/);
    expect(mockCancelled).toHaveLength(0);
  });

  it('says after pickup that the customer and the establishment can rate them', async () => {
    mockChainStatus = 'DISPATCHED';
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    fireEvent.click(screen.getByText(/Cancel my order/));

    await waitFor(() => expect(confirms).toHaveLength(1));
    expect(confirms[0]).toMatch(/Both the customer and the establishment will be able to rate you/);
    // the position is not needed after pickup: no log is read
    expect(mockLogQueries).toHaveLength(0);
    expect(mockCancelled).toHaveLength(0);
  });

  it('reads the step again before the notice: a card that has not followed the dispatch yet says both can rate', async () => {
    // the card still shows WAITING; the establishment has just dispatched
    mockChainStatus = 'DISPATCHED';
    const block = orderBlock('WAITING');
    block[7] = String(Math.floor(Date.now() / 1000) - 60);
    render(<PastOrder restaurant={null} orderBlock={block} />);
    fireEvent.click(screen.getByText('Give up this delivery'));

    await waitFor(() => expect(confirms).toHaveLength(1));
    expect(confirms[0]).toMatch(/Cancel this delivery\? The order ends/);
    expect(confirms[0]).toMatch(/Both the customer and the establishment will be able to rate you/);
    expect(confirms[0]).not.toMatch(/goes back to the open orders/);
    expect(mockCancelled).toHaveLength(0);
    // the card follows the chain
    await screen.findByText(/Cancel my order/);
  });

  it('sends nothing and asks nothing when the order is no longer theirs', async () => {
    mockChainStatus = 'PREPARATION';
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('Give up this delivery'));

    await waitFor(() => expect(alerts).toHaveLength(1));
    expect(alerts[0]).toMatch(/no longer yours to leave\. Nothing was sent/);
    expect(confirms).toHaveLength(0);
    expect(mockCancelled).toHaveLength(0);
  });

  it('sends the cancellation once they confirm', async () => {
    // the page reload that follows is not implemented in the test environment
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    confirmAnswer = true;
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('Give up this delivery'));

    await waitFor(() => expect(mockCancelled).toEqual(['0x00000000000000000000000000000000000000aa']));
    expect(confirms).toHaveLength(1);
    await screen.findByText('Give up this delivery');
    jest.restoreAllMocks();
  });
});

describe('PastOrder: gas of the worker\'s transactions', () => {
  it('says near the buttons when leaving costs more gas', () => {
    const waiting = render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    expect(screen.getByText(GIVE_UP_GAS_NOTE)).toBeTruthy();
    expect(GIVE_UP_GAS_NOTE).toMatch(/second worker/);
    expect(GIVE_UP_GAS_NOTE).toMatch(/returns the establishment's money to the payment pool and costs more gas than the other steps/);
    waiting.unmount();

    const dispatched = render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    expect(screen.getByText(CANCEL_GAS_NOTE)).toBeTruthy();
    expect(CANCEL_GAS_NOTE).toMatch(/returns the establishment's money to the payment pool/);
    expect(CANCEL_GAS_NOTE).toMatch(/more gas than the other steps/);
    dispatched.unmount();

    render(<PastOrder restaurant={null} orderBlock={orderBlock('CONCLUDED')} />);
    expect(screen.queryByText(/payment pool/)).toBeNull();
  });

  it('repeats it in the question when the leaving ends the order, and not when the order is offered again', async () => {
    mockPosition = 2;
    const block = orderBlock('WAITING');
    block[7] = String(Math.floor(Date.now() / 1000) - 60);
    const second = render(<PastOrder restaurant={null} orderBlock={block} />);
    fireEvent.click(screen.getByText('Give up this delivery'));
    await waitFor(() => expect(confirms).toHaveLength(1));
    expect(confirms[0]).toContain(ENDING_GAS_NOTE);
    await screen.findByText('Give up this delivery');
    second.unmount();

    mockPosition = 1;
    render(<PastOrder restaurant={null} orderBlock={block} />);
    fireEvent.click(screen.getByText('Give up this delivery'));
    await waitFor(() => expect(confirms).toHaveLength(2));
    expect(confirms[1]).not.toMatch(/payment pool/);
    await screen.findByText('Give up this delivery');
  });

  it('sends the leaving with the estimate and its margin, never a fixed limit', async () => {
    mockChainStatus = 'DISPATCHED';
    mockEstimate = () => Promise.resolve(1017253);
    confirmAnswer = true;
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    fireEvent.click(screen.getByText(/Cancel my order/));
    await waitFor(() => expect(mockSent).toHaveLength(1));
    expect(mockEstimates).toEqual([['cancelOrder', { from: WORKER }]]);
    expect(mockSent[0]).toEqual(['cancelOrder', { from: WORKER, gas: 1271567 }]);
    expect(alerts).toEqual([]);
  });

  it('sends nothing and shows the contract\'s reason when the estimate says the leaving would fail', async () => {
    mockEstimate = () => Promise.reject(new Error("VM Exception while processing transaction: reverted with reason string 'This caller is unauthorized'"));
    confirmAnswer = true;
    const written = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args) => { written.push(args); });
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('Give up this delivery'));
    await waitFor(() => expect(alerts).toHaveLength(1));
    spy.mockRestore();
    expect(alerts[0]).toMatch(/not a party of this order/);
    expect(mockSent).toEqual([]);
    expect(mockCancelled).toEqual([]);
    expect(written).toEqual([['Leaving the order failed:', alerts[0]]]);
    // the card is back
    await screen.findByText('Give up this delivery');
  });

  it('sends the delivery with the estimate and its margin', async () => {
    mockEstimate = () => Promise.resolve(1478408);
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    fireEvent.change(screen.getByPlaceholderText("Customer's delivery confirmation"), { target: { value: SIGNATURE } });
    fireEvent.click(screen.getByText(/Delivery order/));
    await waitFor(() => expect(mockSent).toHaveLength(1));
    expect(mockEstimates).toEqual([['deliveryOrder', { from: WORKER }]]);
    expect(mockSent[0]).toEqual(['deliveryOrder', { from: WORKER, gas: 1848010 }, SIGNATURE]);
  });

  it('shows the reason and sends no delivery when the estimate reverts', async () => {
    mockEstimate = () => Promise.reject(new Error("execution reverted: Invalid delivery confirmation"));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    fireEvent.change(screen.getByPlaceholderText("Customer's delivery confirmation"), { target: { value: SIGNATURE } });
    fireEvent.click(screen.getByText(/Delivery order/));
    await waitFor(() => expect(alerts).toHaveLength(1));
    spy.mockRestore();
    expect(alerts[0]).toMatch(/not the customer's confirmation/);
    expect(mockSent).toEqual([]);
  });
});

describe('PastOrder: "More details" when something else than the wallet or a contract fails', () => {
  it('shows and prints a fixed text, not the message of the error', async () => {
    const original = window.ethereum.request;
    window.ethereum.request = (call) => (call.method === 'eth_decrypt'
      ? Promise.reject(new Error('bad payload: Rua das Flores 123, ap 45'))
      : original(call));
    const written = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args) => { written.push(args); });
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('More details'));
    await waitFor(() => expect(alerts).toHaveLength(1));
    spy.mockRestore();
    expect(alerts[0]).toBe('The details of this order could not be opened.');
    expect(written).toEqual([['Could not open the delivery details:', 'The details of this order could not be opened.']]);
    expect(JSON.stringify(written) + alerts[0]).not.toMatch(/Rua|Flores|bad payload/);
  });

  it('still names a refusal in the wallet', async () => {
    const original = window.ethereum.request;
    window.ethereum.request = (call) => (call.method === 'eth_decrypt'
      ? Promise.reject(Object.assign(new Error('MetaMask Decryption: User denied message decryption.'), { code: 4001 }))
      : original(call));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<PastOrder restaurant={null} orderBlock={orderBlock('WAITING')} />);
    fireEvent.click(screen.getByText('More details'));
    await waitFor(() => expect(alerts).toHaveLength(1));
    spy.mockRestore();
    expect(alerts[0]).toBe('Transaction was rejected in MetaMask.');
  });
});

describe('PastOrder: pickup keys of another deployment', () => {
  it('does not open order 7 with the key kept for order 7 of another chain or under the old name', async () => {
    // kept on Sepolia, and before the keys were kept per deployment
    setDeployment(11155111);
    localStorage.setItem(deploymentKey('pickupKeys'), JSON.stringify({ 7: KEY_WORKER_1 }));
    localStorage.setItem('pickupKeys', JSON.stringify({ 7: KEY_WORKER_1 }));
    setDeployment(CHAIN_ID);
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    await openMoreDetails();
    await screen.findByText(/not open here yet/);
    expect(screen.queryByText(/Rua São João/)).toBeNull();

    // the key given now is kept for this deployment only
    fireEvent.change(screen.getByPlaceholderText('Pickup key'), { target: { value: KEY_WORKER_1 } });
    fireEvent.click(screen.getByText('Open delivery details'));
    await screen.findByText(/Rua São João, 100, apto 3/);
    expect(JSON.parse(localStorage.getItem(deploymentKey('pickupKeys')))).toEqual({ 7: KEY_WORKER_1 });
    expect(JSON.parse(localStorage.getItem('pickupKeys'))).toEqual({ 7: KEY_WORKER_1 });
    expect(Object.keys(localStorage)).toHaveLength(3);
  });

  it('follows the wallet\'s network: the key kept on the chain the wallet is on now is the one used', async () => {
    setDeployment(11155111);
    localStorage.setItem(deploymentKey('pickupKeys'), JSON.stringify({ 7: KEY_WORKER_1 }));
    // the page was loaded on a local chain; the wallet is on Sepolia when the details are opened
    setDeployment(CHAIN_ID);
    mockChainId = '0xaa36a7';
    render(<PastOrder restaurant={null} orderBlock={orderBlock('DISPATCHED')} />);
    await openMoreDetails();
    await screen.findByText(/Rua São João, 100, apto 3/);
  });
});
