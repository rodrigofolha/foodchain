import React, { useEffect, useState } from 'react';

import Header from '../../Components/Header';
import PastOrder from '../../Components/PastOrder';
import {CircularProgress} from '@material-ui/core';

import {
  Container,
  Customer,
  FilterTabs,
  FilterTab,
  LeftOrder,
} from './styles';

import { useWeb3 } from '../../services/getWeb3';
import { SEPOLIA_RPC_URL, DEPLOY_BLOCK } from '../../services/config';
import { ORDER_ACTORS_TOPIC, addressTopic, orderAddressesFromLogs, keepChainOrders } from '../../utils/orderLogs';
import { workerRecord, averageText } from '../../utils/workerRecord';
import { isWorkerView, leftOrderText } from '../../utils/leaving';
import { errorText } from '../../utils/contractErrors';

const ACTIVE_STATUSES = ['WAITING', 'DISPATCHED'];

export default function Orders() {
  const [ordersBlock, setOrdersBlock] = useState([]);
  // orders this account committed to and then left (or was replaced on): { id, text }
  const [leftOrders, setLeftOrders] = useState([]);
  const { chain, logWeb3, reputation } = useWeb3();
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(null);
  const [filterTab, setFilterTab] = useState('active');

  useEffect(() => {
    if (!chain || !logWeb3 || !window.ethereum) return;

    async function fetchAll() {
      setLoading(true);
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' }).catch(function() { return []; });

        if (!accounts || accounts.length === 0) { setLoading(false); return; }
        const account = accounts[0];

        // Fetch the account's own public record
        if (reputation) {
          reputation.methods.workers(account).call({ from: account })
            .then(result => setRecord(workerRecord(result)))
            .catch(err => console.log('Reputation fetch error:', errorText(err)));
        }

        // Load orders where this account is the deliveryworker
        const set = new Map();
        const left = [];
        if (SEPOLIA_RPC_URL) {
          const eventTopic = ORDER_ACTORS_TOPIC;
          const workerTopic = addressTopic(account);
          const fromBlock = DEPLOY_BLOCK || 0;
          const logs = await logWeb3.eth.getPastLogs({
            fromBlock,
            toBlock: 'latest',
            topics: [eventTopic, null, null, workerTopic]
          }).catch(err => { console.error('Could not read the order logs:', errorText(err)); return []; });
          // Collect unique order addresses, then batch getOrder calls. Any contract can
          // emit an event of this name: only orders created by Chain are kept.
          var orderAddresses = await keepChainOrders(chain, orderAddressesFromLogs(logs));
          for (var b = 0; b < orderAddresses.length; b += 5) {
            var batch = orderAddresses.slice(b, b + 5);
            var results = await Promise.all(batch.map(function(address) {
              return chain.methods.getOrder(address).call({ from: account }).then(function(items) {
                return { address: address, items: items };
              }).catch(function() { return null; });
            }));
            for (var r = 0; r < results.length; r++) {
              if (!results[r]) continue;
              if (isWorkerView(results[r].items)) {
                set.set(results[r].address, results[r].items);
                // A cancelled order may be one this account left after pickup, or too late
                if (String(results[r].items[3]).indexOf('CANCELED') === 0) left.push({ ...results[r], listed: true });
              } else {
                // The account is no longer the worker of this order: it gets the public view
                left.push(results[r]);
              }
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

        // What the reputation contract reports about each order this account left
        const leftEntries = [];
        for (const entry of left) {
          const ratings = reputation
            ? await reputation.methods.orderRatings(entry.address, account).call().catch(() => null)
            : null;
          const text = leftOrderText(ratings);
          // An order that is also in the list gets a line only if a leaving was reported
          if (!text && entry.listed) continue;
          leftEntries.push({
            id: entry.items[0],
            text: text || 'You are no longer the worker of this order.',
          });
        }
        setLeftOrders(leftEntries);
      } catch(e) {
        console.error('Could not load your orders:', errorText(e));
      }
      setLoading(false);
    }

    fetchAll();
  }, [chain, logWeb3, reputation]);
  
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

          {record && (
            <div className="info-container">
              <div>
                <label>Public record</label>
                <h4>{averageText(record)}</h4>
                <h4>Completed deliveries: {record.completedOrders}</h4>
                <h4>Orders you left: {record.leftOrders}</h4>
                <h4>Ratings received after leaving: {record.ratingsAfterLeaving}</h4>
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
          const leftRows = filterTab === 'past' ? leftOrders.map(entry => (
            <LeftOrder key={'left-' + entry.id}>
              <b>Order {entry.id}</b>
              <p>{entry.text} It is counted in "Orders you left".</p>
            </LeftOrder>
          )) : [];
          if (filtered.length === 0 && leftRows.length === 0) {
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
          }).concat(leftRows);
        })()}
      </div>
      
    </Container>
    </>
  )
}