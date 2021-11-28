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
  OrderAgain,
  ButtonsContainer
} from './styles';
import { decrypt } from '../../utils/crypto';

import {useWeb3} from '../../services/getWeb3';
import { set } from 'lodash';
const ethUtil = require('ethereumjs-util');
const sigUtil = require('eth-sig-util');


var crypto = require('crypto');
export default function Orders({ address, restaurant, orderBlock }) {
  let button_accept;
  let button_cancel;
  let information_text = null;
  const [loading, setLoading] = useState(false);
  const { web3, chain, interact, storage } = useWeb3();
  const [readMore, setReadMore] =  useState(false);
  const [items, setItems] = useState([]);
  const [customer_information, setCustomerInformation] = useState(null);
  
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
  } else {
    button_accept = null;
    button_cancel = null;
  }

  function handleChange(e) {
    setCustomerInformation(e.target.value);
  }

  const decryptDetails = async function () {
    const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
    const unecryptedItems = await decrypt(accounts[0], orderBlock[1]);
    const json_obj = JSON.parse(unecryptedItems);
    json_obj.map(item=>{console.log(item);})
    setItems(json_obj);
    setReadMore(true);
  }

  const cancelOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let gas_estimated = await web3.eth.getGasPrice();
      console.log(gas_estimated)
      let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
      console.log(orderAddress);
      let result = await interact.methods.cancelOrder(orderAddress)
      .send({ from: accounts[0], gasPrice: gas_estimated, gas: 4000000});
    
    
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
      let gas_estimated = await web3.eth.getGasPrice();
      let halves = await storage.methods.getDeliveryman(order_id).call({from: accounts[0]});
      let encryptPublicKey = ethers.utils.parseBytes32String(halves[0]) + ethers.utils.parseBytes32String(halves[1]);

      let encoded = ethUtil.bufferToHex(
        Buffer.from(JSON.stringify(
          sigUtil.encrypt(
            encryptPublicKey,
            { data: customer_information},
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
      // console.log(encoded);
      // let decrypted = await window.ethereum.request({method: 'eth_decrypt', params: [encoded, accounts[0]]})

      await storage.methods.addInformation(order_id, encoded, encoded_items)
      .send({ from: accounts[0], gasPrice: gas_estimated, gas: 4000000});
  
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
        <p>Delivery fee: {orderBlock[2]}</p>
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