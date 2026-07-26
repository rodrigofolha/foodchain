import React, { useEffect, useState } from 'react';

import Header from '../../Components/Header';
import PastOrder from '../../Components/PastOrder';
import {CircularProgress} from '@material-ui/core';

import {
  Container,
  Customer,
  FilterTabs,
  FilterTab,
} from './styles';

import { useWeb3 } from '../../services/getWeb3';
import { REPUTATION_ADDRESS, SEPOLIA_RPC_URL, DEPLOY_BLOCK } from '../../services/config';

const ACTIVE_STATUSES = ['WAITING', 'DISPATCHED'];

export default function Orders() {
  const [ordersBlock, setOrdersBlock] = useState([]);
  const { chain, logWeb3 } = useWeb3();
  const [loading, setLoading] = useState(false);
  const [ownReputation, setOwnReputation] = useState(null);
  const [filterTab, setFilterTab] = useState('active');

  useEffect(() => {
    if (!chain || !logWeb3 || !window.ethereum) return;

    async function fetchAll() {
      setLoading(true);
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' }).catch(function() { return []; });

        if (!accounts || accounts.length === 0) { setLoading(false); return; }
        const account = accounts[0];

        // Fetch own reputation
        if (REPUTATION_ADDRESS) {
          chain.methods.getWorkerReputation(REPUTATION_ADDRESS, account).call({ from: account })
            .then(result => setOwnReputation(result))
            .catch(err => console.log('Reputation fetch error:', err));
        }

        // Load orders where this account is the deliveryworker
        const set = new Map();
        if (SEPOLIA_RPC_URL) {
          const eventTopic = logWeb3.utils.keccak256('OrderActors(address,address,address,address)');
          const workerTopic = '0x' + '000000000000000000000000' + account.slice(2).toLowerCase();
          const fromBlock = DEPLOY_BLOCK || 0;
          const logs = await logWeb3.eth.getPastLogs({
            fromBlock,
            toBlock: 'latest',
            topics: [eventTopic, null, null, workerTopic]
          }).catch(err => { console.error(err); return []; });
          // Collect unique order addresses, then batch getOrder calls
          var orderAddresses = [];
          for (var i = 0; i < logs.length; i++) {
            var oa = '0x' + logs[i].data.slice(-40);
            if (!set.has(oa) && orderAddresses.indexOf(oa) === -1) {
              orderAddresses.push(oa);
            }
          }
          for (var b = 0; b < orderAddresses.length; b += 5) {
            var batch = orderAddresses.slice(b, b + 5);
            var results = await Promise.all(batch.map(function(address) {
              return chain.methods.getOrder(address).call({ from: account }).then(function(items) {
                return { address: address, items: items };
              }).catch(function() { return null; });
            }));
            for (var r = 0; r < results.length; r++) {
              if (results[r]) set.set(results[r].address, results[r].items);
            }
          }
        } else {
          const lastIdx = parseInt(await chain.methods.getIndex().call());
          for (let i = 1; i <= lastIdx; i++) {
            const orderAddress = await chain.methods.findAddress(i).call();
            const items = await chain.methods.getOrder(orderAddress).call({ from: account });
            if (items[3] !== '' && items[3] !== 'ORDERED' && items[3] !== 'PREPARATION') {
              set.set(orderAddress, items);
            }
          }
        }
        setOrdersBlock([...set.values()]);
      } catch(e) {
        console.error(e);
      }
      setLoading(false);
    }

    fetchAll();
  }, [chain, logWeb3]);
  
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

          {ownReputation && (
            <div className="info-container">
              <div>
                <label>Reputation</label>
                <h4>{ownReputation[1] > 0 ? `${(ownReputation[0] / 10).toFixed(1)} ★ (${ownReputation[1]} ratings)` : 'No ratings yet'}</h4>
                <h4>Completed orders: {ownReputation[2]}</h4>
              </div>
            </div>
          )}
      </Customer>

      <div id="orders">
        <h2>Orders</h2>

        <FilterTabs>
          <FilterTab active={filterTab === 'active'} onClick={() => setFilterTab('active')}>Active</FilterTab>
          <FilterTab active={filterTab === 'past'} onClick={() => setFilterTab('past')}>Past</FilterTab>
        </FilterTabs>

        { loading ? <CircularProgress /> : (() => {
          const filtered = ordersBlock
            .filter(ob => ob[0] != 0 && ob[3] !== '')
            .filter(ob => filterTab === 'active'
              ? ACTIVE_STATUSES.includes(ob[3])
              : !ACTIVE_STATUSES.includes(ob[3])
            );
          if (filtered.length === 0) {
            return (
              <p style={{color:'#aaa', fontSize:'14px', padding:'20px 0'}}>
                {filterTab === 'active'
                  ? 'No active deliveries. Accept an order from the home page.'
                  : 'No past deliveries yet.'}
              </p>
            );
          }
          return filtered.map(ob => {
            // Don't pass restaurant data — with stealth addresses, restaurant identity
            // is revealed only via the encrypted payload after confirmIntention
            return <PastOrder restaurant={null} orderBlock={ob} key={ob[0]} />;
          });
        })()}
      </div>
      
    </Container>
    </>
  )
}