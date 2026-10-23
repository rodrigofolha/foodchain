import React, { useState } from 'react';
import { ethers } from "ethers";
import Moment from 'react-moment';
import { CircularProgress } from '@material-ui/core';
import { STORAGE_ADDRESS, REPUTATION_ADDRESS } from '../../services/config';
import { usesReputationContract } from '../../utils/orderCheck';
import { parseContractError, errorText } from '../../utils/contractErrors';
import { withEstimatedGas } from '../../utils/txGas';
import { qualification } from '../../utils/workerRecord';
import {
  Container, Thumbnail, Image, CardBody, CardFooter,
  ReqBadge, DisqualifiedBanner, Button, LinkToRestaurant,
} from './styles';

var priceUtils = require('../../utils/priceUtils');

export default function OrderItem({ order, total, restaurant, zone, chain, history, web3, ownReputation }) {
  const [loading, setLoading] = useState(false);

  const minReputation = parseInt(order[9] || 0);
  const minOrders = parseInt(order[10] || 0);

  // Same rule as confirmIntention: a minimum score also needs at least one rating
  const { qualified, reason: disqualifyReason } = qualification(ownReputation, minReputation, minOrders);

  const acceptOrder = async function (order_id) {
    if (window.ethereum) {
      setLoading(true);
      try {
        const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        // The minimums and the ratings of the order use the reputation contract it names
        if (!(await usesReputationContract(web3, orderAddress, REPUTATION_ADDRESS))) {
          alert('This order does not use the FoodChain reputation contract and cannot be taken.');
          setLoading(false);
          return;
        }
        let encryptPublicKey = await window.ethereum.request({method: 'eth_getEncryptionPublicKey', params: [accounts[0]]});
        let firstHalf = encryptPublicKey.substring(0, 31);
        let secondHalf = encryptPublicKey.substring(31);
        let bytesFirst = ethers.utils.formatBytes32String(firstHalf);
        let bytesSecond = ethers.utils.formatBytes32String(secondHalf);
        const commitment = chain.methods.confirmIntention(orderAddress, order_id, STORAGE_ADDRESS, bytesFirst, bytesSecond);
        await commitment.send(await withEstimatedGas(commitment, {from: accounts[0]}));
        setLoading(false);
        history.push('/user');
      } catch (err) {
        console.error('Taking the order failed:', errorText(err));
        alert(parseContractError(err));
        setLoading(false);
      }
    }
  }

  return (
    <Container disqualified={!qualified}>
      {restaurant ? (
        <>
          <LinkToRestaurant to="/">
            <Thumbnail>
              <Image src={`https://api.arthurcarvalho.info/food/files/${restaurant.banner_path}`} alt={restaurant.restaurant_name} />
            </Thumbnail>
          </LinkToRestaurant>
          <CardBody>
            <p className="restaurant-name">{restaurant.restaurant_name}</p>
            <p className="info-row">📍 {restaurant.restaurant_address}</p>
            <p className="info-row">🍽 {restaurant.culinary}</p>
            <p className="info-row">
              🕐 <Moment unix>{order[6]}</Moment>
            </p>
            <p className="price-row">
              Delivery fee: U${priceUtils.weiToDollars(order[2])} &nbsp;·&nbsp; Total: U${priceUtils.weiToDollars(total)}
            </p>
          </CardBody>
        </>
      ) : (
        <CardBody>
          <p className="restaurant-name">Restaurant details available after accepting</p>
          {zone && <p className="info-row">Zone: {zone}</p>}
          <p className="info-row">
            🕐 <Moment unix>{order[6]}</Moment>
          </p>
          <p className="price-row">
            Delivery fee: U${priceUtils.weiToDollars(order[2])} &nbsp;·&nbsp; Total: U${priceUtils.weiToDollars(total)}
          </p>
        </CardBody>
      )}

      {(minReputation > 0 || minOrders > 0) && (
        <ReqBadge>
          ⭐ Requirements:
          {minReputation > 0 && <span>{(minReputation / 10).toFixed(1)}★ min rating</span>}
          {minOrders > 0 && <span>{minOrders} deliveries min</span>}
        </ReqBadge>
      )}

      {!qualified && (
        <DisqualifiedBanner>
          ⚠️ {disqualifyReason}
        </DisqualifiedBanner>
      )}

      <CardFooter>
        {loading
          ? <CircularProgress size={24} style={{display:'block', margin:'0 auto'}} />
          : <Button disabled={!qualified} onClick={() => qualified && acceptOrder(order[0])}>
              {qualified ? 'Accept delivery' : 'Not qualified'}
            </Button>
        }
      </CardFooter>
    </Container>
  );
}
