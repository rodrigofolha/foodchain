/* global BigInt */
import React, { useEffect, useState } from 'react';

import Header from '../../Components/Header';

import { Container,  Details, Delivery, Order, PlaceOrder, ClearBasket } from './styles';
import { SecondaryLink, BlackButton } from '../../GlobalStyles';

import { FaMapMarkerAlt, FaClock, FaWindowMinimize } from 'react-icons/fa';
import { MdShoppingBasket } from 'react-icons/md';
import Cash from '../../assets/cash.png';

import api from '../../services/api';
import { useWeb3 } from '../../services/getWeb3';
import { Button, CircularProgress } from '@material-ui/core';
import { encrypt, getEncryptionPublicKey } from '../../utils/crypto';
import { REPUTATION_ADDRESS, STEALTH_ADDRESS, STEALTH_ABI } from '../../services/config';
import { poseidon2 } from '../../utils/poseidon';
import { parseContractError } from '../../utils/contractErrors';
import { deriveStealthAddress, estimateGasStipend } from '../../utils/stealth';
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

  async function handleSubmit(orderAddress) {
    try {
      console.log(JSON.stringify(items));
      const response = await api.post(`/restaurants/${restaurant.id}/order`, 
      {"orderAddress": orderAddress, "items_json": JSON.stringify(items)}, {
      headers: {
        "authorization": localStorage.getItem('authorization'),
        "Content-Type": "application/json"
      },
      data: {
        "order":orderAddress, 
        "items": items
      }
    });
      console.log(response.data);

    } catch (err) {
      console.log(err);
    }
}


  async function makeOrder(content) {
    try {
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      setAccount(accounts[0]);

      // Get encryption key BEFORE showing spinner (triggers MetaMask popup)
      let encryptPublicKey = await getEncryptionPublicKey(accounts[0]);

      setLoading(true);

      let preparedItem = items.map(item => {return {'name': item.name, 'quantity': 1, 'price': parseInt(item.price)}});
      let restaurant_items = encrypt(restaurant.public_key, preparedItem);
      let client_items = encrypt(encryptPublicKey, preparedItem);

      // Generate anonymous rating secrets for ZK proof later
      const nullifier = BigInt('0x' + Array.from(window.crypto.getRandomValues(new Uint8Array(31))).map(b => b.toString(16).padStart(2,'0')).join(''));
      const trapdoor = BigInt('0x' + Array.from(window.crypto.getRandomValues(new Uint8Array(31))).map(b => b.toString(16).padStart(2,'0')).join(''));
      const clientCommitment = poseidon2([nullifier, trapdoor]).toString();

      console.log('[Checkout] Chain contract:', chain.options.address);
      console.log('[Checkout] REPUTATION_ADDRESS:', REPUTATION_ADDRESS);
      let index = await chain.methods.getIndex().call();
      console.log('[Checkout] Current order index:', index);

      // Derive stealth address — mandatory for all orders
      if (!restaurant.spend_public_key) {
        throw new Error('Restaurant does not support privacy (missing spend key). Cannot place order.');
      }

      console.log('[Checkout] Deriving stealth address for restaurant...');
      const stealth = deriveStealthAddress(restaurant.spend_public_key, restaurant.view_public_key);
      var stealthAddr = stealth.stealthAddress;

      // Announce stealth address so restaurant can discover it
      const stealthContract = new web3.eth.Contract(STEALTH_ABI, STEALTH_ADDRESS);
      await stealthContract.methods.announce(
        1, // schemeId: secp256k1 ECDH
        stealthAddr,
        stealth.ephemeralPubKey,
        stealth.viewTag
      ).send({ from: accounts[0], gas: 200000 });

      // Estimate gas stipend for stealth address operations
      var gasStipend = Number(await estimateGasStipend(web3));
      console.log('[Checkout] Stealth address:', stealthAddr, 'Gas stipend:', gasStipend);

      // Scale prices: 1 U$ = 10^15 wei (0.001 ETH)
      var scaledDeliveryFee = priceUtils.dollarsToWei(deliveryFee);
      var scaledTotal = priceUtils.dollarsToWei(parseFloat(total) - deliveryFee);
      var orderTotal = (BigInt(scaledDeliveryFee) + BigInt(scaledTotal) + BigInt(gasStipend)).toString();

      // Wait for receipt, but fall back to a timeout if MetaMask doesn't fire the event
      await new Promise((resolve, reject) => {
        let resolved = false;
        const done = () => { if (!resolved) { resolved = true; resolve(); } };

        chain.methods.makeOrder(
          stealthAddr,
          scaledDeliveryFee,
          scaledTotal,
          restaurant_items,
          client_items,
          clientCommitment,
          REPUTATION_ADDRESS,
          stealthAddr,
          gasStipend,
          zone
        ).send({ from: accounts[0], gas: 5000000, value: orderTotal})
          .on('receipt', done)
          .on('error', (err) => { if (!resolved) { resolved = true; reject(err); } });

        // Fallback: if receipt doesn't fire within 30s, proceed anyway
        setTimeout(done, 30000);
      });

      // Persist secrets so the rating proof can be generated later
      const orderId = parseInt(index) + 1;
      const orderSecrets = JSON.parse(localStorage.getItem('orderSecrets') || '{}');
      orderSecrets[orderId] = { nullifier: nullifier.toString(), trapdoor: trapdoor.toString() };
      localStorage.setItem('orderSecrets', JSON.stringify(orderSecrets));

      // Persist restaurant info per-order for two-phase revelation to deliveryman
      const orderRestaurantInfo = JSON.parse(localStorage.getItem('orderRestaurantInfo') || '{}');
      orderRestaurantInfo[orderId] = {
        id: restaurant.id,
        name: restaurant.restaurant_name || restaurant.name || '',
        address: restaurant.restaurant_address || restaurant.address || '',
      };
      localStorage.setItem('orderRestaurantInfo', JSON.stringify(orderRestaurantInfo));

      setLoading(false);
      history.push('/user');

      // Notify API in background (non-blocking — order is already on-chain)
      chain.methods.findAddress(parseInt(index) + 1).call()
        .then(order => handleSubmit(order))
        .catch(err => console.log('API notification failed (order is on-chain):', err));
    } catch(err) {
      console.error(err);
      alert(parseContractError(err));
      setLoading(false);
    }
  }

  const restaurant = JSON.parse(localStorage.getItem('restaurantInfo'));
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