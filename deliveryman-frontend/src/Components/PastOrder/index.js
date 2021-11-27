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


export default function Orders({ restaurant, orderBlock }) {
  let button_accept;
  let button_cancel;
  let button_cancel_time;
  const [clientCode, setCode] = useState(null);
  const [loading, setLoading] = useState(false);  
  const [readMore, setReadMore] =  useState(false);
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState(null);
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
    button_cancel_time = <input maxLength="5" type="text" onChange={ handleChange } />;
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
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let gas_estimated = await web3.eth.getGasPrice();
      let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
      let result = await interact.methods.cancelOrder(orderAddress)
      .send({ from: accounts[0], gasPrice: gas_estimated, gas: 4000000});
    
    
      console.log(result);
      setLoading(false);
      window.location.reload();
    } else {
      console.log('Connect to MetaMask!');
    }
  }
  
  
  const deliveryOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let gas_estimated = await web3.eth.getGasPrice();
      let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
      let result = await interact.methods.deliveryOrder(orderAddress, clientCode)
      .send({ from: accounts[0], gasPrice: gas_estimated, gas: 4000000});
    
    
      console.log(result);
      setLoading(false);
      window.location.reload();
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  const decryptDetails = async function () {
    const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
    let orderAddress = await storage.methods.readInformation(orderBlock[0]).call({from: accounts[0]});
    console.log(orderAddress);
    const unecryptedItems = await decrypt(accounts[0], orderAddress[1]);
    const unecryptedAddress = await decrypt(accounts[0], orderAddress[0]);
    const json_items = JSON.parse(unecryptedItems);
    setItems(json_items);
    setAddress(unecryptedAddress);
    setReadMore(true);
  }


  return (
    <OrdersContainer>
    {loading?<CircularProgress />:
      <Order>
        <OrderDetails>
          <RestaurantThumbnail banner={restaurant.banner_path} />
          <div className="details">
            <h2>{restaurant.restaurant_name}</h2>
            <p><b>Restaurant:</b> {orderBlock[4]}</p>
            <p><b> Created at:</b> <Moment unix>{orderBlock[6]}</Moment> &middot; <b>Last updated at:</b> <Moment unix>{orderBlock[7]}</Moment></p>
            <p><b>Secret code:</b>  {orderBlock[5]}</p>
            <p><b>Client's name and address:</b>  {address}</p>
            <p><b>Status:</b>  {orderBlock[3]} </p>
            <p><b>Delivery fee:</b>  {orderBlock[2]}</p>
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