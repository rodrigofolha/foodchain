import React, { useState } from 'react';
import { ethers } from "ethers";

import Img from '../../assets/thumb-icon.jpeg';
import Moment from 'react-moment';

import { STORAGE_ADDRESS } from '../../services/config';

import { CircularProgress } from '@material-ui/core';

import {
  Container,
  Thumbnail,
  Image,
  LinkToRestaurant,
  Button
} from './styles';

import { Title } from '../../GlobalStyles';


export default function OrderItem({ interact, order, total, restaurant, chain, history, web3 }) {
  const [loading, setLoading] = useState(false);
  const acceptOrder = async function (order_id,) {
    if (window.ethereum){
      setLoading(true);
      const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
      let gas_estimated = await web3.eth.getGasPrice();
      let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
      let encryptPublicKey = await window.ethereum.request({method: 'eth_getEncryptionPublicKey', params: [accounts[0]]});
      let firstHalf = encryptPublicKey.substring(0,31);
      let secondHalf = encryptPublicKey.substring(31);
      let bytesFirst = ethers.utils.formatBytes32String(firstHalf);
      let bytesSecond = ethers.utils.formatBytes32String(secondHalf);
      await interact.methods.confirmIntention(orderAddress, order_id, STORAGE_ADDRESS, bytesFirst, bytesSecond)
      .send({from: accounts[0], gas: 4000000, gasPrice: gas_estimated, value: parseInt(total)});
      setLoading(false);
      history.push('/user')
    } else {
      console.log('Connect to MetaMask!');
    }
  }
  return (
    <Container>
      <LinkToRestaurant to={`/`}>
        <Thumbnail>
          <Image src={`https://api.arthurcarvalho.info/food/files/${restaurant.banner_path}`} />
        </Thumbnail>

        <div className="title-container">
          <div>
            <Title size="17px">{restaurant.restaurant_name}</Title>
            <p>Restaurant address: {restaurant.restaurant_address}</p>
            <p>Status: {order[3]} </p>
            <p>Created at: <Moment unix>{order[6]}</Moment> </p>
            <p>Last updated at: <Moment unix>{order[7]}</Moment></p>
            <p>Total price: {total} &middot; Delivery Fee: ${order[2]} &middot; 15–25 min &middot; $$</p>
          </div>

          <div className="rating">
           <p>New</p> 
          </div>
        </div>

        <p>{restaurant.culinary}</p>
      </LinkToRestaurant>
      { loading ? <CircularProgress /> :
        <Button onClick={() => acceptOrder(order[0])}>Accept demand!</Button>
      }
    </Container>
  )
}