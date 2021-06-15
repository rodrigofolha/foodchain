import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { CHAIN_ADDRESS, CHAIN_ABI, VIEW_ADDRESS, VIEW_ABI, INTERACT_ADDRESS, 
  INTERACT_ABI, STORAGE_ADDRESS, STORAGE_ABI } from './config.js';

export const useWeb3 = () => {
  const [web3, setWeb3] = useState(null)
  const [chain, setChain] = useState(null)
  const [view, setView] = useState(null)
  const [interact, setInteract] = useState(null)
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
      // fallback on local network
      console.log('using the local network')
      const provider = new Web3.provider.HttpProvider('http://127.0.0.1:7545');
      instance = new Web3(provider)
    }
    let contract = new instance.eth.Contract(CHAIN_ABI, CHAIN_ADDRESS, {gas: 4000000, gasPrice: 1000000})
    setChain(contract)
    let contract_view = new instance.eth.Contract(VIEW_ABI, VIEW_ADDRESS, {gas: 4000000, gasPrice: 1000000})
    setView(contract_view)
    let contract_interact = new instance.eth.Contract(INTERACT_ABI, INTERACT_ADDRESS, {gas: 4000000, gasPrice: 1000000})
    setInteract(contract_interact)
    let contract_storage = new instance.eth.Contract(STORAGE_ABI, STORAGE_ADDRESS, {gas: 4000000, gasPrice: 1000000})
    setStorage(contract_storage)
    setWeb3(instance)
  },[])

  return {web3, chain, view, interact, storage};
}
