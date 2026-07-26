/* global BigInt */
import React, { useState } from 'react';
import Moment from 'react-moment';
import { CircularProgress } from '@material-ui/core';
import { ethers } from "ethers";
import {
  Button,
  OrdersContainer,
  Order,
  OrderDetails,
  RestaurantThumbnail,
  ButtonsContainer
} from './styles';
import { decrypt } from '../../utils/crypto';
import { generateRatingProof } from '../../utils/zkUtils';
import { parseContractError } from '../../utils/contractErrors';
import { poseidon2 } from '../../utils/poseidon';
import { REPUTATION_ADDRESS, REPUTATION_ABI } from '../../services/config';

import {useWeb3} from '../../services/getWeb3';
var priceUtils = require('../../utils/priceUtils');
const ethUtil = require('ethereumjs-util');
const sigUtil = require('eth-sig-util');


export default function Orders({ address, restaurant, orderBlock }) {
  let button_accept;
  let button_cancel;
  let information_text = null;
  const [loading, setLoading] = useState(false);
  const { web3, logWeb3, chain, storage } = useWeb3();
  const [readMore, setReadMore] =  useState(false);
  const [items, setItems] = useState([]);
  const [customer_information, setCustomerInformation] = useState(null);
  const [rating, setRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const [token, setToken] = useState(null);
  
  console.log('restaurant'+restaurant);
  
  if (orderBlock[3] === 'ORDERED'){
    button_accept = null;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel my order by time (free of charge)</Button>;
  } else if (orderBlock[3] === 'PREPARATION') {
    button_accept = null;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel my order</Button>;
  } else if (orderBlock[3] === 'WAITING') {
    button_accept = <Button atention onClick={() => addAddress(orderBlock[0])}>Send my address</Button>;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel my order </Button>;
    information_text = <input maxLength="150" type="text" onChange={ handleChange } />;
  } else if (orderBlock[3] === 'DISPATCHED') {
    button_accept = null;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel my order </Button>;
  } else if (orderBlock[3] === 'CONCLUDED') {
    button_accept = null;
    button_cancel = null;
    if (!ratingDone && REPUTATION_ADDRESS && orderBlock[8] && orderBlock[8] !== '0x0000000000000000000000000000000000000000') {
      button_accept = ratingLoading
        ? <CircularProgress size={20} />
        : (
          <div>
            <p>Rate the deliveryman anonymously:</p>
            {[1,2,3,4,5].map(s => (
              <Button key={s} onClick={() => submitRatingHandler(s)}>{'★'.repeat(s)}</Button>
            ))}
          </div>
        );
    } else if (ratingDone) {
      button_accept = <p>Thank you for your anonymous rating!</p>;
    }
  } else {
    button_accept = null;
    button_cancel = null;
  }

  function handleChange(e) {
    setCustomerInformation(e.target.value);
  }

  const submitRatingHandler = async function (score) {
    if (!orderBlock[8] || orderBlock[8] === '0x0000000000000000000000000000000000000000') {
      alert('No deliveryman found for this order.');
      return;
    }
    setRatingLoading(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

      // Pre-check: compute nullifierHash cheaply and verify it hasn't been used
      const orderSecrets = JSON.parse(localStorage.getItem('orderSecrets') || '{}');
      const secrets = orderSecrets[orderBlock[0]];
      if (!secrets) throw new Error('Rating secrets not found — was the order placed from this browser?');
      const preNullifierHash = poseidon2([BigInt(secrets.nullifier), BigInt(orderBlock[8])]).toString();
      const reputationContract = new (logWeb3 || web3).eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS);
      const alreadyUsed = await reputationContract.methods.usedNullifiers(preNullifierHash).call();
      if (alreadyUsed) {
        alert('You have already rated this delivery worker.');
        setRatingLoading(false);
        setRatingDone(true);
        return;
      }

      const { a, b, c, nullifierHash, root } = await generateRatingProof(
        web3, reputationContract, orderBlock[8], score, orderBlock[0]
      );
      await chain.methods.submitRating(
        REPUTATION_ADDRESS, orderBlock[8], score, nullifierHash, root, a, b, c
      ).send({ from: accounts[0], gas: 4000000 });
      setRatingDone(true);
      setRating(score);
    } catch (err) {
      console.error('Rating submission failed:', err);
      alert(parseContractError(err));
    }
    setRatingLoading(false);
  };

  const decryptDetails = async function () {
    const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
    let unecryptedItems;
    if (orderBlock[1] && orderBlock[1].startsWith('0x')) {
      unecryptedItems = await decrypt(accounts[0], orderBlock[1]);
    } else {
      unecryptedItems = orderBlock[1];
    }
    let tokenVal = null;
    if (orderBlock[9]) {
      tokenVal = orderBlock[9].startsWith('0x')
        ? await decrypt(accounts[0], orderBlock[9])
        : orderBlock[9];
    }
    setToken(tokenVal);
    const json_obj = JSON.parse(unecryptedItems);
    json_obj.map(item=>{console.log(item);})
    setItems(json_obj);
    setReadMore(true);
  }

  const cancelOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
      console.log(orderAddress);
      let result = await chain.methods.cancelOrder(orderAddress)
      .send({ from: accounts[0], gas: 4000000});
    
    
      console.log(result);
      setLoading(false);
      window.location.reload();
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  const addAddress = async function (order_id) {
    if (window.ethereum && customer_information && readMore){
      setLoading(true);
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let halves = await storage.methods.getDeliveryman(order_id).call({from: accounts[0]});
      let encryptPublicKey = ethers.utils.parseBytes32String(halves[0]) + ethers.utils.parseBytes32String(halves[1]);

      // Include restaurant info in the address payload so the delivery worker
      // can discover where to pick up (two-phase revelation for stealth privacy)
      const orderRestaurantInfo = JSON.parse(localStorage.getItem('orderRestaurantInfo') || '{}');
      const restInfo = orderRestaurantInfo[order_id] || {};
      const addressPayload = JSON.stringify({
        deliveryAddress: customer_information,
        restaurantId: restInfo.id || null,
      });

      let encoded = ethUtil.bufferToHex(
        Buffer.from(JSON.stringify(
          sigUtil.encrypt(
            encryptPublicKey,
            { data: addressPayload},
            'x25519-xsalsa20-poly1305'
          )
        ), 'utf8')
      );

      let encoded_items = ethUtil.bufferToHex(
        Buffer.from(JSON.stringify(
          sigUtil.encrypt(
            encryptPublicKey,
            { data: JSON.stringify(items)},
            'x25519-xsalsa20-poly1305'
          )
        ), 'utf8')
      );

      await storage.methods.addInformation(order_id, encoded, encoded_items)
      .send({ from: accounts[0], gas: 4000000});

      setLoading(false);
      window.location.reload();
    } else if (!readMore) {
      console.log('YOU MUST GET MORE DETAILS!');
    }
    else {
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
        <p>My secret code: {orderBlock[5]}</p>
        <p>Status: {orderBlock[3]} </p>
        <p>Delivery fee: U${priceUtils.weiToDollars(orderBlock[2])}</p>
        { readMore ? <p>Rating Token: {token}</p> : <p></p>}
        {console.log('componente: '+items[0])}

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
      
        </div>
      </OrderDetails>
    </Order>}
  </OrdersContainer>
  )
}