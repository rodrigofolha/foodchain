import React, { useState, useEffect, useCallback } from 'react';

import { CashoutBox, Hint, CashoutBtn, PlainBtn, StepList, StepState, Warning, DangerBtn, ErrorLine, PendingLine } from './styles';

import { REPUTATION_ADDRESS, REPUTATION_ABI, DEPLOY_BLOCK } from '../../services/config';
import { getUnspentNotes } from '../../utils/zkWithdraw';
import {
  CASHOUT_POLICY, cashoutStatus, planCashout, getCashoutState, runCashout,
  hasPendingCashouts, checkPendingCashouts, isPendingWithdrawalError,
  countSetAsideCashouts, setAsidePendingCashouts,
} from '../../utils/cashout';
import { parseContractError } from '../../utils/contractErrors';

var priceUtils = require('../../utils/priceUtils');

var STEP_TEXT = {
  proving: 'generating the proof...',
  sending: 'confirm it in your wallet, then wait for it to be mined...',
  done: 'done',
  failed: 'failed',
};

function readPool() {
  try {
    var notes = getUnspentNotes();
    var state = getCashoutState();
    return {
      status: cashoutStatus(notes, CASHOUT_POLICY, state),
      plan: planCashout(notes, CASHOUT_POLICY, state),
      open: state.open,
      // a withdrawal was sent and its outcome is not recorded yet
      pending: hasPendingCashouts(),
      // withdrawals the person set aside: they do not block, and are still looked for
      aside: countSetAsideCashouts(),
    };
  } catch (_) {
    return null;
  }
}

/**
 * Cash-out of the privacy pool to the establishment's wallet, in fixed amounts.
 * Reads the notes of this browser; nothing is sent until a button is pressed.
 */
export default function PoolCashout({ web3, logWeb3, refreshKey, onChange }) {
  const [pool, setPool] = useState(readPool);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState('');
  // "Set aside" is offered only after a check that left the withdrawal waiting and sent nothing again
  const [stillWaiting, setStillWaiting] = useState(false);
  const [confirmAside, setConfirmAside] = useState(false);

  var refresh = useCallback(function() {
    setPool(readPool());
    if (onChange) onChange();
  }, [onChange]);

  useEffect(function() { setPool(readPool()); }, [refreshKey]);

  var dollars = function(wei) { return 'U$' + priceUtils.weiToDollars(wei.toString()); };
  var denomination = 'U$' + CASHOUT_POLICY.denominationUsd.toFixed(2);

  // Looks whether the withdrawal sent earlier was mined. Nothing new is sent: at most, a
  // withdrawal that was signed in this browser and never reached the network is sent again.
  var checkAgain = async function() {
    if (!web3 || !logWeb3 || running || checking) return;
    setChecking(true);
    setCheckResult('');
    setError('');
    try {
      var result = await checkPendingCashouts({
        reputationContract: new web3.eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS),
        logWeb3: logWeb3,
        reputationAddress: REPUTATION_ADDRESS,
        fromBlock: DEPLOY_BLOCK || 0,
        web3: web3,
      });
      // not right after a check that sent the transaction again: it may be mined now
      var waiting = !!result.pending && !(result.resent > 0);
      setStillWaiting(waiting);
      if (!waiting) setConfirmAside(false);
      setCheckResult(result.pending
        ? (result.resent > 0
          ? 'The network did not know this withdrawal: the same transaction was sent again (it cannot be paid twice). Check again in a moment.'
          : result.refused
            ? 'The network did not know this withdrawal and did not take it again: ' + parseContractError({ message: result.refused }) + ' Check again in a moment.'
            : 'Still waiting to be mined. Check again in a moment.')
        : result.settled > 0 ? 'The withdrawal was mined and is recorded now.'
          : result.aside > 0 ? 'The withdrawal that was set aside has not been mined so far.'
            : 'The withdrawal was not mined and cannot be any more: its notes are still in the pool.');
    } catch (err) {
      console.error('Pool cash-out check error:', (err && err.message) || err);
      setCheckResult('Could not check: the network did not answer. Try again in a moment.');
    }
    setChecking(false);
    refresh();
  };

  // The way out when a withdrawal never settles. Nothing is sent and no record is deleted.
  var setAside = function() {
    if (running || checking) return;
    setAsidePendingCashouts();
    setConfirmAside(false);
    setStillWaiting(false);
    setCheckResult('The withdrawal was set aside. It is still checked: if it is mined later, it is recorded.');
    refresh();
  };

  var run = async function(all) {
    if (!window.ethereum || !web3 || !logWeb3 || running || checking || hasPendingCashouts()) return;
    setRunning(true);
    setConfirmAll(false);
    setSteps([]);
    setError('');
    setCheckResult('');
    try {
      var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      await runCashout({
        reputationContract: new web3.eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS),
        web3: web3,
        logWeb3: logWeb3,
        reputationAddress: REPUTATION_ADDRESS,
        fromBlock: DEPLOY_BLOCK || 0,
        account: accounts[0],
        all: all,
        onStep: function(step) {
          setSteps(function(list) {
            var next = list.slice();
            next[step.index] = step;
            return next;
          });
          if (step.status === 'done') refresh();
        },
      });
    } catch (err) {
      console.error('Pool cash-out error:', (err && err.message) || err);
      // with a withdrawal still waiting, the message below the buttons says what to do
      if (!isPendingWithdrawalError(err) && !hasPendingCashouts()) {
        setError(parseContractError(err) + ' No funds were lost: press the button again to continue.');
      }
    }
    setRunning(false);
    refresh();
  };

  if (!pool) return null;
  var status = pool.status;
  var merges = pool.plan.filter(function(s) { return s.type === 'merge'; }).length;
  var canCashOut = status.due && status.withdrawals > 0;
  var blocked = running || checking || pool.pending;

  var summary;
  if (canCashOut) {
    summary = (pool.open ? 'A cash-out was interrupted. Left to do: ' : 'Cash-out now: ')
      + status.withdrawals + (status.withdrawals === 1 ? ' withdrawal of ' : ' withdrawals of ') + denomination
      + ' to your wallet (' + dollars(status.cashoutWei) + ' in total)'
      + (merges > 0 ? ', after ' + merges + (merges === 1 ? ' transaction that merges' : ' transactions that merge') + ' small notes' : '')
      + '. ' + dollars(status.leftoverWei) + ' stays in the pool for the next cash-out.';
  } else if (!status.due) {
    summary = 'Nothing to cash out yet: ' + status.newNotes + ' of ' + CASHOUT_POLICY.everyNotes
      + ' notes received from orders since the last cash-out.';
  } else {
    summary = 'Nothing to cash out yet: what the orders paid into the pool does not fill one withdrawal of ' + denomination + '.';
  }

  return (
    <CashoutBox>
      <h4>Cash out revenue</h4>
      <p><strong>Received from orders, waiting in the pool:</strong> {dollars(status.cashableWei)}</p>
      <p data-testid="cashout-summary">{summary}</p>
      <Hint>
        Every withdrawal is exactly {denomination}, so the amount paid to your wallet does not show which orders it came from.
      </Hint>

      <CashoutBtn type="button" onClick={function() { run(false); }} disabled={blocked || !canCashOut || !web3 || !logWeb3}>
        {running ? 'Cashing out...' : canCashOut ? 'Cash out ' + status.withdrawals + ' x ' + denomination : 'Cash out'}
      </CashoutBtn>
      <PlainBtn type="button" onClick={function() { setConfirmAll(true); }} disabled={blocked || status.poolWei.toString() === '0'}>
        Withdraw everything...
      </PlainBtn>

      {pool.pending && !running && (
        <PendingLine data-testid="cashout-pending">
          A withdrawal was sent and is waiting to be mined. Nothing else is sent from the pool until it is recorded:
          a second one would spend the same notes and fail. If it funds an accepted order and the network never
          received it, Check again sends the same signed transaction again (it cannot be paid twice).{' '}
          <PlainBtn type="button" onClick={checkAgain} disabled={checking || !web3 || !logWeb3}>
            {checking ? 'Checking...' : 'Check again'}
          </PlainBtn>
          {stillWaiting && !confirmAside && (
            <PlainBtn type="button" onClick={function() { setConfirmAside(true); }} disabled={checking}>
              Set it aside...
            </PlainBtn>
          )}
        </PendingLine>
      )}
      {checkResult && <Hint data-testid="cashout-check">{checkResult}</Hint>}

      {confirmAside && pool.pending && !running && (
        <Warning data-testid="cashout-aside-warning">
          <p>
            <strong>Set this withdrawal aside only if you are sure it will not be mined</strong> (for example, your wallet
            shows it as dropped or cancelled). It stops blocking the pool. Its record is kept and still checked: if it is
            mined later, it is recorded as usual. Until then its notes count as unspent, so a new withdrawal or an accepted
            order may use them; then only one of the two transactions can succeed and the other fails. No money is lost,
            but the one that fails still costs its gas.
          </p>
          <DangerBtn type="button" onClick={setAside}>Set it aside</DangerBtn>
          <PlainBtn type="button" onClick={function() { setConfirmAside(false); }}>Keep waiting</PlainBtn>
        </Warning>
      )}

      {pool.aside > 0 && !pool.pending && !running && (
        <Hint data-testid="cashout-aside">
          {pool.aside === 1 ? '1 withdrawal was set aside' : pool.aside + ' withdrawals were set aside'} and not seen mined yet.
          {' '}It is looked for before every cash-out.{' '}
          <PlainBtn type="button" onClick={checkAgain} disabled={checking || !web3 || !logWeb3}>
            {checking ? 'Checking...' : 'Check now'}
          </PlainBtn>
        </Hint>
      )}

      {confirmAll && !pool.pending && (
        <Warning>
          <p>
            <strong>This makes your orders traceable.</strong> It pays the whole pool balance ({dollars(status.poolWei)}) to
            your wallet as one exact amount. Anyone can match an exact amount to the orders it adds up to, and so link
            those orders, their one-time addresses and their customers' payments to your establishment. The money you
            deposited to accept orders leaves the pool too. Use it only to close the pool.
          </p>
          <DangerBtn type="button" onClick={function() { run(true); }}>Withdraw everything anyway</DangerBtn>
          <PlainBtn type="button" onClick={function() { setConfirmAll(false); }}>Cancel</PlainBtn>
        </Warning>
      )}

      {steps.length > 0 && (
        <StepList>
          {steps.map(function(step, i) {
            if (!step) return null;
            var what = step.type === 'merge'
              ? 'Merging two small notes (nothing is paid out)'
              : 'Withdrawal of ' + dollars(step.amount);
            return (
              <li key={i}>
                Step {i + 1} of {step.total}. {what}:{' '}
                <StepState status={step.status}>
                  {STEP_TEXT[step.status]}
                  {step.status === 'done' && step.txHash ? ' (' + step.txHash.slice(0, 12) + '...)' : ''}
                  {step.status === 'failed' ? ': ' + parseContractError({ message: step.error }) : ''}
                </StepState>
              </li>
            );
          })}
        </StepList>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </CashoutBox>
  );
}
