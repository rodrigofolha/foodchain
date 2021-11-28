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
import { ThemeConsumer } from 'styled-components';
import { encrypt } from '../../utils/crypto';

export default function Checkout({ history }) {
  const [customer, setCustomer] = useState({});
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const {web3, chain} = useWeb3();

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
    setLoading(true);
    console.log(content)
    const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
    setAccount(accounts[0])
    console.log('customer: '+account)
    let preparedItem = items.map(item => {return {'name': item.name, 'quantity': 1, 'price': parseInt(item.price)}})
    let restaurant_items = encrypt(restaurant.public_key, preparedItem);

    let encryptPublicKey = await window.ethereum.request({method: 'eth_getEncryptionPublicKey', params: [account]});
    let client_items = encrypt(encryptPublicKey, preparedItem);
    let index = await chain.methods.getIndex().call();
    let gas_estimated = await web3.eth.getGasPrice();
    console.log('client key: '+encryptPublicKey);
    console.log('client encrypted message: '+client_items)
    console.log('restaurant: '+restaurant.digital_address);
    console.log('restaurant key: '+restaurant.public_key);
    console.log('encrypted message: '+restaurant_items);
    await chain.methods.makeOrder(restaurant.digital_address,parseInt(restaurant.delivery), parseInt(total-restaurant.delivery) , restaurant_items, client_items)
    .send({ from: account, gasPrice: gas_estimated, gas: 5000000, value: parseInt(total)});
    console.log("new: "+index+1);
    let order = await chain.methods.findAddress(index+1).call();
    console.log(order);
    await handleSubmit(order);
    setLoading(false);
    history.push('/user')

    
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
  const serviceFee = 0;
  let total = (parseFloat(serviceFee) + parseFloat(subtotal) + restaurant.delivery).toFixed(2);
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
                  <p>Delivery</p>
                  <h3>U${restaurant.delivery}</h3>
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