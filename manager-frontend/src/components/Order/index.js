import React, { useState } from 'react';
import Moment from 'react-moment';

import { Order, Button } from './styles';

import { CircularProgress } from '@material-ui/core';

import ItemLine from '../ItemOrder'
import { decrypt } from '../../utils/crypto';

export default function OrderCard( props ) {
  const {web3, chain, interact, orderBlock, total} = props;
  const [loading, setLoading] = useState(false);
  const [deliveryCode, setCode] = useState(null);
  const [deliveryEvaluation, setEvaluation] = useState(null);
  const [readMore, setReadMore] = useState(false);
  const [items, setItems] = useState([]);
  let button_accept;
  let button_second;
  let button_cancel;
  let text_input;
  if (orderBlock[3] === 'ORDERED'){
    button_accept = <Button onClick={() => prepareOrder(orderBlock[0])}>Accept</Button>;
    button_second = null;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Refuse</Button>;
  } else if (orderBlock[3] === 'PREPARATION') {
    button_accept = null;
    button_second = null;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel</Button>;
  } else if (orderBlock[3] === 'WAITING') {
    button_cancel = <input maxLength="5" type="text" onChange={ handleChange } />;
    button_accept = <Button onClick={() => pickupOrder(orderBlock[0])}>Dispatch order</Button>; //miss code
    button_second = <Button attention onClick={() => callSecondDeliveryman(orderBlock[0])}>Call other deliveryman</Button>;
    // button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel</Button>;
  } else if (orderBlock[3] === 'DISPATCHED') {
    button_accept = <input maxLength="5" type="text" onChange={ handleChange2 } />;
    button_second = <Button attention onClick={() => contestOrder(orderBlock[0])}>Contest order</Button>; //mist boolean
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel</Button>;
  } else if (orderBlock[3] === 'CONCLUDED') {
    button_accept = null;
    button_second = null;
    button_cancel = null;
  } else {
    button_accept = null;
    button_second = null;
    button_cancel = null;
  }

  function handleChange(e) {
    setCode(parseInt(e.target.value));
  }

  function handleChange2(e) {
    setEvaluation("true" === e.target.value.toLowerCase());
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
  
  const callSecondDeliveryman = async function ( order_id) {
    if (window.ethereum){
      setLoading(true);
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let gas_estimated = await web3.eth.getGasPrice();
      console.log(gas_estimated)
      let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
      console.log(orderAddress);
      let result = await interact.methods.callSecondDeliveryman(orderAddress)
      .send({ from: accounts[0], gasPrice: gas_estimated, gas: 4000000, value: parseInt(orderBlock[2])});
    
    
      console.log(result);
      setLoading(false);
      window.location.reload();
    } else {
      console.log('Connect to MetaMask!');
    }
  }
  
  const contestOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let gas_estimated = await web3.eth.getGasPrice();
      console.log(gas_estimated)
      let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
      console.log(orderAddress);
      let result = await interact.methods.contestOrder(orderAddress, deliveryEvaluation)
      .send({ from: accounts[0], gasPrice: gas_estimated, gas: 4000000});
    
    
      console.log(result);
      setLoading(false);
      window.location.reload();
    } else {
      console.log('Connect to MetaMask!');
    }
  }
  
  const pickupOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let gas_estimated = await web3.eth.getGasPrice();
      console.log(gas_estimated)
      let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
      console.log(orderAddress);
      let result = await interact.methods.pickupOrder(orderAddress, deliveryCode)
      .send({ from: accounts[0], gasPrice: gas_estimated, gas: 4000000});
    
    
      console.log(result);
      setLoading(false);
      window.location.reload();
    } else {
      console.log('Connect to MetaMask!');
    }
  }


  const prepareOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let gas_estimated = await web3.eth.getGasPrice();
      console.log(gas_estimated)
      let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
      console.log(orderAddress);
      let total = items.reduce((sum, item) => sum+item.quantity*item.price, parseInt(orderBlock[2]));
      console.log(total)
      let result = await interact.methods.prepareOrder(orderAddress)
      .send({ from: accounts[0], gasPrice: gas_estimated, gas: 4000000, value: parseInt(total)});
    
    
      console.log(result);
      setLoading(false);
      window.location.reload();
    } else {
      console.log('Connect to MetaMask!');
    }
  }
  return (
    <Order>

      { readMore ? <div className="order-info">
      {items.map((item, index) => (
        <ItemLine 
          key={index}
          quantity={item.quantity}
          itemName={item.name}
        />
        ))}
      </div> : 
      <button onClick={decryptDetails}>More details</button> }
      

      <div className="customer-info">
        <div className="status-info">
        <p><span>Status of order: </span>{orderBlock[3]}</p>
        </div>
        <p><span>Total: </span>{items.reduce((sum, item) => sum+item.quantity*item.price, 0)}</p>
        <p><span>Delivery fee: </span>{parseInt(orderBlock[2])}</p>
        <p><span>Created at: </span><Moment unix>{orderBlock[6]}</Moment></p>
        <p><span>Last updated at: </span><Moment unix>{orderBlock[7]}</Moment></p>
      </div>

      {loading ? <CircularProgress /> :
       <div className="accept-btn">
        {button_cancel}
        {button_second}
        {button_accept}
      </div>}
    </Order>
  )
}

