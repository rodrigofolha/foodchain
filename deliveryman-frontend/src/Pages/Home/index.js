import React, { useEffect, useState, useCallback } from 'react';

import Header from '../../Components/Header';
import OrderItem from '../../Components/OrderItem';
import { CircularProgress } from '@material-ui/core';

import BasketProvider from '../../Context/BasketContext';

import {
  HeaderContainer,
  Container,
  WalletBar,
  ConnectButton,
  SectionHeader,
  OrdersGrid,
  EmptyState,
} from './styles';

import { useWeb3 } from '../../services/getWeb3';
import { REPUTATION_ADDRESS, SEPOLIA_RPC_URL, DEPLOY_BLOCK } from '../../services/config';

export default function Home({ history }) {
  const [orders, setOrders] = useState([]);
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ownReputation, setOwnReputation] = useState(null);
  const { web3, chain, logWeb3 } = useWeb3();

  const loadData = useCallback(async (addr) => {
    if (!chain || !logWeb3 || !web3) return;
    setLoading(true);
    try {
      const wei = await web3.eth.getBalance(addr);
      setBalance(parseFloat(web3.utils.fromWei(wei, 'ether')).toFixed(4));

      // Fetch own reputation
      if (REPUTATION_ADDRESS) {
        try {
          const rep = await chain.methods.getWorkerReputation(REPUTATION_ADDRESS, addr).call({from: addr});
          setOwnReputation(rep);
        } catch(e) { console.log('Reputation fetch:', e); }
      }

      // Load available orders in PREPARATION state
      var set = new Map();
      var fromBlock = DEPLOY_BLOCK || 0;
      if (SEPOLIA_RPC_URL) {
        var eventTopic = logWeb3.utils.keccak256('OrderActors(address,address,address,address)');
        var zoneTopic = logWeb3.utils.keccak256('OrderZone(address,string)');

        // Fetch OrderActors + OrderZone events in parallel (2 RPC calls instead of 3+)
        var logResults = await Promise.all([
          logWeb3.eth.getPastLogs({ fromBlock: fromBlock, toBlock: 'latest', topics: [eventTopic] }).catch(function() { return []; }),
          logWeb3.eth.getPastLogs({ fromBlock: fromBlock, toBlock: 'latest', topics: [zoneTopic] }).catch(function() { return []; })
        ]);
        var logs = logResults[0];
        var zoneLogs = logResults[1];

        // Build zone map from zone events
        var zoneMap = {};
        for (var z = 0; z < zoneLogs.length; z++) {
          var zOrderAddr = '0x' + zoneLogs[z].topics[1].slice(26);
          zoneMap[zOrderAddr.toLowerCase()] = logWeb3.eth.abi.decodeParameter('string', zoneLogs[z].data);
        }

        // Collect unique order addresses
        var orderAddresses = [];
        for (var l = 0; l < logs.length; l++) {
          var oa = '0x' + logs[l].data.slice(-40);
          if (!set.has(oa) && orderAddresses.indexOf(oa) === -1) {
            orderAddresses.push(oa);
          }
        }

        // Batch getOrder: 5 concurrent calls at a time
        for (var b = 0; b < orderAddresses.length; b += 5) {
          var batch = orderAddresses.slice(b, b + 5);
          var results = await Promise.all(batch.map(function(address) {
            return chain.methods.getOrder(address).call({from: addr}).then(function(items) {
              return { address: address, items: items };
            }).catch(function() { return null; });
          }));
          for (var r = 0; r < results.length; r++) {
            if (results[r] && results[r].items[3] === 'PREPARATION') {
              set.set(results[r].address, results[r].items);
            }
          }
        }
      } else {
        var zoneMap = {};
        var lastIdx = parseInt(await chain.methods.getIndex().call());
        for (var i = 1; i <= lastIdx; i++) {
          var orderAddress = await chain.methods.findAddress(i).call();
          var items = await chain.methods.getOrder(orderAddress).call({from: addr});
          if (items[3] === 'PREPARATION') set.set(orderAddress, items);
        }
      }

      // Build enriched list with zone info
      var enriched = [];
      for (var entry of set.entries()) {
        var entryAddr = entry[0];
        var orderData = entry[1];
        var orderZone = (zoneMap && zoneMap[entryAddr.toLowerCase()]) || '';
        enriched.push({ orderData: orderData, restaurant: null, zone: orderZone });
      }
      setOrders(enriched);
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  }, [chain, logWeb3, web3]);

  const connectWallet = async () => {
    if (!window.ethereum || !web3) return;
    const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
    setAccount(accounts[0]);
    await loadData(accounts[0]);
  };

  useEffect(function() {
    async function init() {
      if (!chain || !logWeb3 || !web3) return;
      if (!window.ethereum) return;
      // Use eth_accounts (no popup) — only proceed if already authorized
      var accounts = await window.ethereum.request({method:'eth_accounts'}).catch(function() { return []; });
      if (!accounts || accounts.length === 0) return;
      setAccount(accounts[0]);
      await loadData(accounts[0]);
    }
    init();

    // Listen for account changes in MetaMask
    if (window.ethereum) {
      var handleAccountsChanged = function(accounts) {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          loadData(accounts[0]);
        } else {
          setAccount(null);
          setOrders([]);
        }
      };
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      return function() {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [chain, logWeb3, web3, loadData]);

  const repDisplay = () => {
    if (!ownReputation) return null;
    const rep = Array.isArray(ownReputation) ? ownReputation : Object.values(ownReputation);
    const [score, ratings, deliveries] = rep.map(Number);
    if (ratings === 0) return <span className="rep-new">🚴 New · {deliveries} deliveries</span>;
    return <span className="rep-score">⭐ {(score / 10).toFixed(1)} · {ratings} ratings · {deliveries} deliveries</span>;
  };

  return (
    <BasketProvider>
      <HeaderContainer>
        <Header />
      </HeaderContainer>

      <Container>
        <WalletBar>
          {account ? (
            <>
              <div className="wallet-info">
                <span className="address">{account.slice(0, 10)}…{account.slice(-8)}</span>
                <span className="balance">{balance} ETH</span>
              </div>
              <div className="rep-info">
                <span>Your reputation:</span>
                {repDisplay()}
              </div>
            </>
          ) : (
            <span style={{color:'#888', fontSize:'14px'}}>Connect your wallet to see available deliveries</span>
          )}
          {!account && <ConnectButton onClick={connectWallet}>Connect MetaMask</ConnectButton>}
        </WalletBar>

        <SectionHeader>
          <h2>Available deliveries</h2>
          {loading
            ? <p>Loading orders…</p>
            : <p>{orders.length} order{orders.length !== 1 ? 's' : ''} ready to pick up</p>
          }
        </SectionHeader>

        {loading ? (
          <CircularProgress style={{display:'block', margin:'40px auto'}} />
        ) : orders.length === 0 ? (
          <EmptyState>
            <div className="icon">🛵</div>
            <h3>{account ? 'No deliveries available right now' : 'Connect your wallet to get started'}</h3>
            <p>{account ? 'Check back soon — new orders appear here as restaurants accept them.' : 'Click the button above to connect MetaMask.'}</p>
          </EmptyState>
        ) : (
          <OrdersGrid>
            {orders.map(function(item) { return (
              <OrderItem
                key={item.orderData[0]}
                order={item.orderData}
                restaurant={item.restaurant}
                zone={item.zone}
                total={parseInt(item.orderData[5])}
                chain={chain}
                web3={web3}
                history={history}
                ownReputation={ownReputation}
              />
            ); })}
          </OrdersGrid>
        )}
      </Container>
    </BasketProvider>
  );
}
