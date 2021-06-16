import React, { useEffect, useState } from 'react';

import Header from '../../Components/Header';
import OrderItem from '../../Components/OrderItem';
import { Button, CircularProgress } from '@material-ui/core';

import BasketProvider from '../../Context/BasketContext';

import {  
  HeaderContainer,
  Container,
  Filter,
  FilterContainer,
  FilterButton,
  RestaurantsGrid,
} from './styles';

import { SubTitleItem, Title, SmallText} from '../../GlobalStyles';

import { FaBiking } from 'react-icons/fa';
import { FiShoppingBag } from 'react-icons/fi';

import api from '../../services/api';
import { useWeb3 } from '../../services/getWeb3';
import {CHAIN_ADDRESS} from '../../services/config';

export default function Home({ history }) {
  const [order, setOrderToBeTaken] = useState([]);
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(false);
  const {web3, interact, chain, view} = useWeb3();

  const setUserAccount = async () => {
    if (window.ethereum){
      await window.ethereum.enable();
      web3.eth.getAccounts().then(accounts => {
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

  useEffect(() => {
    async function fetchData() {
      const response = await view.methods.toBeTaken(CHAIN_ADDRESS).call({from: account});
      console.log('res: '+response)
      if (response[4]!=0) {
        const res = await api.get(`/restaurants/${response[4]}`);
        setRestaurant(res.data);
        console.log(restaurant)
      }
      setOrderToBeTaken(response);
    }
    if (view){
      setLoading(true);
      fetchData();
      setLoading(false);
    }
  }, [view, account]);

  console.log(order)

  return (
    <BasketProvider>
      <HeaderContainer>
        <Header />
      </HeaderContainer>

      <Container>
        <Filter>
          <FilterContainer>
            <FilterButton isSelected={true} > <FaBiking size={20} /> Delivery</FilterButton>
            <FilterButton> <FiShoppingBag size={20} /> Pickup</FilterButton>
          </FilterContainer>
        </Filter>

        <SubTitleItem>
          <Title size="28px">Order available</Title>
          <SmallText>This order can be yours! Pick it!</SmallText>
        </SubTitleItem>
        {
          (order.length != 0 && order[0] != "0") ? 
        <RestaurantsGrid>
          <OrderItem order={order} restaurant={restaurant} total={parsetInt(order[5])} //total={parseInt(order[2])}
          chain={chain} web3={web3} interact={interact} key={order[0]} history={history}/>
          
        </RestaurantsGrid>
        : null}
        <Button variant="outlined" color="primary"
              onClick={() => setUserAccount()}>
                Connect to MetaMask
              </Button>
              { account ? (
                <>
                <p>Your address: {account}</p>
                <p>Your balance: {balance}</p>
                </>
              ): null
              }
      </Container>
    </BasketProvider>
  )
}