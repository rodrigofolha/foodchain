import React, { useEffect, useState } from 'react';

import Header from '../../components/Header';
import Navigation from '../../components/Navigation';

import OrderCard from '../../components/Order';

import { OrdersContainer, TitleSection  } from './styles';

import api from '../../services/api';
import {useWeb3 } from '../../services/getWeb3';
import { CHAIN_ADDRESS } from '../../services/config'
import { Button, CircularProgress } from '@material-ui/core';
import {decrypt} from '../../utils/crypto';


export default function Orders() {

  const [orders, setOrders] = useState([]);
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [ordersBlock, setOrdersBlock] = useState([]);
  const [loading, setLoading] = useState(false);
  const {web3, interact, chain, view} = useWeb3();

  const setUserAccount = async () => {
    if (window.ethereum){
      await window.ethereum.enable();
      web3.eth.getAccounts().then(accounts => {
        console.log(accounts[0])
        setAccount(accounts[0])
        setUserBalance(accounts[0])
      })
    }
  }

  const setUserBalance = async fromAddress => {
    await web3.eth.getBalance(fromAddress).then(value => {
      const credit = web3.utils.fromWei(value, 'ether')
      setBalance(credit)
    })
  }

//   async function handleSubmit() {
//     try {
//       console.log(JSON.stringify(items));
//       const response = await api.post(`/restaurants/${restaurant.id}/order`, 
//       {"orderAddress": orderAddress, "items_json": JSON.stringify(items)}, {
//       headers: {
//         "authorization": localStorage.getItem('authorization'),
//         "Content-Type": "application/json"
//       },
//       data: {
//         "order":orderAddress, 
//         "items": items
//       }
//     });
//       console.log(response.data);

//     } catch (err) {
//       console.log(err);
//     }
// }

  useEffect(() => {
    async function fetchData () {
      if (view) {
        setLoading(true);
        if (window.ethereum){
          const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
          const block_information =await view.methods.relatedTo(CHAIN_ADDRESS).call({from: accounts[0]});
          setOrdersBlock(block_information);
        }
        else {
          console.log('Connect to metamask!')
        }
        setLoading(false);
      }

    }

    fetchData();
  }, [view]);
  return (
    <>
    <Header />
    <Navigation />

    <TitleSection>
        <h2>Account</h2>
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
        <h2>Orders</h2>
    </TitleSection>

    <OrdersContainer>
      {loading ? <CircularProgress /> : 
      ordersBlock.filter(orderBlock => orderBlock[0] != 0).map(orderBlock => (
        <OrderCard 
          key={orderBlock[0]}
          account={account}
          chain={chain}
          interact={interact}
          orderBlock={orderBlock}
          web3={web3}
          total={parseInt(orderBlock[2])}// parseInt(orderBlock[1].reduce((sum, item) => sum+item[1]*item[2], 0)) + 
            
        />
        ))}
    </OrdersContainer>
    </>
  )
}