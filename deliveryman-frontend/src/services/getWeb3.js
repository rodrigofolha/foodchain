import { useEffect, useState } from 'react';
import Web3 from 'web3';
import { CHAIN_ADDRESS, CHAIN_ABI, STORAGE_ADDRESS, STORAGE_ABI, REPUTATION_ADDRESS, REPUTATION_ABI, SEPOLIA_RPC_URL } from './config.js';

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
        console.log(error)
      }
    } else if (window.web3) {
      instance = new Web3(window.web3)
    } else {
      console.log('using the local network')
      const provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
      instance = new Web3(provider)
    }
    instance.eth.getChainId().then(id => {
      if (Number(id) !== 11155111 && Number(id) !== 1337 && Number(id) !== 5777) {
        console.warn(`Connected to chain ${id} — switch MetaMask to Sepolia (11155111) or Ganache`);
        alert(`Wrong network (chain ${id}). Please switch MetaMask to Sepolia testnet.`);
      }
    }).catch(() => {});
    let contract = new instance.eth.Contract(CHAIN_ABI, CHAIN_ADDRESS, {gas: 4000000, gasPrice: undefined})
    setChain(contract)
    let contract_storage = new instance.eth.Contract(STORAGE_ABI, STORAGE_ADDRESS, {gas: 4000000, gasPrice: undefined})
    setStorage(contract_storage)
    if (REPUTATION_ADDRESS) {
      let contract_reputation = new instance.eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS, {gas: 4000000, gasPrice: undefined})
      setReputation(contract_reputation)
    }
    setWeb3(instance)
    const readProvider = SEPOLIA_RPC_URL
      ? new Web3.providers.HttpProvider(SEPOLIA_RPC_URL)
      : instance.currentProvider;
    setLogWeb3(new Web3(readProvider))
  },[])

  return {web3, logWeb3, chain, storage, reputation};
}
