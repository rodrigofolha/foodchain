import { useEffect, useState } from 'react';
import Web3 from 'web3';
import { CHAIN_ADDRESS, CHAIN_ABI, STORAGE_ADDRESS, STORAGE_ABI, REPUTATION_ADDRESS, REPUTATION_ABI, SEPOLIA_RPC_URL } from './config.js';
import { setDeployment } from '../utils/deploymentStorage';
import { errorText } from '../utils/contractErrors';

export const useWeb3 = () => {
  const [web3, setWeb3] = useState(null)
  const [logWeb3, setLogWeb3] = useState(null)
  const [chain, setChain] = useState(null)
  const [reputation, setReputation] = useState(null)
  const [storage, setStorage] = useState(null)

  useEffect(() => {
    var instance;
    if (window.ethereum){
      try{
        instance = new Web3(window.ethereum)
      } catch(error){
        console.log('The wallet provider could not be used:', errorText(error))
      }
    } else if (window.web3) {
      instance = new Web3(window.web3)
    } else {
      // fallback on local network
      console.log('using the local network')
      const provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
      instance = new Web3(provider)
    }
    instance.eth.getChainId().then(id => {
      // the browser's records of orders are kept per chain and Chain contract
      setDeployment(id);
      // Hoodi (560048), Ganache (1337, 5777) and a local Hardhat node (31337)
      if (Number(id) !== 560048 && Number(id) !== 1337 && Number(id) !== 5777 && Number(id) !== 31337) {
        console.warn(`Connected to chain ${id} — switch MetaMask to Hoodi (560048) or a local node`);
        alert(`Wrong network (chain ${id}). Please switch MetaMask to the Hoodi test network (chain 560048).`);
      }
    }).catch(() => {});
    // No default gas limit: every transaction is sent with the node's estimate (utils/txGas.js)
    let contract = new instance.eth.Contract(CHAIN_ABI, CHAIN_ADDRESS, {gasPrice: undefined})
    setChain(contract)
    let contract_storage = new instance.eth.Contract(STORAGE_ABI, STORAGE_ADDRESS, {gasPrice: undefined})
    setStorage(contract_storage)
    if (REPUTATION_ADDRESS) {
      let contract_reputation = new instance.eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS, {gasPrice: undefined})
      setReputation(contract_reputation)
    }
    setWeb3(instance)
    // Dedicated read-only provider for event log queries (bypasses MetaMask RPC limits)
    const readProvider = SEPOLIA_RPC_URL
      ? new Web3.providers.HttpProvider(SEPOLIA_RPC_URL)
      : instance.currentProvider;
    setLogWeb3(new Web3(readProvider))
  },[])

  return {web3, logWeb3, chain, storage, reputation};
}
