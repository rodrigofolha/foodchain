import React, { useEffect, useState } from 'react';

import Header from '../../Components/Header';
import PastOrder from '../../Components/PastOrder';
import {CircularProgress} from '@material-ui/core';

import {
  Container,
  Customer
} from './styles';

import api from '../../services/api';
import { useWeb3 } from '../../services/getWeb3';
import { CHAIN_ADDRESS } from '../../services/config';

export default function Orders() {
  const [restaurants, setRestaurants] = useState({});
  const [ordersBlock, setOrdersBlock] = useState([]);
  const { web3, view, storage} = useWeb3();
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    async function fetchData() {
      const response = await api.get('/informations');
      setRestaurants(response.data.restaurants);
      setLoading(true);
      readOrders();
      setLoading(false);
    }
      
    async function readOrders () {
      if (view) {
        if (window.ethereum){
          const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
          const block_information =await view.methods.relatedTo(CHAIN_ADDRESS).call({from: accounts[0]});
          console.log("block: "+block_information);
          setOrdersBlock(block_information);
        }
        else {
          console.log('Connect to metamask!')
        }
      }

    }
    
    fetchData();
    //readOrders();
  }, [view]);
  
  return (
    <>
    <Header />
    <Container>

      <Customer id="profile">

        <div className="basic-section">
          <div className="user-picture"></div>
          {/* <div>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div> */}
        </div>

          <div className="info-container">
            <div>
              <label>Location</label>
              <h4>Brazil</h4>
            </div>
          </div>

          <div className="info-container">
            <div>
              <label>District</label>
              <h4>PE</h4>
            </div>
          </div>
      </Customer>

      <div id="orders">
        <h2>Past orders</h2>
          
        { loading ?
        <CircularProgress />
        :
        ordersBlock.filter(orderBlock => orderBlock[0] != 0).map(orderBlock => {
          const restaurant = restaurants.find(restaurant => restaurant.digital_address===orderBlock[4])
          if (restaurant){
            return (
              <PastOrder 
              restaurant={restaurant} 
              orderBlock={orderBlock} key={orderBlock[0]} />
            )
          }
        })}
      </div>
      
    </Container>
    </>
  )
}