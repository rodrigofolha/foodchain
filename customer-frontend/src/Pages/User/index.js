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
import { SEPOLIA_RPC_URL, DEPLOY_BLOCK, CHAIN_ADDRESS } from '../../services/config';
import { decrypt } from '../../utils/crypto';
import { adoptPendingOrder, orderRestaurantInfoFor } from '../../utils/orderSecrets';
import { loadDeployment } from '../../utils/deploymentStorage';
import { errorText } from '../../utils/contractErrors';
import { orderAddressesFromLogs, keepChainOrders, commitmentsFromLogs, readCommitments } from '../../utils/orderWorkers';
import { chainOrderLogs } from '../../utils/chainLogs';

export default function Orders() {
  const [customer, setCustomer] = useState({});
  const [restaurants, setRestaurants] = useState([]);
  const [ordersBlock, setOrdersBlock] = useState([]);
  const [orderAddressOf, setOrderAddressOf] = useState({});
  const [commitmentsOf, setCommitmentsOf] = useState({});
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
          // order contract -> the workers who committed to it, from its OrderActors logs
          const workersOf = {};
          if (SEPOLIA_RPC_URL) {
            // Fast path, through the read-only endpoint: the orders that Chain created (its
            // OrderZone logs), then the OrderActors logs of those orders that name this customer
            const eventTopic = logWeb3.utils.keccak256('OrderActors(address,address,address,address)');
            const clientTopic = '0x' + '000000000000000000000000' + accounts[0].slice(2).toLowerCase();
            const fromBlock = DEPLOY_BLOCK || 0;
            const logs = await chainOrderLogs(logWeb3, CHAIN_ADDRESS, fromBlock, [eventTopic, clientTopic])
              .catch(err => { console.error('Could not read the order logs:', errorText(err)); return []; });
            // Collect unique order addresses, then batch getOrder calls.
            // Any contract can emit an event with this name: only the addresses
            // that Chain says are its orders are kept.
            var orderAddresses = await keepChainOrders(chain, orderAddressesFromLogs(logs));
            orderAddresses.forEach(function(oa) { workersOf[oa] = commitmentsFromLogs(logs, oa); });
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
                workersOf[orderAddress] = await readCommitments(logWeb3, orderAddress, DEPLOY_BLOCK || 0)
                  .catch(function() { return []; });
              }
            }
          }
          // An order placed in this browser that checkout could not match to its id
          // (tab closed, order mined late) gets its secrets here, by its stealth
          // address, before the order is shown.
          // The records are kept for this chain and Chain contract. Without the
          // chain id nothing is read or adopted, and the orders are still shown.
          await loadDeployment().catch(function() { return null; });
          const addressOf = {};
          set.forEach(function(items, orderAddress) {
            addressOf[items[0]] = orderAddress;
            adoptPendingOrder(items[0], orderAddress, items[4]);
          });
          setOrderAddressOf(addressOf);
          setCommitmentsOf(workersOf);
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
            // (not the info another order contract left under the same id)
            var info = orderRestaurantInfoFor(orderBlock[0], orderAddressOf[orderBlock[0]]);
            var restaurant = null;

            // If we have the restaurant id, find it in the API-fetched list
            if (info && info.id && Array.isArray(restaurants)) {
              restaurant = restaurants.find(function(r) { return r.id === info.id; });
            }
            // Fallback: use stored name/address only
            if (!restaurant && info) {
              restaurant = { restaurant_name: info.name, restaurant_address: info.address };
            }

            return (
              <PastOrder
                restaurant={restaurant || {}}
                orderBlock={orderBlock}
                orderAddress={orderAddressOf[orderBlock[0]]}
                commitments={commitmentsOf[orderAddressOf[orderBlock[0]]]}
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