/* global BigInt */
import React, { useState, useEffect, useRef } from 'react';
import Moment from 'react-moment';

import { Order, Button, StatusBadge, ReputationBadge, WorkerReputationBadge } from './styles';

import { CircularProgress } from '@material-ui/core';

import ItemLine from '../ItemOrder'
import QrScanner from '../QrScanner';
import PickupKeyQR from '../PickupKeyQR';
import { decrypt } from '../../utils/crypto';
import { parseContractError } from '../../utils/contractErrors';
import { sendRecorded } from '../../utils/signedSend';
import { isHandoverSignature } from '../../utils/handoverSignature';
import { REPUTATION_ADDRESS, REPUTATION_ABI, CHAIN_ADDRESS, SEPOLIA_RPC_URL, DEPLOY_BLOCK } from '../../services/config';
import { generateNoteSecrets, computePaymentCommitment, computeNullifierHash, getUnspentBalance, syncSpentNotes, selectWithdrawalNotes, fetchTreeState, generateMergeWithdrawProof, findNoteLeafIndex } from '../../utils/zkWithdraw';
import {
  hasPendingCashouts, countSetAsideCashouts, reconcilePendingCashouts, addPendingWithdrawal,
  settlePendingWithdrawal, dropPendingWithdrawal,
} from '../../utils/cashout';
import { fundingPlan, withdrawnTo, recordedFunding } from '../../utils/orderFunding';
import { sendFromWallet, sendOneTime, oneTimeOverrides, isShortOfGasError, sendErrorText, formatEth } from '../../utils/oneTimeSend';
import { quoteGasReturn, sendGasReturn } from '../../utils/gasReturn';
import { waitingTimedOut, waitingTimeoutAt, TIMEOUT_REFUND_TEXT, COLLATERAL_RETURN_TEXT } from '../../utils/waitingTimeout';
import { paymentCommitmentFor } from '../../utils/paymentSecrets';
import {
  fetchOrderCommitments, orderWorkers, fetchRatingLines, replacementState, outcomeText,
  workerRecord, workerRecordText, shortAddress,
} from '../../utils/orderRatings';
import { getStealthKey } from '../../utils/stealth';
import { usesReputationContract } from '../../utils/orderCheck';
import { parseEstablishmentOrder } from '../../utils/pickupSeal';
import {
  showsPickupKey, pickupKeyToShow, decryptErrorMessage, PICKUP_KEY_NOTICE,
  chainOrderState, readChainOrder, orderChangedOnChain, allowsDispatch,
  checkPickupConfirmation, storePickupConfirmation, storedPickupConfirmation, forgetPickupConfirmation,
} from '../../utils/pickupKeyDisplay';
var priceUtils = require('../../utils/priceUtils');

const ORDER_CHANGED_TEXT = 'This order changed on the chain since this page was loaded.';
// The steps of an order that has not ended
const OPEN_STEPS = ['ORDERED', 'PREPARATION', 'WAITING', 'DISPATCHED'];

export default function OrderCard( props ) {
  const {web3, logWeb3, chain, orderBlock, total} = props;
  const [loading, setLoading] = useState(false);
  const [workerSignature, setWorkerSignature] = useState('');
  const [deliveryEvaluation, setEvaluation] = useState(null);
  const [readMore, setReadMore] = useState(false);
  const [items, setItems] = useState([]);
  const [pickupSecret, setPickupSecret] = useState(null);
  // Result of checking the worker's pickup confirmation in the browser:
  // state is 'checking', 'valid', 'invalid' or 'unreadable' (the chain did not answer)
  const [confirmation, setConfirmation] = useState({ signature: '', worker: '', state: null });
  // The step the card shows: the one the page loaded, or DISPATCHED once this card has
  // seen its own pickup recorded on the chain.
  const [recordedStep, setRecordedStep] = useState(null);
  const step = recordedStep || orderBlock[3];
  // The last fresh read of the order from the chain (readOrderNow): state is null,
  // 'reading', 'read' (with status, worker, updatedAt), 'unreadable' or 'changed'
  const [chainOrder, setChainOrder] = useState({ state: null });
  // Seconds now, refreshed while the order has a worker (for the timeout)
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const mounted = useRef(true);
  const [minReputation, setMinReputation] = useState(0);
  const [minOrders, setMinOrders] = useState(0);
  const [workerReputation, setWorkerReputation] = useState(null);

  // Helper: execute a Chain contract method from stealth wallet if available
  var sendFromStealth = async function(methodName, args, options) {
    var restaurantAddr = orderBlock[11] || orderBlock[4];
    var stealthKey = getStealthKey(restaurantAddr);

    if (stealthKey) {
      var ethersModule = await import('ethers');
      var ethers = ethersModule.ethers;
      var rpcProvider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL);
      var stealthWallet = new ethers.Wallet(stealthKey, rpcProvider);
      var chainContract = new ethers.Contract(CHAIN_ADDRESS, chain.options.jsonInterface, stealthWallet);
      // The gas limit is the node's estimate with a margin, and the address must hold
      // limit x price before anything is sent (oneTimeSend.js). No fixed limit.
      return await sendOneTime(chainContract, methodName, args, options);
    } else {
      var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      var sendOpts = { from: accounts[0] };
      if (options && options.value) sendOpts.value = options.value;
      return await sendFromWallet(chain.methods[methodName].apply(null, args), sendOpts);
    }
  };
  // Commitments of the order so far (one address per commitment), or null when not read
  const [commitments, setCommitments] = useState(null);
  // Workers of the order the establishment can rate or has rated (see ratingLine)
  const [ratingLines, setRatingLines] = useState([]);
  // true once the workers and their ratings were read from the chain
  const [ratingsRead, setRatingsRead] = useState(false);
  const [ratingWorker, setRatingWorker] = useState(null);
  // Unused gas money at the one-time address of an ended order (gasReturn.js): state is null,
  // 'quoted' (with offer), 'sending', 'done' (with returned) or 'failed' (with message)
  const [gasReturn, setGasReturn] = useState({ state: null });

  // Public record of the worker committed now
  useEffect(() => {
    if (web3 && REPUTATION_ADDRESS && orderBlock[8] &&
        orderBlock[8] !== '0x0000000000000000000000000000000000000000') {
      const reputationContract = new web3.eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS);
      reputationContract.methods.workers(orderBlock[8]).call()
        .then(result => { if (mounted.current) setWorkerReputation(workerRecord(result)); })
        .catch(err => console.log('Reputation fetch error:', (err && err.message) || err));
    }
  }, [web3, orderBlock[8]]);

  useEffect(() => () => { mounted.current = false; }, []);

  // The workers who committed to this order (from its own OrderActors logs) and, for each,
  // whether the order reported a delivery or a leaving and whether it was rated.
  // Read-only: no wallet is asked.
  useEffect(() => {
    if (!chain || !logWeb3 || !REPUTATION_ADDRESS || step === 'ORDERED') return;
    let stale = false;
    (async () => {
      try {
        const orderAddress = await chain.methods.findAddress(orderBlock[0]).call();
        const committed = await fetchOrderCommitments(logWeb3, orderAddress, DEPLOY_BLOCK || 0);
        if (stale || !mounted.current) return;
        setCommitments(committed);
        const reputationContract = new logWeb3.eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS);
        const lines = await fetchRatingLines(reputationContract, orderAddress, orderWorkers(committed));
        if (stale || !mounted.current) return;
        setRatingLines(lines);
        setRatingsRead(true);
      } catch (err) {
        console.log('Order workers fetch error:', (err && err.message) || err);
      }
    })();
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, logWeb3, orderBlock[0], step, orderBlock[8]]);

  // The pool, as the order's one-time address sees it (null without a one-time key)
  const poolFromOneTime = async function () {
    const stealthKey = getStealthKey(orderBlock[11] || orderBlock[4]);
    if (!stealthKey) return null;
    const ethers = (await import('ethers')).ethers;
    const wallet = new ethers.Wallet(stealthKey, new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL));
    return { ethers: ethers, wallet: wallet, reputation: new ethers.Contract(REPUTATION_ADDRESS, REPUTATION_ABI, wallet) };
  };

  // Once the order has ended and its ratings are known: what its one-time address still
  // holds and what returning it to the pool would cost. Only reads.
  // Only for an order the pool funded (this browser's record, or the pool's payments on the
  // chain): at the address of an order that was never accepted there is the customer's gas
  // stipend alone, which is not the establishment's to take.
  const ended = !!step && OPEN_STEPS.indexOf(step) < 0;
  const unratedWorkers = ratingLines.filter(line => line.canRate).length;
  useEffect(() => {
    if (!ended || !ratingsRead || !REPUTATION_ADDRESS) return undefined;
    let stale = false;
    (async () => {
      try {
        const pool = await poolFromOneTime();
        if (!pool) return;
        const oneTime = pool.wallet.address;
        const funded = recordedFunding(oneTime) > 0n ||
          (await withdrawnTo(logWeb3, REPUTATION_ADDRESS, oneTime, DEPLOY_BLOCK || 0)) > 0n;
        if (!funded || stale) return;
        const offer = await quoteGasReturn(pool.reputation, unratedWorkers);
        if (!stale && mounted.current) setGasReturn(current => (current.state === null || current.state === 'quoted') ? { state: 'quoted', offer: offer } : current);
      } catch (err) {
        console.log('Gas money read error:', (err && err.message) || err);
      }
    })();
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, ratingsRead, unratedWorkers, orderBlock[0]]);

  // Deposits what is left at the order's one-time address into the payment pool as a new note
  // of the establishment. The note's secrets are saved before the transaction is sent.
  const returnGasMoney = async function () {
    if (gasReturn.state === 'sending') return;
    setGasReturn({ state: 'sending' });
    try {
      const pool = await poolFromOneTime();
      const result = await sendGasReturn({
        ethers: pool.ethers, wallet: pool.wallet, reputation: pool.reputation,
        orderId: orderBlock[0], unratedWorkers: unratedWorkers,
      });
      if (mounted.current) setGasReturn({ state: 'done', returned: result.amount });
    } catch (err) {
      console.error('Gas money return failed:', parseContractError(err));
      const reverted = err && err.receipt && err.receipt.status === 0;
      const message = (err && err.notWorth) ? err.message
        : (err && err.notSent) ? sendErrorText(err) + ' Nothing was sent.'
          : reverted ? 'The transaction failed on the chain: the money is still at the one-time address, less the gas it used.'
            : sendErrorText(err) + " If the transaction left this browser, its note's secrets are kept and the note is recorded when the Orders page finds it in the pool.";
      if (mounted.current) setGasReturn({ state: 'failed', message: message });
    }
  };

  // Reads the order again from the chain, as the account the order knows as its
  // establishment: the order's one-time address, or the wallet's account for an order
  // without one. Only reads; the wallet is not asked to confirm anything.
  const readFresh = async function () {
    const stealthKey = getStealthKey(orderBlock[11] || orderBlock[4]);
    if (stealthKey) {
      const ethers = (await import('ethers')).ethers;
      const wallet = new ethers.Wallet(stealthKey, new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL));
      const contract = new ethers.Contract(CHAIN_ADDRESS, chain.options.jsonInterface, wallet);
      const orderAddress = await contract.findAddress(orderBlock[0]);
      return chainOrderState(orderAddress, await contract.getOrder(orderAddress));
    }
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return readChainOrder(chain, orderBlock[0], accounts[0]);
  };

  // A fresh read before a key is shown or anything is sent. A card that holds an older
  // copy of the order (another step or another worker on the chain) shows and sends
  // nothing: it says that the order changed, and after an action of the person it
  // reloads the page. Returns { state: 'read' | 'unreadable' | 'changed', fresh }.
  const readOrderNow = async function (cardStep, byAction) {
    setChainOrder({ state: 'reading' });
    let fresh;
    try {
      fresh = await readFresh();
    } catch (_) {
      if (mounted.current) setChainOrder({ state: 'unreadable' });
      return { state: 'unreadable', fresh: null };
    }
    if (orderChangedOnChain(cardStep, orderBlock[8], fresh)) {
      if (mounted.current) setChainOrder({ state: 'changed' });
      if (byAction) {
        alert(ORDER_CHANGED_TEXT + ' Nothing was sent and no pickup key is shown. The page reloads now.');
        window.location.reload();
      }
      return { state: 'changed', fresh: null };
    }
    if (mounted.current) setChainOrder(Object.assign({ state: 'read' }, fresh));
    return { state: 'read', fresh: fresh };
  };

  // Checks that the confirmation is a signature, by the worker committed now, of the
  // digest the contract will check, after a fresh read of the order says that it still
  // waits for that worker. A valid one is kept until dispatch.
  const checkConfirmation = async function (signature, byAction) {
    const worker = orderBlock[8];
    setConfirmation({ signature: signature, worker: worker, state: 'checking' });
    const read = await readOrderNow('WAITING', byAction);
    if (read.state === 'changed') {
      if (mounted.current) setConfirmation({ signature: '', worker: '', state: null });
      return;
    }
    let state = 'unreadable';
    if (read.state === 'read') {
      try {
        state = (await checkPickupConfirmation(web3, chain, orderBlock[0], worker, signature)) ? 'valid' : 'invalid';
      } catch (_) {
        state = 'unreadable';
      }
    }
    if (state === 'valid') storePickupConfirmation(orderBlock[0], worker, signature);
    if (!mounted.current) return;
    // a newer scan or paste may have replaced this one meanwhile
    setConfirmation(current => (current.signature === signature && current.worker === worker)
      ? { signature: signature, worker: worker, state: state }
      : current);
  };

  function enterConfirmation(value) {
    const text = String(value).trim();
    setWorkerSignature(text);
    if (isHandoverSignature(text)) {
      checkConfirmation(text, true);
    } else {
      setConfirmation({ signature: '', worker: '', state: null });
    }
  }

  // After a page reload, the confirmation checked before is checked again. Once
  // the order has left WAITING it is not needed any more.
  useEffect(() => {
    if (step !== 'WAITING') {
      forgetPickupConfirmation(orderBlock[0]);
      return;
    }
    if (!web3 || !chain) return;
    const kept = storedPickupConfirmation(orderBlock[0], orderBlock[8]);
    if (kept) {
      setWorkerSignature(kept);
      checkConfirmation(kept, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web3, chain, orderBlock[0], step, orderBlock[8]]);

  // On the way, the key is shown only after the chain was read: also after a page
  // reload, and for a worker who needs to scan the key again.
  useEffect(() => {
    if (step !== 'DISPATCHED' || recordedStep || !chain) return;
    readOrderNow('DISPATCHED', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, orderBlock[0], step, orderBlock[8]]);

  useEffect(() => {
    if (step !== 'WAITING' && step !== 'DISPATCHED') return undefined;
    const timer = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(timer);
  }, [step]);

  const confirmationChecked = confirmation.state === 'valid' &&
    confirmation.signature === workerSignature && confirmation.worker === orderBlock[8];
  // "Dispatch order" needs the checked confirmation and a fresh read that says WAITING
  // with the same worker
  const dispatchReady = chainOrder.state === 'read' && allowsDispatch(orderBlock[8], confirmationChecked, chainOrder);
  // When the order entered the step the card shows. A card that saw its own dispatch
  // takes the time of the pickup from its read of the chain.
  const stepSince = recordedStep ? (chainOrder.state === 'read' ? chainOrder.updatedAt : null) : orderBlock[7];

  let button_accept;
  let button_second;
  let button_cancel;
  let button_timeout = null;

  let rep_inputs = null;

  // Pickup key of the order's worker. It comes from the pickup secret inside the order,
  // so the order must be decrypted first. The worker needs it to open the delivery
  // address. It is never shown in WAITING: it appears when a fresh read of the chain
  // says that the pickup is recorded (DISPATCHED) for the worker the key is derived for.
  let pickup_key = null;
  if (showsPickupKey(step)) {
    const waiting = step === 'WAITING';
    const pickupKey = readMore ? pickupKeyToShow(pickupSecret, orderBlock[0], step, orderBlock[8], chainOrder.state === 'read' ? chainOrder : null) : null;
    if (chainOrder.state === 'changed') {
      pickup_key = (
        <div className="pickup-key">
          <p><span>{ORDER_CHANGED_TEXT}</span> Nothing can be sent and no pickup key is shown from this copy of it.</p>
          <button onClick={() => window.location.reload()}>Reload the order</button>
        </div>
      );
    } else if (waiting) {
      pickup_key = (
        <div className="pickup-key">
          {readMore && !pickupSecret
            ? <p>This order was placed before the pickup key existed: there is no key to show. {confirmationChecked
              ? 'The confirmation is valid: press Dispatch order.'
              : "Scan the worker's pickup confirmation below, then dispatch."}</p>
            : <p><span>Pickup key.</span> Ask the worker to press Confirm pickup, scan their confirmation below and press Dispatch order. {PICKUP_KEY_NOTICE}</p>}
        </div>
      );
    } else if (pickupKey) {
      pickup_key = (
        <div className="pickup-key">
          <p><span>Pickup key.</span> The pickup is recorded on the chain. If the worker cannot read the delivery address yet, let them scan this key before they leave.</p>
          <PickupKeyQR value={pickupKey} />
          <input type="text" readOnly aria-label="Pickup key" value={pickupKey} onFocus={e => e.target.select()} />
        </div>
      );
    } else if (chainOrder.state === 'unreadable') {
      pickup_key = (
        <div className="pickup-key">
          <p>The order could not be read from the chain, so the pickup key is not shown.</p>
          <button onClick={() => readOrderNow('DISPATCHED', true)}>Read the order again</button>
        </div>
      );
    } else if (chainOrder.state !== 'read') {
      pickup_key = (
        <div className="pickup-key">
          <p>Reading the order from the chain...</p>
        </div>
      );
    } else if (!readMore) {
      pickup_key = (
        <div className="pickup-key">
          <p>The pickup is recorded on the chain. The worker needs the pickup key of this order to read the delivery address.</p>
          <button onClick={() => showPickupKey()}>Show pickup key</button>
        </div>
      );
    }
  }
  if (step === 'ORDERED'){
    rep_inputs = (
      <div className="rep-inputs">
        <div className="rep-input-row">
          <label>Min rating (0–5):</label>
          <input type="number" min="0" max="5" step="0.5"
            onChange={e => setMinReputation(Math.round(parseFloat(e.target.value || 0) * 10))} />
        </div>
        <div className="rep-input-row">
          <label>Min orders:</label>
          <input type="number" min="0"
            onChange={e => setMinOrders(parseInt(e.target.value || 0))} />
        </div>
      </div>
    );
    button_accept = <Button onClick={() => prepareOrder(orderBlock[0])}>Accept order</Button>;
    button_second = null;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Refuse</Button>;
  } else if (step === 'PREPARATION') {
    button_accept = null;
    button_second = null;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel</Button>;
  } else if (step === 'WAITING') {
    button_cancel = (
      <div className="pickup-confirmation">
        <input type="text" placeholder="Worker's pickup confirmation" value={ workerSignature } onChange={ handleChange } />
        {workerSignature && !isHandoverSignature(workerSignature) &&
          <span className="pickup-hint">Not a valid confirmation (0x followed by 130 hex characters).</span>}
        {confirmation.signature === workerSignature && confirmation.state === 'checking' &&
          <span className="pickup-hint" style={{color:'#666'}}>Checking the confirmation...</span>}
        {confirmationChecked &&
          <span className="pickup-hint" style={{color:'#28a745'}}>Confirmation checked: it was signed by the worker of this order.</span>}
        {confirmation.signature === workerSignature && confirmation.state === 'invalid' &&
          <span className="pickup-hint">This confirmation was not signed for this order by the worker committed to it. Ask the worker to press Confirm pickup on this order and show it again.</span>}
        {confirmation.signature === workerSignature && confirmation.state === 'unreadable' &&
          <span className="pickup-hint">Could not check the confirmation: the network did not answer. <button type="button" onClick={() => checkConfirmation(workerSignature, true)}>Check again</button></span>}
        <QrScanner
          buttonLabel="Scan worker's QR"
          validate={ isHandoverSignature }
          invalidMessage="This QR code is not a pickup confirmation. Ask the worker to show it again."
          onScan={ enterConfirmation } />
      </div>
    );
    // enabled only after a fresh read of the chain says WAITING with the same worker
    button_accept = <Button disabled={!dispatchReady} onClick={() => pickupOrder(orderBlock[0])}>Dispatch order</Button>;
    // After the hour the contract charges a cancellation to the worker. Before it, a
    // cancellation by the establishment would cost its collateral: it is not offered.
    button_timeout = waitingTimedOut(orderBlock[7], nowSec)
      ? (
        <>
          <Button warning onClick={() => cancelAfterTimeout('WAITING')}>Cancel</Button>
          <p className="action-hint">The worker did not come within one hour of committing. Cancel ends the order: {TIMEOUT_REFUND_TEXT}, {COLLATERAL_RETURN_TEXT}, and the worker is paid nothing, is counted as having left before pickup and can be rated by you.</p>
        </>
      )
      : waitingTimeoutAt(orderBlock[7]) && (
        <p className="action-hint">If the worker does not come, you can cancel this order after {new Date(waitingTimeoutAt(orderBlock[7]) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (one hour after they committed) and get your collateral back as a note in the payment pool.</p>
      );
    // Accepted at any time in WAITING, once per order, and never for a second worker
    button_second = replacementState(step, commitments) === 'second-worker'
      ? <p className="action-hint">This is the second worker of this order: the order cannot be offered to another one.</p>
      : (
        <>
          <Button attention onClick={() => callSecondDeliveryman(orderBlock[0])}>Call other deliveryman</Button>
          <p className="action-hint">Possible once per order. The order is offered again, the worker is counted as having left it and you can rate them.</p>
        </>
      );
  } else if (step === 'DISPATCHED') {
    button_accept = <input maxLength="6" type="text" onChange={ handleChange2 } />;
    button_second = <Button attention onClick={() => contestOrder(orderBlock[0])}>Contest order</Button>;
    // As in WAITING: before the hour a cancellation by the establishment would cost its
    // collateral, so it is not offered. After it the contract charges it to the worker.
    button_cancel = null;
    button_timeout = waitingTimedOut(stepSince, nowSec)
      ? (
        <>
          <Button warning onClick={() => cancelAfterTimeout('DISPATCHED')}>Cancel</Button>
          <p className="action-hint">The delivery was not concluded within one hour of the pickup. Cancel ends the order: {TIMEOUT_REFUND_TEXT}, {COLLATERAL_RETURN_TEXT}, you are not paid for the items, and the worker is paid nothing, is counted as having left after pickup and can be rated by you and by the customer.</p>
        </>
      )
      : waitingTimeoutAt(stepSince) && (
        <p className="action-hint">If the delivery is not concluded, you can cancel this order after {new Date(waitingTimeoutAt(stepSince) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (one hour after the pickup) and get your collateral back as a note in the payment pool. Before that, a cancellation would cost you the collateral.</p>
      );
  } else {
    button_accept = null;
    button_second = null;
    button_cancel = null;
  }

  function handleChange(e) {
    enterConfirmation(e.target.value);
  }

  function handleChange2(e) {
    setEvaluation("true" === e.target.value.toLowerCase());
  }


  const decryptDetails = async function () {
    try {
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let unecryptedItems;
      if (orderBlock[1] && orderBlock[1].startsWith('0x')) {
        unecryptedItems = await decrypt(accounts[0], orderBlock[1]);
      } else {
        unecryptedItems = orderBlock[1];
      }
      // { items, k } with the pickup secret, or the item array of an older order
      const order = parseEstablishmentOrder(unecryptedItems);
      setItems(order.items);
      setPickupSecret(order.pickupSecret);
      setReadMore(true);
    } catch (err) {
      // the error itself is not logged: a format error can quote the order
      const message = decryptErrorMessage(err);
      console.error(message);
      alert(message);
    }
  }

  // On the way: opens the order if needed and reads the chain again before the key is shown
  const showPickupKey = async function () {
    if (!readMore) await decryptDetails();
    if (mounted.current) await readOrderNow('DISPATCHED', true);
  };

  // The timeout of WAITING and of DISPATCHED. The chain is read again first: the order must
  // still be in that step with the same worker, and the hour must have passed by the time
  // of the latest block. A cancellation sent before it would be the establishment's own
  // and cost its collateral.
  const cancelAfterTimeout = async function (cardStep) {
    if (!window.ethereum) return;
    setLoading(true);
    try {
      const read = await readOrderNow(cardStep, true);
      if (read.state !== 'read') {
        if (read.state === 'unreadable') alert('The order could not be read from the chain. Nothing was sent. Try again in a moment.');
        setLoading(false);
        return;
      }
      const latest = await web3.eth.getBlock('latest');
      if (!latest || !waitingTimedOut(read.fresh.updatedAt, latest.timestamp)) {
        alert('The hour since ' + (cardStep === 'WAITING' ? 'the worker committed' : 'the pickup') + ' has not passed on the chain yet. Nothing was sent: a cancellation before it would cost you the collateral. Try again in a moment.');
        setLoading(false);
        return;
      }
      await sendFromStealth('cancelOrder', [read.fresh.orderAddress]);
      setLoading(false);
      window.location.reload();
    } catch (err) {
      console.error('Cancel failed:', parseContractError(err));
      alert(sendErrorText(err));
      setLoading(false);
    }
  };

  const cancelOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        var accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        var orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        await sendFromStealth('cancelOrder', [orderAddress]);
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error('Cancel failed:', parseContractError(err));
        alert(sendErrorText(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  const callSecondDeliveryman = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        var accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        var orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        await sendFromStealth('callSecondDeliveryman', [orderAddress]);
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error('Replacement failed:', parseContractError(err));
        alert(sendErrorText(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  const contestOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        var accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        var orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        await sendFromStealth('contestOrder', [orderAddress, deliveryEvaluation]);
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error('Contest failed:', parseContractError(err));
        alert(sendErrorText(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }
  
  const pickupOrder = async function (order_id) {
    if (!isHandoverSignature(workerSignature)) {
      alert("Scan or paste the worker's pickup confirmation first.");
      return;
    }
    // The contract would refuse it too; checking here first costs no gas.
    if (!confirmationChecked) {
      alert(confirmation.state === 'invalid'
        ? 'This pickup confirmation was not signed for this order by the worker committed to it. The order was not dispatched.'
        : 'The pickup confirmation has not been checked yet. Wait for the check, or press Check again, before you dispatch.');
      return;
    }
    if (window.ethereum){
      setLoading(true);
      try {
        // The chain is read again right before sending: a card that holds an older copy
        // of the order (its worker left, or it was dispatched elsewhere) sends nothing.
        const read = await readOrderNow('WAITING', true);
        if (read.state !== 'read' || !allowsDispatch(orderBlock[8], confirmationChecked, read.fresh)) {
          if (read.state === 'unreadable') alert('The order could not be read from the chain. The order was not dispatched. Try again in a moment.');
          setLoading(false);
          return;
        }
        await sendFromStealth('pickupOrder', [read.fresh.orderAddress, workerSignature]);
        forgetPickupConfirmation(order_id);
        // The pickup key appears in this card when the chain says the pickup is recorded
        // for the same worker. If that cannot be read now, the page is reloaded as before.
        let after = null;
        try { after = await readFresh(); } catch (_) { after = null; }
        if (!mounted.current) return;
        setLoading(false);
        if (after && after.status === 'DISPATCHED' && !orderChangedOnChain('DISPATCHED', orderBlock[8], after)) {
          setChainOrder(Object.assign({ state: 'read' }, after));
          setRecordedStep('DISPATCHED');
        } else {
          window.location.reload();
        }
      } catch (err) {
        console.error('Dispatch failed:', parseContractError(err));
        alert(sendErrorText(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }


  const prepareOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});

        // What the order pays the establishment when it ends, in any ending, is deposited as a
        // note into the payment pool of the reputation contract the order names
        if (!(await usesReputationContract(web3, orderAddress, REPUTATION_ADDRESS))) {
          alert('This order does not use the FoodChain reputation contract and cannot be accepted.');
          setLoading(false);
          return;
        }

        // Payment commitment of the note the order pays to (the payment plus the collateral,
        // or the returned collateral alone). The secrets made by an earlier attempt to accept
        // this same order (same contract, same time placed) are used again; new ones are
        // saved before anything is sent, to withdraw the note later.
        const paymentCommitment = paymentCommitmentFor(order_id, orderAddress, orderBlock[6], function () {
          const paymentSecrets = generateNoteSecrets();
          return {
            nullifier: paymentSecrets.nullifier.toString(),
            trapdoor: paymentSecrets.trapdoor.toString(),
            commitment: computePaymentCommitment(paymentSecrets.nullifier, paymentSecrets.trapdoor).toString(),
          };
        });

        // With stealth addresses, we must:
        // 1. Withdraw from ZK pool to stealth address (unlinkable)
        // 2. Call prepareOrder from stealth wallet
        // orderBlock[11] = stealth address (appended by Orders page from scanning)
        // orderBlock[4] = address(0) when called by the restaurant (Order.getItems hides it)
        var restaurantField = orderBlock[11] || orderBlock[4];
        var stealthPrivKey = getStealthKey(restaurantField);
        var deliveryFee = orderBlock[2]; // already in wei (scaled)

        if (stealthPrivKey) {
          var ethersModule = await import('ethers');
          var ethers = ethersModule.ethers;
          var rpcProvider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL);
          var gasPrice = await rpcProvider.getGasPrice();

          var reputationContract = new web3.eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS);
          var stealthWallet = new ethers.Wallet(stealthPrivKey, rpcProvider);

          // A pool withdrawal sent earlier (also one that was set aside) may have been mined
          // since: record it first.
          if (hasPendingCashouts() || countSetAsideCashouts() > 0) {
            await reconcilePendingCashouts(reputationContract, await fetchTreeState(logWeb3, REPUTATION_ADDRESS, DEPLOY_BLOCK || 0), web3);
          }

          // An earlier attempt to accept this order may have funded its one-time address
          // without sending prepareOrder (the page was closed, or prepareOrder failed). The
          // chain says what the pool already paid to the address; its balance does not count
          // (it also holds the customer's stipend). The first funding is the delivery fee plus
          // the gas budget; after it only what a risen gas price makes missing is withdrawn
          // (orderFunding.js).
          var withdrawn;
          try {
            withdrawn = await withdrawnTo(logWeb3, REPUTATION_ADDRESS, stealthWallet.address, DEPLOY_BLOCK || 0);
          } catch (_) {
            alert("The pool's payments to this order could not be read from the chain, so it is not known whether the order was funded already. Nothing was sent. Try again in a moment.");
            setLoading(false);
            return;
          }
          var totalNeeded = fundingPlan(withdrawn, deliveryFee, gasPrice.toString()).withdraw;

          if (totalNeeded > 0n) {
            // While a withdrawal is still waiting, nothing is sent: a second one would spend the same notes.
            if (hasPendingCashouts()) {
              alert('A withdrawal from the privacy pool was sent earlier and is still waiting to be mined. Nothing was sent. Try again in a moment, or open the Menu page: "Check again" there looks for it, and it can be set aside if it never arrives.');
              setLoading(false);
              return;
            }

            // Drop local notes the contract already counts as spent (spentNoteNullifiers)
            var unspent = await syncSpentNotes(reputationContract);

            // Check pool balance
            var poolBalance = getUnspentBalance();
            if (poolBalance < totalNeeded) {
              alert('Insufficient privacy pool balance. Need ' + ethers.utils.formatEther(totalNeeded.toString()) + ' ETH. Go to Menu page to deposit.');
              setLoading(false);
              return;
            }

            // Select notes for one withdrawal: two real notes, or the only note plus the
            // dummy note (the contract never marks the dummy as spent, so it is always reusable)
            var selection = selectWithdrawalNotes(unspent, totalNeeded);
            if (!selection) {
              alert('No single note or pair of notes in the privacy pool covers ' + ethers.utils.formatEther(totalNeeded.toString()) + ' ETH. Deposit more ETH to the privacy pool on the Menu page.');
              setLoading(false);
              return;
            }
            var note1 = selection.note1;
            var note2 = selection.note2;

            // Wait for rate limiter to cool down after stealth scanning
            await new Promise(function(r) { setTimeout(r, 3000); });

            // Rebuild the note tree from NoteAdded events for the Merkle proofs
            var treeState = await fetchTreeState(logWeb3, REPUTATION_ADDRESS, DEPLOY_BLOCK || 0);

            // The contract only accepts a recent note-tree root: check the rebuilt one before proving
            var currentRoot = treeState.root.toString();
            var rootKnown = await reputationContract.methods.isKnownNoteRoot(currentRoot).call();
            if (!rootKnown) {
              alert('The rebuilt note tree does not match the contract (the RPC node may be behind). Please wait a moment and try again.');
              setLoading(false);
              return;
            }
            var changeSecrets = generateNoteSecrets();

            // Convert stealth address to uint256 for the circuit
            var recipientUint = BigInt(restaurantField).toString();

            console.log('[Order] Generating ZK proof for pool withdrawal...');

            var proofResult = await generateMergeWithdrawProof({
              note1: note1,
              note2: note2,
              withdrawAmount: totalNeeded.toString(),
              recipient: recipientUint,
              treeState: treeState,
              changeSecrets: changeSecrets,
            });

            // The withdrawal is sent by the stealth wallet itself, paying gas from the
            // stipend the customer's order sent to it. Sending it from the main wallet
            // would put the main wallet and the stealth address in the same transaction
            // and undo the stealth address.
            console.log('[Order] Submitting pool withdrawal from the stealth wallet...');
            var reputationFromStealth = new ethers.Contract(REPUTATION_ADDRESS, REPUTATION_ABI, stealthWallet);
            var withdrawArgs = [
              restaurantField,
              totalNeeded.toString(),
              proofResult.publicSignals[0],
              proofResult.publicSignals[1],
              proofResult.publicSignals[2],
              currentRoot,
              proofResult.proof.a,
              proofResult.proof.b,
              proofResult.proof.c
            ];

            // The node's estimate (a withdrawal that would revert is not sent) with a margin,
            // at a legacy gas price, so that the upfront cost is exactly limit x price. The
            // address pays it from the stipend that came with the order.
            var withdrawOverrides;
            try {
              withdrawOverrides = await oneTimeOverrides(reputationFromStealth, 'mergeWithdraw', withdrawArgs);
            } catch(dryErr) {
              console.error('[Order] mergeWithdraw was not sent:', parseContractError(dryErr));
              alert(isShortOfGasError(dryErr)
                ? dryErr.message + ' The gas stipend that came with the order does not cover the private withdrawal from the pool.'
                : 'Pool withdrawal would fail: ' + sendErrorText(dryErr));
              setLoading(false);
              return;
            }

            // The change note's secrets are saved before the withdrawal is sent: without them the
            // change could never be spent if the page closes before the receipt.
            var isDummy = function(n) { return BigInt(n.nullifier) === 0n && BigInt(n.amount) === 0n; };
            var fundingWithdrawal = {
              spent: [note1, note2].filter(function(n) { return !isDummy(n); }).map(function(n) { return n.nullifier.toString(); }),
              nullifierHash: computeNullifierHash(note1.amount, note1.nullifier).toString(),
              change: {
                nullifier: changeSecrets.nullifier.toString(),
                trapdoor: changeSecrets.trapdoor.toString(),
                amount: proofResult.changeNote.amount.toString(),
              },
              changeLeaf: proofResult.changeNote.commitment.toString(),
              withdrawAmount: totalNeeded.toString(),
              all: false,
              // paid to the order's one-time address: not a cash-out
              funding: true,
              recipient: restaurantField,
            };

            // Signed first, so that its hash, its nonce and the signed transaction itself are in
            // the record before it is broadcast: "Check again" can send the same bytes again
            var withdrawTx;
            try {
              withdrawTx = await sendRecorded(ethers, stealthWallet, reputationFromStealth, 'mergeWithdraw', withdrawArgs,
                withdrawOverrides,
                function(sentAs) { addPendingWithdrawal(Object.assign({}, fundingWithdrawal, sentAs)); });
            } catch (sendErr) {
              // refused by the node: the notes are untouched. A connection error says nothing:
              // the record stays until the next check.
              if (sendErr && sendErr.notSent) dropPendingWithdrawal(fundingWithdrawal.changeLeaf);
              throw sendErr;
            }
            var withdrawReceipt;
            try {
              withdrawReceipt = await withdrawTx.wait();
            } catch (waitErr) {
              // reverted: the notes are untouched. Otherwise the outcome is unknown and the record stays.
              if (waitErr && waitErr.receipt && waitErr.receipt.status === 0) dropPendingWithdrawal(fundingWithdrawal.changeLeaf);
              throw waitErr;
            }

            // Mark the notes as spent and store the change note (leafIndex from the NoteAdded log)
            settlePendingWithdrawal(fundingWithdrawal, findNoteLeafIndex(withdrawReceipt, fundingWithdrawal.changeLeaf), withdrawReceipt.transactionHash);
          }

          // Now call prepareOrder from the stealth wallet (estimated gas limit, balance checked)
          var chainContract = new ethers.Contract(CHAIN_ADDRESS, chain.options.jsonInterface, stealthWallet);
          await sendOneTime(chainContract, 'prepareOrder',
            [orderAddress, paymentCommitment, minReputation, minOrders], { value: String(deliveryFee) });
        } else {
          // Fallback: no stealth key, use main wallet (legacy non-stealth orders)
          await sendFromWallet(chain.methods.prepareOrder(orderAddress, paymentCommitment, minReputation, minOrders),
            { from: accounts[0], value: deliveryFee });
        }
      } catch(err) {
        console.error('Accept failed:', parseContractError(err));
        alert(sendErrorText(err));
        setLoading(false);
        return;
      }
      setLoading(false);
      window.location.reload();
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  // The establishment rates through the order, from the order's one-time address (the
  // account the order already shows as the establishment). Ratings are public.
  const rateWorker = async function (worker, score) {
    if (ratingWorker) return;
    setRatingWorker(worker);
    try {
      const orderAddress = await chain.methods.findAddress(orderBlock[0]).call();
      await sendFromStealth('rateOrder', [orderAddress, worker, score]);
      if (mounted.current) {
        setRatingLines(lines => lines.map(line => line.worker === worker
          ? Object.assign({}, line, { score: score, canRate: false })
          : line));
      }
    } catch (err) {
      console.error('Rating failed:', parseContractError(err));
      // the rating is paid by the order's one-time address, from what is left of its gas money:
      // when that is not enough, the message says how much is missing
      alert(isShortOfGasError(err) ? err.message + ' The rating was not sent.' : sendErrorText(err));
    }
    if (mounted.current) setRatingWorker(null);
  }

  let worker_ratings = null;
  if (ratingLines.length > 0) {
    worker_ratings = (
      <div className="worker-ratings">
        <p><span>Delivery workers of this order.</span> A rating is public (order, worker and score) and can be given once per worker.</p>
        {ratingLines.map(line => (
          <div className="worker-rating" key={line.worker}>
            <p><span title={line.worker}>{shortAddress(line.worker)}</span> {outcomeText(line.outcome)}{line.canRate ? ', not rated yet' : ': you rated ' + '★'.repeat(line.score)}</p>
            {line.canRate && (ratingWorker === line.worker
              ? <CircularProgress size={20} />
              : (
                <div className="stars">
                  {[1,2,3,4,5].map(s => (
                    <button type="button" key={s} disabled={!!ratingWorker} aria-label={'Rate ' + shortAddress(line.worker) + ' ' + s + ' of 5'}
                      onClick={() => rateWorker(line.worker, s)}>{s}★</button>
                  ))}
                </div>
              ))}
          </div>
        ))}
      </div>
    );
  }

  let gas_return = null;
  if (ended && gasReturn.state === 'quoted' && gasReturn.offer.offered) {
    gas_return = (
      <div className="gas-return">
        <p className="action-hint">Return unused gas money: sends {formatEth(gasReturn.offer.amount)} left at this order's one-time address to the payment pool as a new note of yours; the transaction costs up to {formatEth(gasReturn.offer.cost)}, paid from that money{gasReturn.offer.reserve > 0n ? ', and ' + formatEth(gasReturn.offer.reserve) + ' stays there for the ratings you can still give' : ''}.</p>
        <Button onClick={() => returnGasMoney()}>Return unused gas money to the pool</Button>
      </div>
    );
  } else if (ended && gasReturn.state === 'sending') {
    gas_return = <div className="gas-return"><p className="action-hint">Returning the unused gas money to the pool...</p><CircularProgress size={20} /></div>;
  } else if (ended && gasReturn.state === 'done') {
    gas_return = <div className="gas-return"><p className="action-hint">{formatEth(gasReturn.returned)} of unused gas money is back in the payment pool as a new note of yours.</p></div>;
  } else if (ended && gasReturn.state === 'failed') {
    gas_return = <div className="gas-return"><p className="action-hint">{gasReturn.message}</p></div>;
  }

  const hasRepRequirements = parseInt(orderBlock[9]) > 0 || parseInt(orderBlock[10]) > 0;

  return (
    <Order>
      <div className="order-header">
        <span className="order-id">Order #{orderBlock[0]}</span>
        <StatusBadge status={step}>{step}</StatusBadge>
      </div>

      {hasRepRequirements && (
        <ReputationBadge>
          <span className="rep-icon">⭐</span>
          <span>Requirements:</span>
          {parseInt(orderBlock[9]) > 0 && (
            <span className="rep-item">
              <span className="rep-label">Min rating</span>
              {(parseInt(orderBlock[9]) / 10).toFixed(1)}★
            </span>
          )}
          {parseInt(orderBlock[10]) > 0 && (
            <span className="rep-item">
              <span className="rep-label">Min orders</span>
              {orderBlock[10]}
            </span>
          )}
        </ReputationBadge>
      )}

      {workerReputation && (
        <WorkerReputationBadge>
          <span className="rep-icon">🚴</span>
          <span>{workerRecordText(workerReputation)}</span>
        </WorkerReputationBadge>
      )}

      <div className="customer-info">
        <p><span>Delivery fee:</span> U${priceUtils.weiToDollars(orderBlock[2])}</p>
        {readMore && <p><span>Items total:</span> U${items.reduce((sum, item) => sum + item.quantity * item.price, 0)}</p>}
        <p><span>Placed:</span> <Moment unix>{orderBlock[6]}</Moment></p>
        <p><span>Updated:</span> <Moment unix>{orderBlock[7]}</Moment></p>
      </div>

      { readMore ? (
        <div className="order-info">
          {items.map((item, index) => (
            <ItemLine key={index} quantity={item.quantity} itemName={item.name} />
          ))}
        </div>
      ) : (
        <div className="customer-info">
          <button onClick={decryptDetails} style={{fontSize:'13px', background:'none', border:'1px solid #ddd', borderRadius:'6px', padding:'5px 10px', cursor:'pointer'}}>
            Show items
          </button>
        </div>
      )}

      {pickup_key}

      {worker_ratings}

      {gas_return}

      {loading ? <CircularProgress style={{margin:'10px auto', display:'block'}} /> :
        <div className="accept-btn">
          {rep_inputs}
          {button_cancel}
          {button_second}
          {button_timeout}
          {button_accept}
        </div>
      }
    </Order>
  )
}

