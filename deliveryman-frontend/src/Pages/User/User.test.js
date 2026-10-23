import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import User from './index';

// Fakes of the wallet and the contracts. Plain functions instead of jest.fn(),
// because CRA resets mock implementations before each test.
const mockOrders = {};
const mockRatings = {};
let mockRecord = null;
let mockLogs = [];
const mockAsked = [];

jest.mock('../../services/getWeb3', () => {
  const contracts = {
    chain: {
      methods: {
        isOrder: (address) => ({ call: () => Promise.resolve(!!mockOrders[address]) }),
        getOrder: (address) => ({
          call: () => {
            mockAsked.push(address);
            return Promise.resolve(mockOrders[address]);
          },
        }),
      },
    },
    logWeb3: { eth: { getPastLogs: () => Promise.resolve(mockLogs) } },
    reputation: {
      methods: {
        workers: () => ({ call: () => Promise.resolve(mockRecord) }),
        orderRatings: (address) => ({ call: () => Promise.resolve(mockRatings[address]) }),
      },
    },
  };
  return { useWeb3: () => contracts };
});

jest.mock('../../Components/Header', () => () => null);
jest.mock('../../Components/PastOrder', () => ({ orderBlock }) => <div>card of order {orderBlock[0]} ({orderBlock[3]})</div>);

const WORKER = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const ACTIVE = '0x00000000000000000000000000000000000000a1';
const REOPENED = '0x00000000000000000000000000000000000000a2';
const TAKEN_BY_OTHER = '0x00000000000000000000000000000000000000a3';
const CANCELLED_AFTER_PICKUP = '0x00000000000000000000000000000000000000a4';
const CONCLUDED = '0x00000000000000000000000000000000000000a5';
const LOOK_ALIKE = '0x00000000000000000000000000000000000000ff';
const NEVER_TAKEN = '0x00000000000000000000000000000000000000a6';
const CUSTOMER = '0x00000000000000000000000000000000000000d1';
const SHOP = '0x00000000000000000000000000000000000000d2';

function view(id, status) {
  const empty = status === '';
  return {
    0: String(id), 1: '', 2: empty ? '0' : '1000', 3: status, 4: '0x0000000000000000000000000000000000000000',
    5: '0', 6: empty ? '0' : '1760000000', 7: empty ? '0' : '1760000100', 8: '0x0000000000000000000000000000000000000000', 9: '0', 10: '0',
  };
}

// An OrderActors log as an order emits it: about itself, with this worker in the last topic.
// `emitter` is given only for the log of another contract that names an order.
function log(address, emitter) {
  const topic = (account) => '0x' + '0'.repeat(24) + account.slice(2);
  return {
    address: typeof emitter === 'string' ? emitter : address,
    topics: ['0x3aab3448479337ae16f6a4a2ab87a664e7aad6b0c280f483bf1be0c16f888643', topic(CUSTOMER), topic(SHOP), topic(WORKER)],
    data: topic(address),
  };
}

beforeEach(() => {
  Object.keys(mockOrders).forEach((key) => delete mockOrders[key]);
  Object.keys(mockRatings).forEach((key) => delete mockRatings[key]);
  mockAsked.length = 0;
  mockRecord = { totalScore: '9', totalRatings: '2', completedOrders: '1', leftOrders: '3', ratingsAfterLeaving: '1' };
  mockOrders[ACTIVE] = view(1, 'WAITING');
  mockOrders[REOPENED] = view(2, 'PREPARATION');
  mockOrders[TAKEN_BY_OTHER] = view(3, '');
  mockOrders[CANCELLED_AFTER_PICKUP] = view(4, 'CANCELED BY FIRST DELIVERYMAN');
  mockOrders[CONCLUDED] = view(5, 'CONCLUDED');
  mockRatings[REOPENED] = { outcome: '1', byClient: '0', byEstablishment: '0' };
  mockRatings[TAKEN_BY_OTHER] = { outcome: '1', byClient: '0', byEstablishment: '2' };
  mockRatings[CANCELLED_AFTER_PICKUP] = { outcome: '2', byClient: '1', byEstablishment: '0' };
  mockLogs = [ACTIVE, REOPENED, LOOK_ALIKE, TAKEN_BY_OTHER, CANCELLED_AFTER_PICKUP, CONCLUDED, ACTIVE].map((address) => log(address));
  window.ethereum = {
    request: ({ method }) => (method === 'eth_accounts' ? Promise.resolve([WORKER]) : Promise.reject(new Error('unexpected ' + method))),
  };
});

describe('the worker\'s page', () => {
  it('shows the public record: average, ratings, deliveries, leavings, ratings after leaving', async () => {
    render(<User />);
    await screen.findByText('4.5 ★ (2 ratings)');
    expect(screen.getByText('Completed deliveries: 1')).toBeTruthy();
    expect(screen.getByText('Orders you left: 3')).toBeTruthy();
    expect(screen.getByText('Ratings received after leaving: 1')).toBeTruthy();
  });

  it('lists the active order and asks nothing about an address Chain does not know', async () => {
    render(<User />);
    await screen.findByText('card of order 1 (WAITING)');
    expect(mockAsked).not.toContain(LOOK_ALIKE);
    expect(mockAsked).toHaveLength(5);
    expect(screen.queryByText(/You left this order/)).toBeNull();
  });

  it('lists the orders the worker left as lines, without an order card', async () => {
    render(<User />);
    await screen.findByText('card of order 1 (WAITING)');
    fireEvent.click(screen.getByText('Past'));

    expect(screen.getByText('card of order 5 (CONCLUDED)')).toBeTruthy();
    expect(screen.getByText('card of order 4 (CANCELED BY FIRST DELIVERYMAN)')).toBeTruthy();
    expect(screen.queryByText(/card of order 2/)).toBeNull();
    expect(screen.queryByText(/card of order 3/)).toBeNull();

    expect(screen.getByText('Order 2')).toBeTruthy();
    expect(screen.getByText(/left this order before pickup\. Only the establishment can rate you for it: it has not rated you/)).toBeTruthy();
    expect(screen.getByText('Order 3')).toBeTruthy();
    expect(screen.getByText(/it rated you 2 ★/)).toBeTruthy();
    expect(screen.getByText('Order 4')).toBeTruthy();
    expect(screen.getByText(/left this order after pickup\. The customer rated you 1 ★; the establishment has not rated you/)).toBeTruthy();
    // the delivered order has no such line
    expect(screen.queryByText('Order 5')).toBeNull();
  });

  it('still lists a left order when the reputation contract does not answer', async () => {
    delete mockRatings[TAKEN_BY_OTHER];
    render(<User />);
    await screen.findByText('card of order 1 (WAITING)');
    fireEvent.click(screen.getByText('Past'));
    expect(screen.getByText('Order 3')).toBeTruthy();
    expect(screen.getByText(/You are no longer the worker of this order/)).toBeTruthy();
  });

  it('adds no line for a real order that only a log of another contract links to the worker', async () => {
    // an order of this Chain the worker never committed to; the public view answers them
    mockOrders[NEVER_TAKEN] = view(6, '');
    mockLogs.push(log(NEVER_TAKEN, LOOK_ALIKE));
    render(<User />);
    await screen.findByText('card of order 1 (WAITING)');
    fireEvent.click(screen.getByText('Past'));

    expect(screen.getByText('Order 3')).toBeTruthy();
    expect(screen.queryByText('Order 6')).toBeNull();
    expect(mockAsked).not.toContain(NEVER_TAKEN);
    expect(mockAsked).toHaveLength(5);
  });

  it('says so when there is no ratings yet', async () => {
    mockRecord = { totalScore: '0', totalRatings: '0', completedOrders: '0', leftOrders: '0', ratingsAfterLeaving: '0' };
    render(<User />);
    await screen.findByText('No ratings yet');
    expect(screen.getByText('Orders you left: 0')).toBeTruthy();
  });
});
