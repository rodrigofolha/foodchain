import React, { useEffect, useState } from 'react';

import Header from '../../Components/Header';
import PastOrder from '../../Components/PastOrder';
import {CircularProgress} from '@material-ui/core';
import {
  Container,
  Customer,
  OrdersContainer,
  FilterTabs,
  FilterTab,
} from './styles';

import api from '../../services/api';
import { useWeb3 } from '../../services/getWeb3';
import { SEPOLIA_RPC_URL, DEPLOY_BLOCK } from '../../services/config';
import { decrypt } from '../../utils/crypto';

export default function Orders() {
  const [customer, setCustomer] = useState({});
  const [restaurants, setRestaurants] = useState([]);
  const [ordersBlock, setOrdersBlock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterTab, setFilterTab] = useState('active');
  const { chain, logWeb3 } = useWeb3();

  const ACTIVE_STATUSES = ['ORDERED', 'PREPARATION', 'WAITING', 'DISPATCHED'];


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
      if (chain && logWeb3) {
        setLoading(true);
        if (window.ethereum){
          const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
          const set = new Map();
          if (SEPOLIA_RPC_URL) {
            // Fast path: single eth_getLogs call via Infura/Alchemy
            const eventTopic = logWeb3.utils.keccak256('OrderActors(address,address,address,address)');
            const clientTopic = '0x' + '000000000000000000000000' + accounts[0].slice(2).toLowerCase();
            const fromBlock = DEPLOY_BLOCK || 0;
            const logs = await logWeb3.eth.getPastLogs({
              fromBlock,
              toBlock: 'latest',
              topics: [eventTopic, clientTopic]
            }).catch(err => { console.error(err); return []; });
            // Collect unique order addresses, then batch getOrder calls
            var orderAddresses = [];
            for (var i = 0; i < logs.length; i++) {
              var addr = '0x' + logs[i].data.slice(-40);
              if (!set.has(addr) && orderAddresses.indexOf(addr) === -1) {
                orderAddresses.push(addr);
              }
            }
            // Batch: 5 concurrent calls at a time
            for (var b = 0; b < orderAddresses.length; b += 5) {
              var batch = orderAddresses.slice(b, b + 5);
              var results = await Promise.all(batch.map(function(oa) {
                return chain.methods.getOrder(oa).call({from: accounts[0]}).then(function(items) {
                  return { address: oa, items: items };
                }).catch(function() { return null; });
              }));
              for (var r = 0; r < results.length; r++) {
                if (results[r]) set.set(results[r].address, results[r].items);
              }
            }
          } else {
            // Fallback: iterate by index (works with MetaMask's limited RPC)
            const lastIdx = parseInt(await chain.methods.getIndex().call());
            for (let i = 1; i <= lastIdx; i++) {
              const orderAddress = await chain.methods.findAddress(i).call();
              const items = await chain.methods.getOrder(orderAddress).call({from: accounts[0]});
              if (items[1] !== '' && items[4] !== '0x0000000000000000000000000000000000000000') {
                set.set(orderAddress, items);
              }
            }
          }
          setOrdersBlock([...set.values()]);
        }
        else {
          console.log('Connect to metamask!')
        }
        setLoading(false);
      }

    }
    
    fetchData();
    readOrders();
  }, [chain, logWeb3]);
  
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
        <h2>Orders</h2>

        <FilterTabs>
          <FilterTab active={filterTab === 'active'} onClick={() => setFilterTab('active')}>
            Active
          </FilterTab>
          <FilterTab active={filterTab === 'past'} onClick={() => setFilterTab('past')}>
            Past & Canceled
          </FilterTab>
        </FilterTabs>

        {loading ?
        <CircularProgress />
        :
        ordersBlock
          .filter(orderBlock => orderBlock[4] != 0)
          .filter(orderBlock =>
            filterTab === 'active'
              ? ACTIVE_STATUSES.includes(orderBlock[3])
              : !ACTIVE_STATUSES.includes(orderBlock[3])
          )
          .map(function(orderBlock) {
            // Look up restaurant from stored order info (has restaurant id)
            var orderRestaurantInfo = JSON.parse(localStorage.getItem('orderRestaurantInfo') || '{}');
            var info = orderRestaurantInfo[orderBlock[0]];
            var restaurant = null;

            // If we have the restaurant id, find it in the API-fetched list
            if (info && info.id && Array.isArray(restaurants)) {
              restaurant = restaurants.find(function(r) { return r.id === info.id; });
            }
            // Fallback: try matching by digital_address (legacy non-stealth orders)
            if (!restaurant && Array.isArray(restaurants)) {
              restaurant = restaurants.find(function(r) { return r.digital_address === orderBlock[4]; });
            }
            // Last fallback: use stored name/address only
            if (!restaurant && info) {
              restaurant = { restaurant_name: info.name, restaurant_address: info.address };
            }

            return (
              <PastOrder
                restaurant={restaurant || {}}
                orderBlock={orderBlock}
                key={orderBlock[0]}
                address={customer.address+', '+customer.address_number+'. '+customer.district} />
            );
          })
        }
      </OrdersContainer>
      
    </Container>
    </>
  )
}