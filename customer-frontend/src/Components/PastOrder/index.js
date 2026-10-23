import React, { useEffect, useState } from 'react';
import Moment from 'react-moment';
import { CircularProgress } from '@material-ui/core';
import { ethers } from "ethers";
import {
  Button,
  OrdersContainer,
  Order,
  OrderDetails,
  RestaurantThumbnail,
  ButtonsContainer,
  HandoverContainer
} from './styles';
import HandoverQR from '../HandoverQR';
import WorkerRatings from '../WorkerRatings';
import { decrypt } from '../../utils/crypto';
import { parseContractError, errorText, detailsErrorText } from '../../utils/contractErrors';
import { withEstimatedGas } from '../../utils/txGas';
import { loadDeployment } from '../../utils/deploymentStorage';
import { pickupSecretOf, committedWorkerAndKey, sealForWorker, NO_PICKUP_SECRET_WARNING } from '../../utils/lateRelease';
import { orderSecretsFor, orderRestaurantInfoFor, adoptPendingOrder } from '../../utils/orderSecrets';
import {
  workersOfOrder, currentCommitment, readWorkerRatings, customerRatingState, detailsSentTo, workerNotice,
} from '../../utils/orderWorkers';
import { REPUTATION_ADDRESS, REPUTATION_ABI, STORAGE_ADDRESS, DEPLOY_BLOCK } from '../../services/config';

import {useWeb3} from '../../services/getWeb3';
var priceUtils = require('../../utils/priceUtils');
const ethUtil = require('ethereumjs-util');
const sigUtil = require('eth-sig-util');


// `orderAddress` is the order contract (checked against Chain by the orders page);
// `commitments` are the workers who committed to it, from its OrderActors logs.
// Once the establishment accepted, a cancellation or timeout that pays it puts its
// money back into the payment pool in the same transaction.
export const CANCEL_GAS_NOTE = "Cancelling now also returns the establishment's money to the payment pool, so this transaction costs more gas than the other steps.";

export default function Orders({ address, restaurant, orderBlock, orderAddress, commitments }) {
  let button_accept;
  let button_cancel;
  let cancel_note = null;
  let information_text = null;
  const [loading, setLoading] = useState(false);
  const { web3, logWeb3, chain, storage, reputation } = useWeb3();
  const [readMore, setReadMore] =  useState(false);
  const [items, setItems] = useState([]);
  const [customer_information, setCustomerInformation] = useState(null);
  const [workerRatings, setWorkerRatings] = useState([]);
  const [ratingWorker, setRatingWorker] = useState(null);
  const [detailsSent, setDetailsSent] = useState(null);
  const [handoverSig, setHandoverSig] = useState(null);

  // Which workers of this order the customer can rate, and which they rated: the
  // one who delivered and one who left after pickup. No worker exists in ORDERED.
  useEffect(() => {
    let stale = false;
    async function readRatings() {
      const reader = logWeb3 || web3;
      if (!reader || !REPUTATION_ADDRESS || !orderAddress || orderBlock[3] === 'ORDERED') return;
      const workers = workersOfOrder(commitments, orderBlock[8]);
      if (workers.length === 0) return;
      const reputationReader = new reader.eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS);
      const states = await readWorkerRatings(reputationReader, orderAddress, workers);
      if (!stale) setWorkerRatings(states);
    }
    readRatings();
    return () => { stale = true; };
  }, [web3, logWeb3, orderAddress, commitments, orderBlock]);

  // Whether the delivery details were already sent to the worker committed now.
  useEffect(() => {
    let stale = false;
    async function readDetailsSent() {
      const current = currentCommitment(commitments, orderBlock[8]);
      if (!logWeb3 || !current || orderBlock[3] !== 'WAITING') return;
      try {
        const sent = await detailsSentTo(logWeb3, STORAGE_ADDRESS, orderBlock[0], current.position,
          Math.max(current.blockNumber || 0, DEPLOY_BLOCK || 0));
        if (!stale) setDetailsSent(sent);
      } catch (_) {
        // the logs could not be read: the page says nothing about it
      }
    }
    readDetailsSent();
    return () => { stale = true; };
  }, [logWeb3, commitments, orderBlock]);

  const notice = workerNotice(orderBlock[3], commitments, orderBlock[8], detailsSent);
  // When the worker can read the address, for an order this browser can seal.
  const sealedNotice = orderBlock[3] === 'WAITING' && pickupSecretOf(orderSecretsFor(orderBlock[0], orderAddress))
    ? 'Your address is sent closed: the delivery worker can open it only after the establishment has recorded the pickup of your order.'
    : null;

  if (orderBlock[3] === 'ORDERED'){
    button_accept = null;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel my order by time (free of charge)</Button>;
  } else if (orderBlock[3] === 'PREPARATION') {
    button_accept = null;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel my order</Button>;
    cancel_note = CANCEL_GAS_NOTE;
  } else if (orderBlock[3] === 'WAITING') {
    button_accept = <Button atention onClick={() => addAddress(orderBlock[0])}>Send my address</Button>;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel my order </Button>;
    cancel_note = CANCEL_GAS_NOTE;
    information_text = <input maxLength="150" type="text" placeholder="Your name and delivery address" onChange={ handleChange } />;
  } else if (orderBlock[3] === 'DISPATCHED') {
    button_accept = <Button atention onClick={() => signDelivery(orderBlock[0])}>Confirm delivery</Button>;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel my order </Button>;
    cancel_note = CANCEL_GAS_NOTE;
  } else {
    button_accept = null;
    button_cancel = null;
  }

  function handleChange(e) {
    setCustomerInformation(e.target.value);
  }

  // Delivery confirmation: the customer signs a digest bound to this order and
  // to the committed worker, and hands the signature to the worker at the door.
  const signDelivery = async function (order_id) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const orderAddress = await chain.methods.findAddress(order_id).call({ from: accounts[0] });
      const digest = await chain.methods.handoverDigest(orderAddress, 2, orderBlock[8]).call();
      const signature = await window.ethereum.request({ method: 'personal_sign', params: [digest, accounts[0]] });
      setHandoverSig(signature);
    } catch (err) {
      console.error('Delivery confirmation failed:', errorText(err));
      alert(parseContractError(err));
    }
  };

  // One rating of one worker of this order, 1 to 5, sent by the customer through
  // Chain. It is an ordinary transaction and the rating is public.
  const submitRatingHandler = async function (worker, score) {
    if (ratingWorker) return;
    setRatingWorker(worker);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const ratedOrderAddress = await chain.methods.findAddress(orderBlock[0]).call({ from: accounts[0] });

      // Read again before sending: the page may be older than a rating already given.
      const now = customerRatingState(worker,
        await reputation.methods.orderRatings(ratedOrderAddress, worker).call());
      if (now.rated || !now.canRate) {
        alert(now.rated
          ? 'You have already rated this delivery worker on this order.'
          : 'This delivery worker cannot be rated on this order by the customer.');
        setWorkerRatings(states => states.map(state => state.worker === worker ? now : state));
        setRatingWorker(null);
        return;
      }

      const rating = chain.methods.rateOrder(ratedOrderAddress, worker, score);
      await rating.send(await withEstimatedGas(rating, { from: accounts[0] }));
      setWorkerRatings(states => states.map(state => state.worker === worker
        ? Object.assign({}, state, { score: score, rated: true, canRate: false })
        : state));
    } catch (err) {
      console.error('Rating submission failed:', errorText(err));
      alert(parseContractError(err));
    }
    setRatingWorker(null);
  };

  const decryptDetails = async function () {
    try {
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let unecryptedItems;
      if (orderBlock[1] && orderBlock[1].startsWith('0x')) {
        unecryptedItems = await decrypt(accounts[0], orderBlock[1]);
      } else {
        unecryptedItems = orderBlock[1];
      }
      const json_obj = JSON.parse(unecryptedItems);
      setItems(json_obj);
      setReadMore(true);
    } catch (err) {
      // the error itself is not printed: a format error can quote the items
      const text = detailsErrorText(err);
      console.error('Could not open the order details:', text);
      alert(text);
    }
  }

  const cancelOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        const cancellation = chain.methods.cancelOrder(orderAddress);
        await cancellation.send(await withEstimatedGas(cancellation, { from: accounts[0] }));
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error('Cancelling the order failed:', errorText(err));
        alert(parseContractError(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  const addAddress = async function (order_id) {
    // The items go to the worker with the address, so they must be open here first.
    if (!readMore) {
      alert('Nothing was sent. Press "More details" first: your items are sent to the delivery worker together with your address.');
      return;
    }
    if (!customer_information || !customer_information.trim()) {
      alert('Nothing was sent. Type your name and delivery address in the field next to the button, then press "Send my address" again.');
      return;
    }
    if (window.ethereum){
      setLoading(true);
      let accounts;
      let encoded;
      let encoded_items;

      // Read now, not from the page: the secrets must belong to the order contract
      // that has this id, and another worker may have committed since the page loaded.
      // The worker is read before and after their encryption key, so that the key
      // and the pickup key are of the same worker.
      let secrets;
      let restInfo;
      let current;
      try {
        accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        // the secrets are kept for this chain and Chain contract
        await loadDeployment(web3);
        const orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        adoptPendingOrder(order_id, orderAddress, orderBlock[4]);
        secrets = orderSecretsFor(order_id, orderAddress);
        // Restaurant info goes in the address payload so the delivery worker
        // can discover where to pick up (two-phase revelation for stealth privacy)
        restInfo = orderRestaurantInfoFor(order_id, orderAddress) || {};
        current = await committedWorkerAndKey(chain, orderAddress, accounts[0], async function () {
          const halves = await storage.methods.getDeliveryman(order_id).call({from: accounts[0]});
          return ethers.utils.parseBytes32String(halves[0]) + ethers.utils.parseBytes32String(halves[1]);
        });
      } catch (err) {
        console.error('Could not read the order:', errorText(err));
        alert(parseContractError(err));
        setLoading(false);
        return;
      }
      if (current.changed) {
        alert('The delivery worker of this order changed while your address was being prepared. Nothing was sent. Reload the page and try again.');
        setLoading(false);
        return;
      }
      if (current.status !== 'WAITING' || !current.worker) {
        // Also when the worker left and the order is offered again: the details
        // would go to the worker who left.
        alert('No delivery worker is committed to this order at the moment. Nothing was sent. Reload the page and try again.');
        setLoading(false);
        return;
      }
      const encryptPublicKey = current.encryptPublicKey;

      // Late release: the worker gets only the establishment now. The address and
      // the items are sealed for the pickup key, which the establishment shows once
      // the pickup of the order is recorded.
      const pickupSecret = pickupSecretOf(secrets);
      if (pickupSecret) {
        try {
          const strings = sealForWorker(encryptPublicKey, pickupSecret, order_id, current.worker,
            restInfo.id || null, customer_information, items);
          encoded = strings.first;
          encoded_items = strings.second;
        } catch (err) {
          console.error('Could not seal the delivery details:', err.message);
          alert('Could not prepare the delivery details. Nothing was sent.');
          setLoading(false);
          return;
        }
      } else {
        // No pickup secret here (order placed before the pickup key existed, or in
        // another browser): the details can only go straight to the worker, as
        // before. The customer decides.
        if (!window.confirm(NO_PICKUP_SECRET_WARNING)) {
          setLoading(false);
          return;
        }
        const addressPayload = JSON.stringify({
          deliveryAddress: customer_information,
          restaurantId: restInfo.id || null,
        });

        encoded = ethUtil.bufferToHex(
          Buffer.from(JSON.stringify(
            sigUtil.encrypt(
              encryptPublicKey,
              { data: addressPayload},
              'x25519-xsalsa20-poly1305'
            )
          ), 'utf8')
        );

        encoded_items = ethUtil.bufferToHex(
          Buffer.from(JSON.stringify(
            sigUtil.encrypt(
              encryptPublicKey,
              { data: JSON.stringify(items)},
              'x25519-xsalsa20-poly1305'
            )
          ), 'utf8')
        );
      }

      try {
        const details = storage.methods.addInformation(order_id, encoded, encoded_items);
        await details.send(await withEstimatedGas(details, { from: accounts[0] }));
      } catch (err) {
        console.error('Sending the delivery details failed:', errorText(err));
        alert(parseContractError(err));
        setLoading(false);
        return;
      }

      setLoading(false);
      window.location.reload();
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  return (
  <OrdersContainer>
  {loading?<CircularProgress />:
    <Order>
      <OrderDetails>
        <RestaurantThumbnail banner={restaurant.banner_path} />
        <div className="details">
          <h2>{restaurant.restaurant_name}</h2>
        <p>Restaurant: {orderBlock[4]}</p>
        <p> Created at: <Moment unix>{orderBlock[6]}</Moment> &middot; 
          Last updated at: <Moment unix>{orderBlock[7]}</Moment></p>
        {handoverSig ? <div>
          <p>Delivery confirmation (let the delivery worker scan the QR code, or give them the text, only after you receive your order):</p>
          <HandoverContainer>
            <HandoverQR value={handoverSig} />
            <textarea readOnly rows={3} cols={48} value={handoverSig} onFocus={e => e.target.select()} />
          </HandoverContainer>
        </div> : null}
        <p>Status: {orderBlock[3]} </p>
        {notice ? <p>{notice}</p> : null}
        {sealedNotice ? <p>{sealedNotice}</p> : null}
        <p>Delivery fee: U${priceUtils.weiToDollars(orderBlock[2])}</p>

          { readMore ? 
        <div>
        <p> {items.length} {(items.length > 1) ? "items" : "item"} for U$ {items.reduce(
          (sum, item) => sum+item.quantity*item.price, 0)} </p>
          {items.map((item, index) => (
              <div className="items" key={index}>
                <div className="items-quantity">
                  <div className="quantity">{item.quantity}</div>
                </div>

                <div className="item-detail">
                  <h3>{item.name}</h3>
                </div>
              </div>
            ))}
          </div> : <button onClick={decryptDetails}>More details</button>
          }

        <ButtonsContainer>
          {button_cancel}
          {button_accept}
          {information_text}
        </ButtonsContainer>
        {cancel_note ? <p>{cancel_note}</p> : null}

        <WorkerRatings workers={workerRatings} busyWorker={ratingWorker} onRate={submitRatingHandler} />
      
        </div>
      </OrderDetails>
    </Order>}
  </OrdersContainer>
  )
}