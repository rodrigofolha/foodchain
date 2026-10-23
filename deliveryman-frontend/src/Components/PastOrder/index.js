import React, { useEffect, useRef, useState } from 'react';
import { CircularProgress } from '@material-ui/core';
import Moment from 'react-moment';

import {
  Button,
  OrdersContainer,
  Order,
  OrderDetails,
  RestaurantThumbnail,
  ButtonsContainer,
  PickupKeyBox,
} from './styles';

import {useWeb3} from '../../services/getWeb3';
import { decrypt } from '../../utils/crypto';
import { parseContractError, errorText, detailsErrorText } from '../../utils/contractErrors';
import { withEstimatedGas } from '../../utils/txGas';
import { loadDeployment } from '../../utils/deploymentStorage';
import api from '../../services/api';
import QrCode from '../QrCode';
import QrScanner from '../QrScanner';
import { isHandoverSignature } from '../../utils/handoverSignature';
import { isPickupKey, isSealed, parseWorkerPayload } from '../../utils/pickupSeal';
import { storedPickupKey, storePickupKey, openSealedDetails, detailsState } from '../../utils/pickupKeys';
import { readWorkerInformation, findWorkerCommitment } from '../../utils/orderLogs';
import { leavingNotice, GIVE_UP_GAS_NOTE, CANCEL_GAS_NOTE } from '../../utils/leaving';
import { STORAGE_ADDRESS, DEPLOY_BLOCK } from '../../services/config';
var priceUtils = require('../../utils/priceUtils');

// Public listing entry of an establishment (name, pickup address). It is served by the
// customer routes of the API, next to the deliveryman routes this dApp's client points to.
function listingUrl(restaurantId) {
  var base = String(api.defaults.baseURL || '').replace(/\/deliveryman\/?$/, '');
  return base + '/customer/restaurants/' + encodeURIComponent(restaurantId) + '/menu';
}


export default function Orders({ restaurant: initialRestaurant, orderBlock }) {
  let button_accept;
  let button_cancel;
  let button_cancel_time;
  let button_scan = null;
  let cancel_note = null;
  const [clientSignature, setClientSignature] = useState('');
  const [pickupSig, setPickupSig] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [readMore, setReadMore] =  useState(false);
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);
  // { s, sealed } of an order whose address and items wait for the pickup key
  const [sealedInfo, setSealedInfo] = useState(null);
  const [pickupKeyText, setPickupKeyText] = useState('');
  const [pickupKeyError, setPickupKeyError] = useState(null);
  const [scanningKey, setScanningKey] = useState(false);
  // true when the pickup was signed before the sealed details were loaded
  const [keyStepPending, setKeyStepPending] = useState(false);
  // true when the customer's details are known to be in the older format (no pickup key)
  const [unsealed, setUnsealed] = useState(false);
  // The step of the order. It starts as the page loaded it and is read again from the
  // chain while the pickup confirmation is shown, so that the card follows the dispatch.
  const [status, setStatus] = useState(orderBlock[3]);
  const [statusNote, setStatusNote] = useState(null);
  const mounted = useRef(true);
  const [restaurantInfo, setRestaurantInfo] = useState(initialRestaurant || {});
  const { chain, logWeb3 } = useWeb3();

  // The customer's two ciphertexts for this worker, from the Information logs of Storage.
  // `commitment` is null when the logs do not name this account as a worker of the order.
  function readInformation(orderAddress, account) {
    return readWorkerInformation({
      logWeb3,
      storageAddress: STORAGE_ADDRESS,
      orderAddress,
      orderIndex: orderBlock[0],
      account,
      deployBlock: DEPLOY_BLOCK,
    });
  }
  
  useEffect(() => () => { mounted.current = false; }, []);

  // While the confirmation is on the screen, the establishment is about to dispatch.
  useEffect(() => {
    if (!pickupSig || status !== 'WAITING') return undefined;
    const timer = setInterval(() => { refreshStatus(false); }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupSig, status]);

  if (status === 'ORDERED'){
    button_accept = null;
    button_cancel= null;
    button_cancel_time = null;
  } else if (status === 'PREPARATION') {
    button_accept = null;
    button_cancel = null;
    button_cancel_time = null;
  } else if (status === 'WAITING') {
    button_accept = <Button onClick={() => signPickup(orderBlock[0])}>Confirm pickup</Button>;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Give up this delivery</Button>;
    cancel_note = GIVE_UP_GAS_NOTE;
    button_cancel_time = null;
  } else if (status === 'DISPATCHED') {
    button_accept = <Button onClick={() => deliveryOrder(orderBlock[0])}>Delivery order </Button>;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel my order </Button>;
    cancel_note = CANCEL_GAS_NOTE;
    button_cancel_time = <input type="text" placeholder="Customer's delivery confirmation" value={clientSignature} onChange={ handleChange } />;
    button_scan = <Button type="button" onClick={() => { setScanningKey(false); setScanning(true); }} disabled={scanning}>Scan customer's QR</Button>;
  } else if (status === 'CONCLUDED') {
    button_accept = null;
    button_cancel = null;
    button_cancel_time = null;
  } else {
    button_accept = null;
    button_cancel = null;
    button_cancel_time = null;
  }

  function handleChange(e) {
    setClientSignature(e.target.value.trim());
  }

  // The customer shows the delivery confirmation as a QR code; the scanner
  // only accepts text shaped like a signature. Pasting it still works.
  function handleScan(signature) {
    setClientSignature(signature);
    setScanning(false);
  }

  // Opens the sealed address and items with a pickup key. Returns false if the
  // key does not open them.
  function openWithPickupKey(info, pickupKey, remember) {
    try {
      const details = openSealedDetails(pickupKey, info.s, info.sealed);
      if (remember) storePickupKey(orderBlock[0], pickupKey);
      setItems(details.items);
      setAddress(details.deliveryAddress);
      setPickupKeyError(null);
      setReadMore(true);
      return true;
    } catch (_) {
      return false;
    }
  }

  function wrongPickupKey() {
    setPickupKeyError(status === 'DISPATCHED'
      ? 'This pickup key does not open the delivery details of this order. Nothing is shown. The order is already dispatched: do not leave yet, and ask the establishment to show the pickup key of this order again (it stays on their screen).'
      : 'This pickup key does not open the delivery details of this order. Nothing is shown. Ask the establishment to show the pickup key of this order again.');
  }

  // The establishment shows the pickup key as a QR code once the pickup is recorded;
  // pasting the text works too. No key is taken while the order waits for pickup.
  function submitPickupKey(text) {
    const pickupKey = String(text).trim();
    setScanningKey(false);
    if (status === 'WAITING') return;
    if (!isPickupKey(pickupKey)) {
      wrongPickupKey();
      return;
    }
    if (!sealedInfo) {
      // the customer's details were not loaded on this card yet: load them, then open
      decryptDetails(pickupKey);
      return;
    }
    if (!openWithPickupKey(sealedInfo, pickupKey, true)) wrongPickupKey();
  }

  // Reads the order's step again from the chain. The establishment shows the pickup
  // key only when the order is DISPATCHED with this worker, so the card moves to the
  // key step on the same answer. `asked` is true when the worker pressed the button.
  async function refreshStatus(asked) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (!accounts || !accounts[0]) return;
      const orderAddress = await chain.methods.findAddress(orderBlock[0]).call({ from: accounts[0] });
      const fresh = await chain.methods.getOrder(orderAddress).call({ from: accounts[0] });
      if (!mounted.current) return;
      if (fresh[3] === 'DISPATCHED') {
        setStatus('DISPATCHED');
        setPickupSig(null);
        setStatusNote(null);
      } else if (fresh[3] === 'WAITING') {
        if (asked) setStatusNote('The establishment has not dispatched this order yet.');
      } else {
        // left, replaced or cancelled since the page loaded
        setPickupSig(null);
        setStatusNote('This order is no longer waiting for your pickup. Reload the page.');
      }
    } catch (err) {
      if (asked && mounted.current) setStatusNote('The order could not be read. Try again in a moment.');
    }
  }

  // Pickup confirmation: the worker signs a digest bound to this order and to
  // their own address, and shows the signature to the establishment.
  const signPickup = async function (order_id) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      // The worker signs first: the establishment checks this signature, records the
      // pickup, and only then shows the pickup key. They do not sign while the customer
      // has sent nothing yet: there would be no address for the key to open.
      const orderAddress = await chain.methods.findAddress(order_id).call({ from: accounts[0] });
      if (!readMore && !sealedInfo) {
        const { commitment, information } = await readInformation(orderAddress, accounts[0]);
        if (!commitment) {
          alert('Your commitment to this order was not found yet. Wait a moment and try again; if you left this order, reload the page.');
          return;
        }
        const state = detailsState(information);
        if (state === 'none') {
          alert("The customer has not sent the delivery details yet. Wait for the customer's details before you confirm the pickup.");
          return;
        }
        setKeyStepPending(state === 'sealed');
        setUnsealed(state === 'legacy');
      }
      const digest = await chain.methods.handoverDigest(orderAddress, 1, accounts[0]).call();
      const signature = await window.ethereum.request({ method: 'personal_sign', params: [digest, accounts[0]] });
      setPickupSig(signature);
    } catch (err) {
      console.error('Pickup confirmation failed:', errorText(err));
      alert(parseContractError(err));
    }
  };

  // Leaving is counted on the worker's record and lets them be rated: they are told
  // before the transaction is sent.
  const cancelOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        // The step is read again first: what leaving means depends on it, and the card
        // may not have followed a dispatch yet.
        const fresh = await chain.methods.getOrder(orderAddress).call({from: accounts[0]});
        const step = fresh[3];
        if (step !== 'WAITING' && step !== 'DISPATCHED') {
          alert('This order changed since this page was loaded: it is no longer yours to leave. Nothing was sent. Reload the page.');
          setLoading(false);
          return;
        }
        if (step !== status) {
          setStatus(step);
          setPickupSig(null);
          setStatusNote(null);
        }
        let position = null;
        if (step === 'WAITING') {
          // first or second worker: the first one's leaving reopens the order
          const commitment = await findWorkerCommitment({ logWeb3, orderAddress, account: accounts[0], deployBlock: DEPLOY_BLOCK })
            .catch(() => null);
          position = commitment ? commitment.position : null;
        }
        if (!window.confirm(leavingNotice(step, position, fresh[7] || orderBlock[7], Math.floor(Date.now() / 1000)))) {
          setLoading(false);
          return;
        }
        // The gas limit is the node's estimate with a margin: a leaving that ends the
        // order also puts the establishment's money back into the payment pool.
        const cancellation = chain.methods.cancelOrder(orderAddress);
        let result = await cancellation.send(await withEstimatedGas(cancellation, { from: accounts[0] }));
        console.log(result);
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error('Leaving the order failed:', errorText(err));
        alert(parseContractError(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }
  
  
  const deliveryOrder = async function (order_id) {
    if (!isHandoverSignature(clientSignature)) {
      alert("Scan or paste the customer's delivery confirmation first (0x followed by 130 hex characters).");
      return;
    }
    if (window.ethereum){
      setLoading(true);
      try {
        const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        const delivery = chain.methods.deliveryOrder(orderAddress, clientSignature);
        let result = await delivery.send(await withEstimatedGas(delivery, { from: accounts[0] }));
        console.log(result);
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error('Delivery failed:', errorText(err));
        alert(parseContractError(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  // Loads what the customer sent to this worker. `scannedKey` is the pickup key the
  // worker has just scanned or pasted, if any.
  const decryptDetails = async function (scannedKey) {
    try {
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      // The pickup keys are kept for this chain and Chain contract. Without the chain
      // id no key is read or kept, and the details can still be opened.
      await loadDeployment().catch(() => null);
      const orderContract = await chain.methods.findAddress(orderBlock[0]).call({from: accounts[0]});
      const { commitment, information: orderAddress } = await readInformation(orderContract, accounts[0]);
      if (!commitment) {
        alert('Your commitment to this order was not found yet. Wait a moment and try again; if you left this order, reload the page.');
        return;
      }
      if (detailsState(orderAddress) === 'none') {
        alert('The customer has not sent the delivery details yet.');
        return;
      }

      // Late release: only the first string is for the worker's key. It names the
      // establishment; the address and the items wait for the pickup key.
      if (isSealed(orderAddress[1])) {
        const payload = parseWorkerPayload(await decrypt(accounts[0], orderAddress[0]));
        if (!payload.s) {
          alert('The delivery details of this order are not in a format this app can open.');
          return;
        }
        if (payload.restaurantId) {
          try {
            const listing = await api.get(listingUrl(payload.restaurantId));
            if (listing.data && listing.data.restaurant) {
              setRestaurantInfo(listing.data.restaurant);
            }
          } catch (apiErr) {
            console.warn('Failed to fetch restaurant from API:', apiErr.message);
          }
        }
        const info = { s: payload.s, sealed: orderAddress[1] };
        setSealedInfo(info);
        // After a reload, the key that opened this order before opens it again.
        const knownKey = storedPickupKey(orderBlock[0]);
        if (isPickupKey(scannedKey)) {
          if (!openWithPickupKey(info, scannedKey, true) && !(knownKey && openWithPickupKey(info, knownKey, false))) wrongPickupKey();
        } else if (knownKey) {
          openWithPickupKey(info, knownKey, false);
        }
        return;
      }
      setUnsealed(true);

      const unecryptedItems = await decrypt(accounts[0], orderAddress[1]);
      const json_items = JSON.parse(unecryptedItems);
      const unecryptedAddress = await decrypt(accounts[0], orderAddress[0]);
      // Parse two-phase payload: may be JSON with restaurant info or plain string (legacy)
      var deliveryAddr = unecryptedAddress;
      try {
        var parsed = JSON.parse(unecryptedAddress);
        if (parsed.deliveryAddress) {
          deliveryAddr = parsed.deliveryAddress;

          // If restaurantId is available, fetch full data from API (includes banner, etc.)
          if (parsed.restaurantId) {
            try {
              var res = await api.get(listingUrl(parsed.restaurantId));
              if (res.data && res.data.restaurant) {
                setRestaurantInfo(res.data.restaurant);
              }
            } catch(apiErr) {
              console.warn('Failed to fetch restaurant from API:', apiErr.message);
            }
          }
        }
      } catch (_) {
        // Legacy plain-text address — use as-is
      }
      setItems(json_items);
      setAddress(deliveryAddr);
      setReadMore(true);
    } catch (err) {
      // The error itself is not printed, and only a wallet or contract error is
      // described: any other message can quote the details.
      const text = detailsErrorText(err);
      console.error('Could not open the delivery details:', text);
      alert(text);
    }
  }


  // Where the pickup key is given. It is offered only after the pickup is recorded:
  // in WAITING the card only says what will happen.
  const detailsClosed = !readMore && !unsealed;
  let keyBox = null;
  if (detailsClosed && status === 'WAITING' && sealedInfo) {
    keyBox = (
      <PickupKeyBox>
        {pickupSig
          ? <p>The delivery address and the items are released at pickup: show the code above to the establishment; when they dispatch the order they show you the pickup key, which opens them.</p>
          : <p>The delivery address and the items are released at pickup: at the establishment, press Confirm pickup and show them the code; when they dispatch the order they show you the pickup key, which opens the delivery address.</p>}
      </PickupKeyBox>
    );
  } else if (detailsClosed && (status === 'DISPATCHED' || sealedInfo)) {
    keyBox = (
      <PickupKeyBox>
        {status !== 'DISPATCHED'
          ? <p>The delivery address and the items of this order are closed. The pickup key of this order opens them: paste it below.</p>
          : sealedInfo
            ? <p>The order was dispatched, but the delivery address and the items are not open here yet: before you leave, scan the pickup key on the establishment's screen, or paste it below.</p>
            : <p>The order was dispatched. Before you leave, scan the pickup key on the establishment's screen, or paste it below: it opens the delivery address and the items. If you already opened them on this device, press More details.</p>}
        <div className="pickup-key-row">
          <Button type="button" onClick={() => { setScanning(false); setScanningKey(true); }} disabled={scanningKey}>Scan pickup key</Button>
          <input type="text" placeholder="Pickup key" value={pickupKeyText} onChange={e => setPickupKeyText(e.target.value.trim())} />
          <Button type="button" onClick={() => submitPickupKey(pickupKeyText)}>Open delivery details</Button>
        </div>
        {pickupKeyError ? <p className="error">{pickupKeyError}</p> : null}
        {scanningKey ?
          <QrScanner
            onScan={submitPickupKey}
            onClose={() => setScanningKey(false)}
            validate={isPickupKey}
            invalidMessage="This QR code is not a pickup key. Ask the establishment to show it again."
            prompt="Point the camera at the pickup key QR code the establishment shows you."
          /> : null}
      </PickupKeyBox>
    );
  }
  const keyBoxFirst = status === 'DISPATCHED';

  return (
    <OrdersContainer>
    {loading?<CircularProgress />:
      <Order>
        <OrderDetails>
          {restaurantInfo.banner_path && <RestaurantThumbnail banner={restaurantInfo.banner_path} />}
          <div className="details">
            {keyBoxFirst ? keyBox : null}
            <h2>{restaurantInfo.restaurant_name || 'Restaurant'}</h2>
            {restaurantInfo.restaurant_address && <p><b>Address:</b> {restaurantInfo.restaurant_address}</p>}
            <p><b> Created at:</b> <Moment unix>{orderBlock[6]}</Moment> &middot; <b>Last updated at:</b> <Moment unix>{orderBlock[7]}</Moment></p>
            {pickupSig ? <div>
              <p><b>Pickup confirmation.</b> {(sealedInfo || keyStepPending) && !readMore
                ? 'Show this code to the establishment (they scan it, or you copy the text below). When they dispatch the order they show you the pickup key, which opens the delivery address.'
                : 'Let the establishment scan it (or copy the text below) so that they can dispatch the order.'}</p>
              <QrCode value={pickupSig} label="Pickup confirmation QR code" />
              <br />
              <textarea readOnly rows={3} cols={48} value={pickupSig} onFocus={e => e.target.select()} />
              <br />
              <Button type="button" onClick={() => refreshStatus(true)}>The establishment dispatched the order</Button>
            </div> : null}
            {statusNote ? <p>{statusNote}</p> : null}
            <p><b>Client's name and address:</b>  {address}</p>
            <p><b>Status:</b>  {status} </p>
            <p><b>Delivery fee:</b>  U${priceUtils.weiToDollars(orderBlock[2])}</p>
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
            </div> : <div>
              {keyBoxFirst ? null : keyBox}
              {!sealedInfo && ['WAITING','DISPATCHED','CONCLUDED'].includes(status)
                ? <button onClick={() => decryptDetails()}>More details</button>
                : null}
            </div>
            }
  
          <ButtonsContainer>
            {button_cancel_time}
            {button_scan}
            {button_cancel}
            {button_accept}
          </ButtonsContainer>
          {cancel_note ? <p>{cancel_note}</p> : null}
          {scanning && status === 'DISPATCHED' ?
            <QrScanner
              onScan={handleScan}
              onClose={() => setScanning(false)}
              validate={isHandoverSignature}
              invalidMessage="This QR code is not a delivery confirmation. Ask the customer to show it again."
              prompt="Point the camera at the customer's delivery confirmation QR code."
            /> : null}
        
          </div>
        </OrderDetails>
      </Order>}
    </OrdersContainer>
  )
}
