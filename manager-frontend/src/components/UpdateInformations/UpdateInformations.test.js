import React from 'react';
import { render, fireEvent, wait } from '@testing-library/react';

import UpdateInformations from './index';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ put: jest.fn() }));

const SPEND = '0x02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
const VIEW = '0x03112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00';
const ENC = 'fTm2aWc1TnE0dXJ5ZGtWb1hPdGZxY0p1b2pBbUJxWnE=';

const record = {
  id: 7,
  restaurant_name: 'Cantina',
  public_key: ENC,
  spend_public_key: SPEND,
  view_public_key: VIEW,
};

// Stand-in for MetaMask: counts the requests and answers the encryption key given
function fakeWallet(encryptionKey) {
  const calls = [];
  window.ethereum = {
    request: jest.fn(async ({ method }) => {
      calls.push(method);
      if (method === 'eth_requestAccounts') return ['0x00000000000000000000000000000000000000Aa'];
      if (method === 'eth_getEncryptionPublicKey') return encryptionKey;
      throw new Error('unexpected ' + method);
    }),
  };
  return calls;
}

afterEach(() => {
  localStorage.clear();
  delete window.ethereum;
});

describe('UpdateInformations access', () => {
  it('opens without asking the wallet when this browser holds the published stealth keys', () => {
    const calls = fakeWallet(ENC);
    localStorage.setItem('restaurantSpendKey', JSON.stringify({ publicKeyCompressed: SPEND, viewPublicKeyCompressed: VIEW }));
    const { getByText, queryByText } = render(<UpdateInformations response={record} />);
    expect(getByText('Basic informations')).toBeTruthy();
    expect(queryByText('Check wallet')).toBe(null);
    expect(calls).toEqual([]);
  });

  it('asks nothing of the wallet on load and opens after the account shows the published encryption key', async () => {
    const calls = fakeWallet(ENC);
    const { getByText, queryByText } = render(<UpdateInformations response={record} />);
    expect(queryByText('Basic informations')).toBe(null);
    expect(calls).toEqual([]);
    fireEvent.click(getByText('Check wallet'));
    await wait(() => expect(getByText('Basic informations')).toBeTruthy());
    expect(calls).toEqual(['eth_requestAccounts', 'eth_getEncryptionPublicKey']);
  });

  it('stays closed for another account, and no key is created in this browser', async () => {
    fakeWallet('b3RoZXIgYWNjb3VudCBlbmNyeXB0aW9uIGtleSAwMDAwMDA=');
    const { getByText, queryByText } = render(<UpdateInformations response={{ ...record, spend_public_key: '', view_public_key: '' }} />);
    fireEvent.click(getByText('Check wallet'));
    await wait(() => expect(getByText(/not the one used to register/)).toBeTruthy());
    expect(queryByText('Generate Stealth Spend Key')).toBe(null);
    expect(localStorage.getItem('restaurantSpendKey')).toBe(null);
  });

  it('lets the registered account generate stealth keys when none is published', async () => {
    fakeWallet(ENC);
    const { getByText } = render(<UpdateInformations response={{ ...record, spend_public_key: '', view_public_key: '' }} />);
    fireEvent.click(getByText('Check wallet'));
    await wait(() => expect(getByText('Generate Stealth Spend Key')).toBeTruthy());
  });

  it('waits for the record', () => {
    const { getByText } = render(<UpdateInformations response={''} />);
    expect(getByText('Loading...')).toBeTruthy();
  });
});

describe('UpdateInformations save', () => {
  it('logs only the message of a failed save, not the request', async () => {
    localStorage.setItem('restaurantSpendKey', JSON.stringify({ publicKeyCompressed: SPEND, viewPublicKeyCompressed: VIEW }));
    localStorage.setItem('authorization', 'Bearer session-token');
    const failure = Object.assign(new Error('Request failed with status code 500'), {
      config: { headers: { authorization: 'Bearer session-token' }, data: '{"restaurant_address":"Rua A, 1"}' },
    });
    api.put.mockRejectedValue(failure);
    const logged = [];
    const error = jest.spyOn(console, 'error').mockImplementation((...args) => { logged.push(args); });
    const log = jest.spyOn(console, 'log').mockImplementation((...args) => { logged.push(args); });

    const full = { ...record, restaurant_city: 'Recife', restaurant_address: 'Rua A, 1', culinary: 'Bakery', latitude: -8.05, longitude: -34.9 };
    const { getByText } = render(<UpdateInformations response={full} />);
    fireEvent.click(getByText('Submit'));
    await wait(() => expect(api.put).toHaveBeenCalledTimes(1));
    await wait(() => expect(logged.length).toBeGreaterThan(0));
    error.mockRestore();
    log.mockRestore();

    const ours = logged.filter((args) => args[0] === 'Restaurant update failed:');
    expect(ours).toEqual([['Restaurant update failed:', 'Request failed with status code 500']]);
    expect(JSON.stringify(logged)).not.toContain('session-token');
    expect(JSON.stringify(logged)).not.toContain('Rua A');
  });
});
