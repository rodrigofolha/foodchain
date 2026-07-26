import React, { useState } from 'react';
import { CircularProgress } from '@material-ui/core';
import Moment from 'react-moment';

import {
  Button,
  OrdersContainer,
  Order,
  OrderDetails,
  RestaurantThumbnail,
  ButtonsContainer,
} from './styles';

import {useWeb3} from '../../services/getWeb3';
import { decrypt } from '../../utils/crypto';
import { parseContractError } from '../../utils/contractErrors';
import api from '../../services/api';
var priceUtils = require('../../utils/priceUtils');


export default function Orders({ restaurant: initialRestaurant, orderBlock }) {
  let button_accept;
  let button_cancel;
  let button_cancel_time;
  const [clientCode, setCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [readMore, setReadMore] =  useState(false);
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);
  const [restaurantInfo, setRestaurantInfo] = useState(initialRestaurant || {});
  const { chain, web3, interact, storage } = useWeb3();
  
  if (orderBlock[3] === 'ORDERED'){
    button_accept = null;
    button_cancel= null;
    button_cancel_time = null;
  } else if (orderBlock[3] === 'PREPARATION') {
    button_accept = null;
    button_cancel = null;
    button_cancel_time = null;
  } else if (orderBlock[3] === 'WAITING') {
    button_accept = null;
    button_cancel = null;
    button_cancel_time = null;
  } else if (orderBlock[3] === 'DISPATCHED') {
    button_accept = <Button onClick={() => deliveryOrder(orderBlock[0])}>Delivery order </Button>;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel my order </Button>;
    button_cancel_time = <input maxLength="6" type="text" onChange={ handleChange } />;
  } else if (orderBlock[3] === 'CONCLUDED') {
    button_accept = null;
    button_cancel = null;
    button_cancel_time = null;
  } else {
    button_accept = null;
    button_cancel = null;
    button_cancel_time = null;
  }

  function handleChange(e) {
    setCode(parseInt(e.target.value));
  }

  const cancelOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        let result = await interact.methods.cancelOrder(orderAddress)
        .send({ from: accounts[0], gas: 4000000});
        console.log(result);
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert(parseContractError(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }
  
  
  const deliveryOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        let result = await chain.methods.deliveryOrder(orderAddress, clientCode)
        .send({ from: accounts[0], gas: 4000000});
        console.log(result);
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert(parseContractError(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  const decryptDetails = async function () {
    const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
    let orderAddress = await storage.methods.readInformation(orderBlock[0]).call({from: accounts[0]});
    console.log(orderAddress);
    const unecryptedItems = await decrypt(accounts[0], orderAddress[1]);
    const json_items = JSON.parse(unecryptedItems);
    console.log(json_items);
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
            var res = await api.get('/restaurants/' + parsed.restaurantId + '/menu');
            if (res.data && res.data.restaurant) {
              setRestaurantInfo(res.data.restaurant);
            }
          } catch(apiErr) {
            console.warn('Failed to fetch restaurant from API:', apiErr);
          }
        }
      }
    } catch (_) {
      // Legacy plain-text address — use as-is
    }
    setItems(json_items);
    setAddress(deliveryAddr);
    setReadMore(true);
  }


  return (
    <OrdersContainer>
    {loading?<CircularProgress />:
      <Order>
        <OrderDetails>
          {restaurantInfo.banner_path && <RestaurantThumbnail banner={restaurantInfo.banner_path} />}
          <div className="details">
            <h2>{restaurantInfo.restaurant_name || 'Restaurant'}</h2>
            {restaurantInfo.restaurant_address && <p><b>Address:</b> {restaurantInfo.restaurant_address}</p>}
            <p><b> Created at:</b> <Moment unix>{orderBlock[6]}</Moment> &middot; <b>Last updated at:</b> <Moment unix>{orderBlock[7]}</Moment></p>
            <p><b>Secret code:</b>  {orderBlock[5]}</p>
            <p><b>Client's name and address:</b>  {address}</p>
            <p><b>Status:</b>  {orderBlock[3]} </p>
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
            </div> : orderBlock[3] === 'WAITING'
              ? <p style={{color:'#888', fontSize:'13px'}}>⏳ Waiting for customer to send their address…</p>
              : ['DISPATCHED','CONCLUDED'].includes(orderBlock[3])
                ? <button onClick={decryptDetails}>More details</button>
                : null
            }
  
          <ButtonsContainer>
            {button_cancel_time}
            {button_cancel}
            {button_accept}
          </ButtonsContainer>
        
          </div>
        </OrderDetails>
      </Order>}
    </OrdersContainer>
  )
}