import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import OrderItem from './index';
import { STORAGE_ADDRESS, REPUTATION_ADDRESS } from '../../services/config';

const WORKER = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const ORDER = '0x00000000000000000000000000000000000000aa';
const ENCRYPTION_KEY = 'q3wGQ3yBqBJ7UG0Yj3vS1VYg6zYqg3zqgk1l6w3n0kE=';

let trace;
let estimate;
let alerts;

// Chain as the card uses it. `estimate` is what the node answers for confirmIntention.
function fakeChain() {
  return {
    methods: {
      findAddress: () => ({ call: () => Promise.resolve(ORDER) }),
      confirmIntention: (...args) => ({
        estimateGas: (options) => { trace.push(['estimate', options]); return estimate(); },
        send: (options) => { trace.push(['confirmIntention', args, options]); return Promise.resolve({}); },
      }),
    },
  };
}

// The order names the deployed reputation contract
const web3 = {
  eth: {
    Contract: function () {
      this.methods = { reputationContract: () => ({ call: () => Promise.resolve(REPUTATION_ADDRESS) }) };
    },
  },
};

const order = ['7', '', '1000000000000000', 'PREPARATION', '0x00000000000000000000000000000000000000bb', '0', '1760000000', '1760000100',
  '0x0000000000000000000000000000000000000000', '0', '0'];

function renderCard(history) {
  return render(<OrderItem order={order} total="5000000000000000" restaurant={null} zone="zone-1" chain={fakeChain()}
    history={history} web3={web3} ownReputation={null} />);
}

beforeEach(() => {
  trace = [];
  estimate = () => Promise.resolve(936517);
  alerts = [];
  window.alert = (text) => { alerts.push(text); };
  window.ethereum = {
    request: ({ method }) => Promise.resolve(method === 'eth_getEncryptionPublicKey' ? ENCRYPTION_KEY : [WORKER]),
  };
});

afterEach(() => { delete window.ethereum; });

describe('OrderItem: taking an order', () => {
  it('sends confirmIntention with the node\'s estimate and its margin, never a fixed limit', async () => {
    const history = { push: jest.fn() };
    renderCard(history);
    fireEvent.click(screen.getByText('Accept delivery'));
    await waitFor(() => expect(history.push).toHaveBeenCalledWith('/user'));
    expect(trace[0]).toEqual(['estimate', { from: WORKER }]);
    expect(trace[1][0]).toBe('confirmIntention');
    expect(trace[1][1].slice(0, 3)).toEqual([ORDER, '7', STORAGE_ADDRESS]);
    expect(trace[1][2]).toEqual({ from: WORKER, gas: 1170647 });
    expect(alerts).toEqual([]);
  });

  it('sends nothing, shows the contract\'s reason and prints a message, not the error object', async () => {
    const revert = Object.assign(
      new Error("VM Exception while processing transaction: reverted with reason string 'Deliveryman has no ratings yet'"),
      { data: { from: WORKER } });
    estimate = () => Promise.reject(revert);
    const written = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...args) => { written.push(args); });
    const history = { push: jest.fn() };
    renderCard(history);
    fireEvent.click(screen.getByText('Accept delivery'));
    await waitFor(() => expect(alerts).toHaveLength(1));
    spy.mockRestore();
    expect(alerts[0]).toMatch(/this account has no ratings yet/);
    expect(trace.filter(entry => entry[0] === 'confirmIntention')).toEqual([]);
    expect(written).toEqual([['Taking the order failed:', alerts[0]]]);
    expect(history.push).not.toHaveBeenCalled();
    await screen.findByText('Accept delivery');
  });
});
