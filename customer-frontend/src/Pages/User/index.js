import React, { useEffect, useState } from 'react';

import Header from '../../Components/Header';
import PastOrder from '../../Components/PastOrder';
import {CircularProgress} from '@material-ui/core';
import {
  Container,
  Customer,
  OrdersContainer
} from './styles';

import api from '../../services/api';
import { useWeb3 } from '../../services/getWeb3';
import { CHAIN_ADDRESS } from '../../services/config';
import { decrypt } from '../../utils/crypto';

export default function Orders() {
  const [customer, setCustomer] = useState({});
  const [restaurants, setRestaurants] = useState([]);
  const [ordersBlock, setOrdersBlock] = useState([]);
  const [loading, setLoading] = useState(false);
  const { web3, view} = useWeb3();


  useEffect(() => {
    async function fetchData() {
      const response = await api.get('/informations');

      // setCustomer(response.data.customer);
      console.log(response)
      console.log(response.data)
      console.log(response.data.restaurants  )
      await setRestaurants(response.data.restaurants);
      console.log(restaurants)
    }
      
    async function readOrders () {
      if (view) {
        setLoading(true);
        if (window.ethereum){
          const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
          let block_information =await view.methods.relatedTo(CHAIN_ADDRESS).call({from: accounts[0]});
          console.log(block_information)
          //block_information.split(',')
          setOrdersBlock(block_information);
        }
        else {
          console.log('Connect to metamask!')
        }
        setLoading(false);
      }

    }
    
    fetchData();
    readOrders();
  }, [view]);
  
  return (
    <>
    <Header />
    <Container>

      {/* <Customer id="profile"> */}

        {/* <div className="basic-section">
          <div className="user-picture"></div>
          <div>
            <h2>{customer.name}</h2>
            <p>{customer.email}</p>
          </div>
        </div>

        <div className="customer-info">

          <div className="info-container">
            <div>
              <label>Location</label>
              <h4>Brazil</h4>
            </div>

            <div>
              <label>Address</label>
              <h4>{customer.address}, {customer.address_number}</h4>
            </div>

            <div>
              <label>District</label>
              <h4>{customer.district}</h4>
            </div>
          </div>
        </div> */}
      {/* </Customer> */}

      <OrdersContainer>
        <h2>Past orders</h2>

        {loading ?
        <CircularProgress />
        :
        ordersBlock.filter(orderBlock => orderBlock[4] != 0).map(orderBlock => {
          const restaurant = restaurants.find(restaurant => restaurant.digital_address===orderBlock[4])

          if(restaurant){
            return (
              <PastOrder 
              restaurant={restaurant} 
              orderBlock={orderBlock} 
              key={orderBlock[0]} 
              address={customer.address+', '+customer.address_number+'. '+customer.district} />
              )
            }
        })}
      </OrdersContainer>
      
    </Container>
    </>
  )
}