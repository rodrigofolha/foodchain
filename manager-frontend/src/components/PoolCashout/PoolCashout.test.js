/* global BigInt */
import React from 'react';
import { render, screen, fireEvent, wait } from '@testing-library/react';

import PoolCashout from './index';
import { storePaymentNote, computePaymentCommitment } from '../../utils/zkWithdraw';
import { runCashout, checkPendingCashouts, addPendingWithdrawal, dropPendingWithdrawal, setAsidePendingCashouts } from '../../utils/cashout';
import { deploymentKey } from '../../utils/deploymentStorage';

// The planning and the note records are the real ones; nothing is proved or sent.
jest.mock('../../utils/cashout', () => Object.assign({}, jest.requireActual('../../utils/cashout'), { runCashout: jest.fn(), checkPendingCashouts: jest.fn() }));

const usd = (x) => BigInt(Math.round(x * 100)) * 10n ** 13n;
const ACCOUNT = '0x00000000000000000000000000000000000000e1';
const web3 = { eth: { Contract: function () {} } };

let seq = 0;
function store(amount, revenue) {
  seq += 1;
  const commitment = computePaymentCommitment(seq, seq + 500).toString();
  storePaymentNote({ nullifier: seq, trapdoor: seq + 500, amount: amount.toString(), leafIndex: seq, commitment: commitment });
  if (revenue) {
    const secrets = JSON.parse(localStorage.getItem(deploymentKey('paymentNoteSecrets')) || '{}');
    secrets['order-' + seq] = { nullifier: String(seq), trapdoor: String(seq + 500), commitment: commitment, claimed: true };
    localStorage.setItem(deploymentKey('paymentNoteSecrets'), JSON.stringify(secrets));
  }
}

const summary = () => screen.getByTestId('cashout-summary').textContent;

beforeEach(() => {
  localStorage.clear();
  runCashout.mockReset();
  checkPendingCashouts.mockReset();
  window.ethereum = { request: jest.fn(async () => [ACCOUNT]) };
});

describe('PoolCashout', () => {
  it('shows nothing to do below five notes received from orders, and does not touch the wallet', () => {
    store(usd(200), false);
    [30, 25, 40].forEach((x) => store(usd(x), true));
    render(<PoolCashout web3={web3} logWeb3={{}} />);

    expect(summary()).toBe('Nothing to cash out yet: 3 of 5 notes received from orders since the last cash-out.');
    expect(screen.getByText('Cash out').disabled).toBe(true);
    expect(screen.getByText(/Every withdrawal is exactly U\$10.00/)).toBeTruthy();
    expect(window.ethereum.request).not.toHaveBeenCalled();
  });

  it('shows what the policy cashes out and runs it with one button', async () => {
    store(usd(200), false);
    [12, 9.5, 8, 3, 2.5].forEach((x) => store(usd(x), true));
    runCashout.mockImplementation(async (params) => {
      params.onStep({ index: 0, total: 2, type: 'withdraw', amount: usd(10).toString(), status: 'proving' });
      params.onStep({ index: 0, total: 2, type: 'withdraw', amount: usd(10).toString(), status: 'done', txHash: '0xabcdef0123456789' });
      params.onStep({ index: 1, total: 2, type: 'withdraw', amount: usd(10).toString(), status: 'failed', error: 'User denied transaction signature' });
      throw new Error('User denied transaction signature');
    });
    render(<PoolCashout web3={web3} logWeb3={{}} />);

    expect(screen.getByText(/Received from orders, waiting in the pool/).parentNode.textContent).toContain('U$35.00');
    expect(summary()).toBe('Cash-out now: 3 withdrawals of U$10.00 to your wallet (U$30.00 in total). U$5.00 stays in the pool for the next cash-out.');

    fireEvent.click(screen.getByText('Cash out 3 x U$10.00'));
    await wait(() => expect(screen.getByText(/No funds were lost/)).toBeTruthy());

    expect(runCashout).toHaveBeenCalledTimes(1);
    expect(runCashout.mock.calls[0][0]).toMatchObject({ account: ACCOUNT, all: false });
    expect(screen.getByText(/Step 1 of 2/).textContent).toContain('Withdrawal of U$10.00: done (0xabcdef0123...)');
    expect(screen.getByText(/Step 2 of 2/).textContent).toContain('failed: Transaction was rejected in MetaMask.');
  });

  it('withdraws everything only after a warning that it makes the orders traceable', async () => {
    store(usd(200), false);
    store(usd(30), true);
    runCashout.mockResolvedValue([]);
    render(<PoolCashout web3={web3} logWeb3={{}} />);

    fireEvent.click(screen.getByText('Withdraw everything...'));
    expect(runCashout).not.toHaveBeenCalled();
    expect(screen.getByText('This makes your orders traceable.')).toBeTruthy();
    expect(screen.getByText(/whole pool balance \(U\$230.00\)/)).toBeTruthy();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('This makes your orders traceable.')).toBeNull();
    expect(runCashout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Withdraw everything...'));
    fireEvent.click(screen.getByText('Withdraw everything anyway'));
    await wait(() => expect(runCashout).toHaveBeenCalledTimes(1));
    expect(runCashout.mock.calls[0][0]).toMatchObject({ account: ACCOUNT, all: true });
  });

  describe('while a withdrawal is waiting to be mined', () => {
    const PENDING = { spent: ['1'], nullifierHash: '5', change: { nullifier: '7', trapdoor: '8', amount: '0' }, changeLeaf: '99', withdrawAmount: usd(10).toString(), all: false };

    function fill() {
      store(usd(200), false);
      [12, 9.5, 8, 3, 2.5].forEach((x) => store(usd(x), true));
    }

    it('disables both buttons, says why, and sends nothing', () => {
      fill();
      addPendingWithdrawal(PENDING);
      render(<PoolCashout web3={web3} logWeb3={{}} />);

      expect(screen.getByTestId('cashout-pending').textContent).toMatch(/waiting to be mined/);
      const cashOut = screen.getByText('Cash out 3 x U$10.00');
      expect(cashOut.disabled).toBe(true);
      expect(screen.getByText('Withdraw everything...').disabled).toBe(true);
      fireEvent.click(cashOut);
      fireEvent.click(screen.getByText('Withdraw everything...'));
      expect(screen.queryByText('This makes your orders traceable.')).toBeNull();
      expect(runCashout).not.toHaveBeenCalled();
      expect(window.ethereum.request).not.toHaveBeenCalled();
    });

    it('Check again only reconciles, and keeps the buttons disabled while it is still waiting', async () => {
      fill();
      addPendingWithdrawal(PENDING);
      checkPendingCashouts.mockResolvedValue({ settled: 0, pending: true });
      render(<PoolCashout web3={web3} logWeb3={{}} />);

      fireEvent.click(screen.getByText('Check again'));
      await wait(() => expect(screen.getByTestId('cashout-check').textContent).toMatch(/Still waiting to be mined/));
      expect(checkPendingCashouts).toHaveBeenCalledTimes(1);
      expect(runCashout).not.toHaveBeenCalled();
      expect(window.ethereum.request).not.toHaveBeenCalled();
      expect(screen.getByText('Cash out 3 x U$10.00').disabled).toBe(true);
      expect(screen.getByText('Check again')).toBeTruthy();
    });

    it('enables the buttons again once the check has recorded the withdrawal', async () => {
      fill();
      addPendingWithdrawal(PENDING);
      checkPendingCashouts.mockImplementation(async () => {
        dropPendingWithdrawal(PENDING.changeLeaf);
        return { settled: 1, pending: false };
      });
      render(<PoolCashout web3={web3} logWeb3={{}} />);

      fireEvent.click(screen.getByText('Check again'));
      await wait(() => expect(screen.queryByTestId('cashout-pending')).toBeNull());
      expect(screen.getByTestId('cashout-check').textContent).toMatch(/was mined and is recorded now/);
      expect(screen.getByText('Cash out 3 x U$10.00').disabled).toBe(false);
      expect(screen.queryByText('Check again')).toBeNull();
      expect(runCashout).not.toHaveBeenCalled();
    });

    it('says so when the check could not be made', async () => {
      fill();
      addPendingWithdrawal(PENDING);
      checkPendingCashouts.mockRejectedValue(new Error('network'));
      render(<PoolCashout web3={web3} logWeb3={{}} />);

      fireEvent.click(screen.getByText('Check again'));
      await wait(() => expect(screen.getByTestId('cashout-check').textContent).toMatch(/Could not check/));
      expect(screen.getByText('Cash out 3 x U$10.00').disabled).toBe(true);
    });

    it('offers to set it aside only after a check left it waiting, with a warning, and sends nothing', async () => {
      fill();
      addPendingWithdrawal(PENDING);
      checkPendingCashouts.mockResolvedValue({ settled: 0, pending: true, resent: 0, refused: '', aside: 0 });
      render(<PoolCashout web3={web3} logWeb3={{}} />);
      expect(screen.queryByText('Set it aside...')).toBeNull();

      fireEvent.click(screen.getByText('Check again'));
      fireEvent.click(await screen.findByText('Set it aside...'));
      const warning = screen.getByTestId('cashout-aside-warning').textContent;
      expect(warning).toMatch(/only if you are sure it will not be mined/);
      expect(warning).toMatch(/Its record is kept and still checked/);
      expect(warning).toMatch(/only one of the two transactions can succeed/);
      expect(screen.getByText('Cash out 3 x U$10.00').disabled).toBe(true);

      // changing one's mind changes nothing
      fireEvent.click(screen.getByText('Keep waiting'));
      expect(screen.queryByTestId('cashout-aside-warning')).toBeNull();
      expect(JSON.parse(localStorage.getItem(deploymentKey('poolCashoutPending')))).toHaveLength(1);
      expect(localStorage.getItem(deploymentKey('poolCashoutAside'))).toBeNull();

      fireEvent.click(screen.getByText('Set it aside...'));
      fireEvent.click(screen.getByText('Set it aside'));
      expect(screen.queryByTestId('cashout-pending')).toBeNull();
      expect(screen.getByText('Cash out 3 x U$10.00').disabled).toBe(false);
      expect(screen.getByTestId('cashout-aside').textContent).toMatch(/1 withdrawal was set aside and not seen mined yet/);
      expect(JSON.parse(localStorage.getItem(deploymentKey('poolCashoutPending')))).toEqual([]);
      expect(JSON.parse(localStorage.getItem(deploymentKey('poolCashoutAside')))[0]).toMatchObject({ changeLeaf: '99', change: PENDING.change });
      expect(runCashout).not.toHaveBeenCalled();
      expect(window.ethereum.request).not.toHaveBeenCalled();
    });

    it('says when the same transaction was sent again, and when the network did not take it', async () => {
      fill();
      addPendingWithdrawal(PENDING);
      checkPendingCashouts.mockResolvedValueOnce({ settled: 0, pending: true, resent: 1, refused: '', aside: 0 });
      render(<PoolCashout web3={web3} logWeb3={{}} />);
      fireEvent.click(screen.getByText('Check again'));
      await wait(() => expect(screen.getByTestId('cashout-check').textContent).toMatch(/the same transaction was sent again \(it cannot be paid twice\)/));
      // the transaction has just left again: setting it aside is not offered now
      expect(screen.queryByText('Set it aside...')).toBeNull();

      checkPendingCashouts.mockResolvedValueOnce({ settled: 0, pending: true, resent: 0, refused: 'insufficient funds for gas * price + value', aside: 0 });
      fireEvent.click(screen.getByText('Check again'));
      await wait(() => expect(screen.getByTestId('cashout-check').textContent).toMatch(/did not take it again: Your wallet does not have enough funds/));
      expect(screen.getByText('Set it aside...')).toBeTruthy();
    });

    it('takes the offer and the warning back when a later check sends the transaction again', async () => {
      fill();
      addPendingWithdrawal(PENDING);
      checkPendingCashouts.mockResolvedValueOnce({ settled: 0, pending: true, resent: 0, refused: '', aside: 0 });
      render(<PoolCashout web3={web3} logWeb3={{}} />);
      fireEvent.click(screen.getByText('Check again'));
      fireEvent.click(await screen.findByText('Set it aside...'));
      expect(screen.getByTestId('cashout-aside-warning')).toBeTruthy();

      checkPendingCashouts.mockResolvedValueOnce({ settled: 0, pending: true, resent: 1, refused: '', aside: 0 });
      fireEvent.click(screen.getByText('Check again'));
      await wait(() => expect(screen.getByTestId('cashout-check').textContent).toMatch(/the same transaction was sent again/));
      expect(screen.queryByTestId('cashout-aside-warning')).toBeNull();
      expect(screen.queryByText('Set it aside...')).toBeNull();
      expect(JSON.parse(localStorage.getItem(deploymentKey('poolCashoutPending')))).toHaveLength(1);
      expect(localStorage.getItem(deploymentKey('poolCashoutAside'))).toBeNull();
    });

    it('keeps showing a withdrawal that was set aside and checks it on request', async () => {
      fill();
      addPendingWithdrawal(PENDING);
      setAsidePendingCashouts();
      checkPendingCashouts.mockResolvedValue({ settled: 0, pending: false, resent: 0, refused: '', aside: 1 });
      render(<PoolCashout web3={web3} logWeb3={{}} />);
      expect(screen.queryByTestId('cashout-pending')).toBeNull();
      expect(screen.getByText('Cash out 3 x U$10.00').disabled).toBe(false);

      fireEvent.click(screen.getByText('Check now'));
      await wait(() => expect(screen.getByTestId('cashout-check').textContent).toMatch(/set aside has not been mined so far/));
      expect(checkPendingCashouts).toHaveBeenCalledTimes(1);
      expect(runCashout).not.toHaveBeenCalled();
    });

    it('shows the waiting message, not "press the button again", when a run leaves a withdrawal waiting', async () => {
      fill();
      runCashout.mockImplementation(async () => {
        addPendingWithdrawal(PENDING);
        throw new Error('Failed to check for transaction receipt');
      });
      render(<PoolCashout web3={web3} logWeb3={{}} />);

      fireEvent.click(screen.getByText('Cash out 3 x U$10.00'));
      await wait(() => expect(screen.getByTestId('cashout-pending')).toBeTruthy());
      expect(screen.queryByText(/press the button again/)).toBeNull();
      expect(screen.getByText('Cash out 3 x U$10.00').disabled).toBe(true);
    });
  });
});
