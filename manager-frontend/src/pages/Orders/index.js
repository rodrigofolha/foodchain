import React, { useEffect, useState } from 'react';

import Header from '../../components/Header';
import Navigation from '../../components/Navigation';

import OrderCard from '../../components/Order';

import { OrdersContainer, TitleSection, FilterTabs, FilterTab } from './styles';

import api from '../../services/api';
import {useWeb3 } from '../../services/getWeb3';
import { CHAIN_ADDRESS, SEPOLIA_RPC_URL, DEPLOY_BLOCK, STEALTH_ADDRESS, STEALTH_ABI } from '../../services/config'
import { Button, CircularProgress } from '@material-ui/core';
import {decrypt} from '../../utils/crypto';
import { getOrCreateSpendKey, scanAnnouncements, storeStealthKey } from '../../utils/stealth';
import { storePaymentNote } from '../../utils/zkWithdraw';


export default function Orders() {

  const [orders, setOrders] = useState([]);
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [ordersBlock, setOrdersBlock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterTab, setFilterTab] = useState('active');
  const {web3, interact, chain, logWeb3} = useWeb3();

  const ACTIVE_STATUSES = ['ORDERED', 'PREPARATION', 'WAITING', 'DISPATCHED'];

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
      if (chain && logWeb3) {
        setLoading(true);
        if (window.ethereum){
          const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
          const set = new Map();
          if (SEPOLIA_RPC_URL) {
            const eventTopic = logWeb3.utils.keccak256('OrderActors(address,address,address,address)');
            const establishmentTopic = '0x' + '000000000000000000000000' + accounts[0].slice(2).toLowerCase();
            const zeroAddressTopic = '0x' + '0'.repeat(64);
            const fromBlock = DEPLOY_BLOCK || 0;

            // Query 1: orders already accepted by this restaurant (PREPARATION and beyond)
            const logsAccepted = await logWeb3.eth.getPastLogs({
              fromBlock, toBlock: 'latest',
              topics: [eventTopic, null, establishmentTopic]
            }).catch(err => { console.error(err); return []; });

            // Query 2: newly placed orders (establishment = address(0), not yet accepted)
            const logsNew = await logWeb3.eth.getPastLogs({
              fromBlock, toBlock: 'latest',
              topics: [eventTopic, null, zeroAddressTopic]
            }).catch(err => { console.error(err); return []; });

            // Stealth scanning: find orders addressed to stealth addresses belonging to this restaurant
            if (STEALTH_ADDRESS && STEALTH_ADDRESS !== '0x0000000000000000000000000000000000000000') {
              try {
                var spendKey = getOrCreateSpendKey();
                var ethersModule = await import('ethers');
                var ethers = ethersModule.ethers;
                var rpcProvider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL);
                var stealthContract = new ethers.Contract(STEALTH_ADDRESS, STEALTH_ABI, rpcProvider);

                // 1. Scan announcements to find our stealth addresses (1 RPC call)
                console.log('[Orders] Scanning announcements with spend key:', spendKey.publicKeyCompressed);
                var matches = await scanAnnouncements(stealthContract, spendKey.privateKey, spendKey.viewPrivateKey, fromBlock);
                console.log('[Orders] Stealth matches found:', matches.length, matches);
                var stealthMap = {}; // stealthAddress → stealthPrivateKey
                for (var m = 0; m < matches.length; m++) {
                  stealthMap[matches[m].stealthAddress.toLowerCase()] = matches[m].stealthPrivateKey;
                  storeStealthKey(matches[m].stealthAddress, matches[m].stealthPrivateKey);
                }

                var stealthAddrs = Object.keys(stealthMap);
                console.log('[Orders] Stealth addresses in map:', stealthAddrs);
                if (stealthAddrs.length > 0) {
                  // 2. Fetch ALL OrderActors events in one call
                  var allLogs = await logWeb3.eth.getPastLogs({
                    fromBlock: fromBlock, toBlock: 'latest',
                    topics: [eventTopic]
                  }).catch(function() { return []; });

                  console.log('[Orders] Total OrderActors events:', allLogs.length);

                  // Collect unique order addresses from events where:
                  // - establishment matches a stealth address (accepted orders), OR
                  // - establishment is address(0) (new orders, not yet accepted — restaurant is in contract state)
                  var zeroAddr = '0x' + '0'.repeat(40);
                  var candidateOrders = []; // {orderAddress, stealthPrivateKey or null}
                  for (var l = 0; l < allLogs.length; l++) {
                    var restaurantAddr = '0x' + allLogs[l].topics[2].slice(26).toLowerCase();
                    var orderAddr = '0x' + allLogs[l].data.slice(-40);
                    if (set.has(orderAddr)) continue;

                    if (stealthMap[restaurantAddr]) {
                      // Direct match — this order's event has our stealth address
                      candidateOrders.push({ orderAddress: orderAddr, stealthPrivateKey: stealthMap[restaurantAddr] });
                    } else if (restaurantAddr === zeroAddr) {
                      // New order — restaurant stored in contract, not in event yet.
                      // We'll try each stealth key to see if we're the restaurant.
                      candidateOrders.push({ orderAddress: orderAddr, stealthPrivateKey: null });
                    }
                  }

                  console.log('[Orders] Candidate orders:', candidateOrders.length);

                  // 3. Batch getOrder calls
                  var stealthKeys = Object.values(stealthMap);
                  var batchSize = 5;
                  for (var b = 0; b < candidateOrders.length; b += batchSize) {
                    var batch = candidateOrders.slice(b, b + batchSize);
                    var results = await Promise.all(batch.map(function(entry) {
                      if (entry.stealthPrivateKey) {
                        var wallet = new ethers.Wallet(entry.stealthPrivateKey, rpcProvider);
                        var contract = new ethers.Contract(CHAIN_ADDRESS, chain.options.jsonInterface, wallet);
                        return contract.getOrder(entry.orderAddress).then(function(items) {
                          return { orderAddress: entry.orderAddress, items: items, stealthAddress: wallet.address };
                        }).catch(function() { return null; });
                      } else {
                        return (async function() {
                          for (var k = 0; k < stealthAddrs.length; k++) {
                            try {
                              var w = new ethers.Wallet(stealthMap[stealthAddrs[k]], rpcProvider);
                              var c = new ethers.Contract(CHAIN_ADDRESS, chain.options.jsonInterface, w);
                              var it = await c.getOrder(entry.orderAddress);
                              if (it[1] && it[1] !== '') {
                                return { orderAddress: entry.orderAddress, items: it, stealthAddress: w.address };
                              }
                            } catch(_) {}
                          }
                          return null;
                        })();
                      }
                    }));
                    for (var r = 0; r < results.length; r++) {
                      if (!results[r]) continue;
                      var itemsArray = Array.from({ length: 11 }, function(_, i) {
                        var v = results[r].items[i];
                        return v && v.toString ? v.toString() : (v || '');
                      });
                      if (itemsArray[1] !== '') {
                        // Store stealth address in the items array at index 11
                        itemsArray.push(results[r].stealthAddress);
                        set.set(results[r].orderAddress, itemsArray);
                      }
                    }
                  }
                }
              } catch (err) {
                console.warn('Stealth scanning error (non-fatal):', err);
              }
            }
          } else {
            const lastIdx = parseInt(await chain.methods.getIndex().call());
            for (let i = 1; i <= lastIdx; i++) {
              const orderAddress = await chain.methods.findAddress(i).call();
              const items = await chain.methods.getOrder(orderAddress).call({from: accounts[0]});
              if (items[1] !== '' && items[3] !== '' && items[4] === '0x0000000000000000000000000000000000000000') {
                set.set(orderAddress, items);
              }
            }
          }
          const block_information = [...set.values()];
          setOrdersBlock(block_information);
        }
        else {
          console.log('Connect to metamask!')
        }
        setLoading(false);
      }

    }

    fetchData();
  }, [chain, logWeb3]);
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

    <FilterTabs>
      <FilterTab active={filterTab === 'active'} onClick={() => setFilterTab('active')}>
        Active
      </FilterTab>
      <FilterTab active={filterTab === 'past'} onClick={() => setFilterTab('past')}>
        Past & Canceled
      </FilterTab>
    </FilterTabs>

    <OrdersContainer>
      {loading ? <CircularProgress /> :
      ordersBlock
        .filter(orderBlock => orderBlock[0] != 0)
        .filter(orderBlock =>
          filterTab === 'active'
            ? ACTIVE_STATUSES.includes(orderBlock[3])
            : !ACTIVE_STATUSES.includes(orderBlock[3])
        )
        .map(orderBlock => (
          <OrderCard
            key={orderBlock[0]}
            account={account}
            chain={chain}
            interact={interact}
            orderBlock={orderBlock}
            web3={web3}
            logWeb3={logWeb3}
            total={parseInt(orderBlock[2])}
          />
        ))}
    </OrdersContainer>
    </>
  )
}