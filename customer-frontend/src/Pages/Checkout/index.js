/* global BigInt */
import React, { useEffect, useState } from 'react';

import Header from '../../Components/Header';

import { Container,  Details, Delivery, Order, PlaceOrder, ClearBasket } from './styles';
import { SecondaryLink, BlackButton } from '../../GlobalStyles';

import { FaMapMarkerAlt, FaClock, FaWindowMinimize } from 'react-icons/fa';
import { MdShoppingBasket } from 'react-icons/md';
import Cash from '../../assets/cash.png';

import { useWeb3 } from '../../services/getWeb3';
import { Button, CircularProgress } from '@material-ui/core';
import { encrypt, getEncryptionPublicKey } from '../../utils/crypto';
import { REPUTATION_ADDRESS, STEALTH_ADDRESS, STEALTH_ABI } from '../../services/config';
import { parseContractError, errorText } from '../../utils/contractErrors';
import { deriveStealthAddress, estimateGasStipend } from '../../utils/stealth';
import { newPickupSecret } from '../../utils/pickupSeal';
import { loadRestaurantInfo } from '../../utils/restaurantInfo';
import { withEstimatedGas } from '../../utils/txGas';
import { loadDeployment } from '../../utils/deploymentStorage';
import {
  resolvePlacedOrder, saveOrderSecrets, hasOrderSecrets, saveOrderRestaurantInfo,
  savePendingOrder, removePendingOrder,
} from '../../utils/orderSecrets';
var deliveryFeeUtils = require('../../utils/deliveryFee');
var priceUtils = require('../../utils/priceUtils');

export default function Checkout({ history }) {
  const [customer, setCustomer] = useState({});
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customerLat, setCustomerLat] = useState(null);
  const [customerLng, setCustomerLng] = useState(null);
  const {web3, chain} = useWeb3();

  const [geoFailed, setGeoFailed] = useState(false);

  useEffect(function() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          setCustomerLat(pos.coords.latitude);
          setCustomerLng(pos.coords.longitude);
        },
        function() {
          console.warn('Geolocation denied, using manual input');
          setGeoFailed(true);
        }
      );
    } else {
      setGeoFailed(true);
    }
  }, []);

  const setUserAccount = async () => {
    if (window.ethereum){
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      setAccount(accounts[0])
      setUserBalance(accounts[0])
    }
  }

  const setUserBalance = async fromAddress => {
    await web3.eth.getBalance(fromAddress).then(value => {
      const credit = web3.utils.fromWei(value, 'ether')
      setBalance(credit)
    })
  }

  async function makeOrder(content) {
    try {
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      setAccount(accounts[0]);

      // Get encryption key BEFORE showing spinner (triggers MetaMask popup)
      let encryptPublicKey = await getEncryptionPublicKey(accounts[0]);

      setLoading(true);

      // The pickup secret is kept for this chain and Chain contract
      await loadDeployment(web3);

      let preparedItem = items.map(item => {return {'name': item.name, 'quantity': 1, 'price': parseInt(item.price)}});
      // Pickup secret: the establishment derives from it the key that releases the
      // delivery address to the worker at pickup.
      const pickupSecret = newPickupSecret();
      let restaurant_items = encrypt(restaurant.public_key, { items: preparedItem, k: pickupSecret });
      let client_items = encrypt(encryptPublicKey, preparedItem);

      console.log('[Checkout] Chain contract:', chain.options.address);
      console.log('[Checkout] REPUTATION_ADDRESS:', REPUTATION_ADDRESS);
      let index = await chain.methods.getIndex().call();
      console.log('[Checkout] Current order index:', index);

      // Derive stealth address — mandatory for all orders
      if (!restaurant.spend_public_key || !restaurant.view_public_key) {
        throw new Error('Restaurant does not support privacy (missing stealth keys). Cannot place order.');
      }

      console.log('[Checkout] Deriving stealth address for restaurant...');
      const stealth = deriveStealthAddress(restaurant.spend_public_key, restaurant.view_public_key);
      var stealthAddr = stealth.stealthAddress;

      // Announce stealth address so restaurant can discover it
      const stealthContract = new web3.eth.Contract(STEALTH_ABI, STEALTH_ADDRESS);
      const announce = stealthContract.methods.announce(
        1, // schemeId: secp256k1 ECDH
        stealthAddr,
        stealth.ephemeralPubKey,
        stealth.viewTag
      );
      await announce.send(await withEstimatedGas(announce, { from: accounts[0] }));

      // Estimate gas stipend for stealth address operations
      // Kept as a decimal string: wei amounts above 2^53 overflow a JS Number
      var gasStipend = (await estimateGasStipend(web3)).toString();

      // Scale prices: 1 U$ = 10^15 wei (0.001 ETH)
      var scaledDeliveryFee = priceUtils.dollarsToWei(deliveryFee);
      var scaledTotal = priceUtils.dollarsToWei(parseFloat(total) - deliveryFee);
      // Chain.makeOrder takes the stipend out of the establishment's total, so the
      // customer pays only items + delivery fee.
      if (BigInt(gasStipend) > BigInt(scaledTotal)) {
        throw new Error('This order is too small to cover the private-withdrawal gas at the current gas price.');
      }
      var orderTotal = (BigInt(scaledDeliveryFee) + BigInt(scaledTotal)).toString();

      // The gas limit is the node's estimate with a margin: the order stores its two
      // item ciphertexts, so its gas grows with the item list and with the network's
      // price of storage. If the estimate says the order would fail, nothing is sent
      // and nothing is kept as pending.
      const order = chain.methods.makeOrder(
        stealthAddr,
        scaledDeliveryFee,
        scaledTotal,
        restaurant_items,
        client_items,
        REPUTATION_ADDRESS,
        stealthAddr,
        gasStipend,
        zone
      );
      const orderOptions = await withEstimatedGas(order, { from: accounts[0], value: orderTotal });

      // Keep the pickup secret before the order is sent, under its stealth address: if
      // this tab is closed during the wait, or the order is mined late, the orders page
      // gives it to the order that has this establishment address.
      const secrets = { pickupSecret: pickupSecret };
      // Restaurant info per order, for the two-phase revelation to the deliveryman
      const restaurantInfo = {
        id: restaurant.id,
        name: restaurant.restaurant_name || restaurant.name || '',
        address: restaurant.restaurant_address || restaurant.address || '',
      };
      if (!savePendingOrder(stealthAddr, secrets, restaurantInfo)) {
        throw new Error('This browser could not keep the pickup secret of the order. The order was not placed.');
      }

      // Wait for receipt, but fall back to a timeout if MetaMask doesn't fire the event
      const receipt = await new Promise((resolve, reject) => {
        let resolved = false;
        const done = (result) => { if (!resolved) { resolved = true; resolve(result || null); } };

        order.send(orderOptions)
          .on('receipt', done)
          .on('error', (err) => { if (!resolved) { resolved = true; reject(err); } });

        // Fallback: if receipt doesn't fire within 30s, proceed anyway
        setTimeout(() => done(null), 30000);
      });

      // Find the id the order really got: another order can be mined between the
      // read of the index and this transaction.
      const placed = await resolvePlacedOrder(web3, chain, accounts[0], index, receipt, hasOrderSecrets);

      // Persist the pickup secret and the establishment of the order. If the order
      // cannot be found yet (for example the transaction is not mined), the pending
      // record stays and the orders page resolves it.
      if (placed) {
        saveOrderSecrets(placed.orderId, secrets, placed.orderAddress);
        saveOrderRestaurantInfo(placed.orderId, restaurantInfo, placed.orderAddress);
        removePendingOrder(stealthAddr);
      }

      // The order exists only on-chain: nothing about it is sent to the API server.
      setLoading(false);
      if (!placed) {
        alert('Your order was sent, but it could not be confirmed on-chain yet. '
          + 'Check your orders in a few minutes, in this browser: it keeps what is needed '
          + 'to keep your address closed until pickup.');
      }
      history.push('/user');
    } catch(err) {
      console.error('Order failed:', errorText(err));
      // Rejected in MetaMask: the order was never sent, so nothing is pending
      if (err && err.code === 4001) removePendingOrder(stealthAddr);
      alert(parseContractError(err));
      setLoading(false);
    }
  }

  const restaurant = loadRestaurantInfo();
  const items = JSON.parse(localStorage.getItem('basket'));
  const subtotal = items
    .map(item => parseFloat(item.price))
    .reduce((acc, curr) => acc + curr, 0)
    .toFixed(2);

  let smallorder = true;
  // subtotal < 15.00 ? smallorder = false : smallorder = true;  

  // const serviceFee = ((subtotal * 5) / 100).toFixed(2);
  var serviceFee = 0;
  var deliveryFee = restaurant.delivery; // fallback to static
  var zone = restaurant.city || '';
  var distanceKm = null;
  if (customerLat && customerLng && restaurant.latitude && restaurant.longitude) {
    distanceKm = deliveryFeeUtils.haversineDistance(restaurant.latitude, restaurant.longitude, customerLat, customerLng);
    deliveryFee = deliveryFeeUtils.calculateDeliveryFee(distanceKm);
  }
  var total = (parseFloat(serviceFee) + parseFloat(subtotal) + deliveryFee).toFixed(2);
  // if (smallorder === true) {
  //   total += 3.00;
  // }

  return ( 
    <>
    <Header />
    <Container>
    { items.length > 0 ?
        <Details>
          <Delivery>
            <h2>Delivery details</h2>
            
            <div className="address">
              <div className="details">
                <h3>{customer.address}</h3>
                <p>Delivery to door, {customer.address}, {customer.address_number}</p>
                <button>Add delivery instructions</button>
              </div>

              <div className="details">
                <h3>25-35 Min</h3>
                <p>Estimated arrival</p>
              </div>
            </div>

            {geoFailed && (
              <div style={{marginTop: '10px', padding: '10px', background: '#fff3cd', borderRadius: '8px'}}>
                <p style={{fontSize: '14px', marginBottom: '8px'}}>Location unavailable. Enter your coordinates for delivery fee calculation:</p>
                <div style={{display: 'flex', gap: '10px'}}>
                  <input type="number" step="any" placeholder="Latitude" style={{flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
                    onChange={function(e) { setCustomerLat(parseFloat(e.target.value) || null); }} />
                  <input type="number" step="any" placeholder="Longitude" style={{flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
                    onChange={function(e) { setCustomerLng(parseFloat(e.target.value) || null); }} />
                </div>
              </div>
            )}

            <h2>Payment</h2>
            
            <div className="payment">
              <img src={Cash} alt="cash"/>
              <h3>Digital coin</h3>
            </div>
            <Button variant="outlined" color="primary"
              onClick={() => setUserAccount()}>
                Connect to MetaMask
              </Button>
              { account ? (
                <>
                <p>Your address: {account}</p>
                <p>Your balance: {balance}</p>
                </>
              ): null}

          </Delivery>

          <Order>
            <div className="order-detail">
              <MdShoppingBasket size={25}/> <h3>From</h3> <SecondaryLink to="/restaurant/name">{restaurant.name}</SecondaryLink>
            </div>

            <div className="order-detail">
              <FaClock size={20}/> <h3>Arriving in 25-35 Min</h3>
            </div>

            <div className="order-detail">
              <FaMapMarkerAlt size={20}/> <h3>Meet at door, {customer.address}</h3>
            </div>

            <div className="receipt">

              <div className="receipt-item">
                <h3>Subtotal &middot; <span>{items.length} item</span></h3>
                <h3>U${subtotal}</h3>
              </div>

              <div className="fees">
                <h3>Fees</h3>

                <div className="receipt-item" style={smallorder ? {display: 'none' } : {display: 'flex'}}>
                  <p>Small order</p>
                  <h3>U$1.00</h3>
                </div>

                <div className="receipt-item">
                  <p>Service</p>
                  <h3>U${serviceFee}</h3>
                </div>

                <div className="receipt-item">
                  <p>Delivery{distanceKm !== null ? ' (' + distanceKm.toFixed(1) + ' km)' : ''}</p>
                  <h3>U${deliveryFee}</h3>
                </div>
                
                <div className="total">
                  <h3>Total</h3>
                  <h3>U${total}</h3>
                </div>
              </div>
            </div>

            <div>
              <h3>No promotion applied</h3>
            </div>

            { loading ? <CircularProgress /> :
            <PlaceOrder onClick={makeOrder.bind(this)}>
              Place order
            </PlaceOrder>}
          </Order>
      </Details>
      :
      <ClearBasket>
          <h2>You’re not picky.</h2>
          <p>You just have discerning taste.</p>
          <BlackButton onClick={() => history.push('/')}>
            Back to restaurants
          </BlackButton>
      </ClearBasket>
    }
    </Container>
    </>
  )
}