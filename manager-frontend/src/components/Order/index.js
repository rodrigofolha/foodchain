/* global BigInt */
import React, { useState, useEffect } from 'react';
import Moment from 'react-moment';

import { Order, Button, StatusBadge, ReputationBadge, WorkerReputationBadge } from './styles';

import { CircularProgress } from '@material-ui/core';

import ItemLine from '../ItemOrder'
import { decrypt } from '../../utils/crypto';
import { generateRatingProof } from '../../utils/zkUtils';
import { poseidon2 } from '../../utils/poseidon';
import { parseContractError } from '../../utils/contractErrors';
import { REPUTATION_ADDRESS, REPUTATION_ABI, CHAIN_ADDRESS, SEPOLIA_RPC_URL, DEPLOY_BLOCK } from '../../services/config';
import { generateNoteSecrets, computePaymentCommitment, computeNullifierHash, getUnspentNotes, getUnspentBalance, fetchTreeState, generateMergeWithdrawProof, getDummyNote, planWithdrawal, markNoteSpent, addChangeNote } from '../../utils/zkWithdraw';
import { getStealthKey } from '../../utils/stealth';
var priceUtils = require('../../utils/priceUtils');

export default function OrderCard( props ) {
  const {web3, logWeb3, chain, orderBlock, total} = props;
  const [loading, setLoading] = useState(false);
  const [deliveryCode, setCode] = useState(null);
  const [deliveryEvaluation, setEvaluation] = useState(null);
  const [readMore, setReadMore] = useState(false);
  const [items, setItems] = useState([]);
  const [minReputation, setMinReputation] = useState(0);
  const [minOrders, setMinOrders] = useState(0);
  const [workerReputation, setWorkerReputation] = useState(null);

  // Helper: execute a Chain contract method from stealth wallet if available
  var sendFromStealth = async function(methodName, args, options) {
    var restaurantAddr = orderBlock[11] || orderBlock[4];
    var stealthKey = getStealthKey(restaurantAddr);

    if (stealthKey) {
      var ethersModule = await import('ethers');
      var ethers = ethersModule.ethers;
      var rpcProvider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL);
      var stealthWallet = new ethers.Wallet(stealthKey, rpcProvider);
      var chainContract = new ethers.Contract(CHAIN_ADDRESS, chain.options.jsonInterface, stealthWallet);
      var txOpts = { gasLimit: 400000 };
      if (options && options.value) txOpts.value = ethers.BigNumber.from(String(options.value));
      var tx = await chainContract[methodName].apply(chainContract, args.concat([txOpts]));
      return await tx.wait();
    } else {
      var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      var sendOpts = { from: accounts[0], gas: 4000000 };
      if (options && options.value) sendOpts.value = options.value;
      return await chain.methods[methodName].apply(null, args).send(sendOpts);
    }
  };
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const [rating, setRating] = useState(0);

  // Fetch deliveryman reputation when one has confirmed intention
  useEffect(() => {
    if (web3 && REPUTATION_ADDRESS && orderBlock[8] &&
        orderBlock[8] !== '0x0000000000000000000000000000000000000000') {
      const reputationContract = new web3.eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS);
      reputationContract.methods.getWorkerStats(orderBlock[8]).call()
        .then(result => setWorkerReputation(result))
        .catch(err => console.log('Reputation fetch error:', err));
    }
  }, [web3, orderBlock[8]]);

  let button_accept;
  let button_second;
  let button_cancel;

  let rep_inputs = null;
  if (orderBlock[3] === 'ORDERED'){
    rep_inputs = (
      <div className="rep-inputs">
        <div className="rep-input-row">
          <label>Min rating (0–5):</label>
          <input type="number" min="0" max="5" step="0.5"
            onChange={e => setMinReputation(Math.round(parseFloat(e.target.value || 0) * 10))} />
        </div>
        <div className="rep-input-row">
          <label>Min orders:</label>
          <input type="number" min="0"
            onChange={e => setMinOrders(parseInt(e.target.value || 0))} />
        </div>
      </div>
    );
    button_accept = <Button onClick={() => prepareOrder(orderBlock[0])}>Accept order</Button>;
    button_second = null;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Refuse</Button>;
  } else if (orderBlock[3] === 'PREPARATION') {
    button_accept = null;
    button_second = null;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel</Button>;
  } else if (orderBlock[3] === 'WAITING') {
    button_cancel = <input maxLength="6" type="text" onChange={ handleChange } />;
    button_accept = <Button onClick={() => pickupOrder(orderBlock[0])}>Dispatch order</Button>;
    button_second = <Button attention onClick={() => callSecondDeliveryman(orderBlock[0])}>Call other deliveryman</Button>;
  } else if (orderBlock[3] === 'DISPATCHED') {
    button_accept = <input maxLength="6" type="text" onChange={ handleChange2 } />;
    button_second = <Button attention onClick={() => contestOrder(orderBlock[0])}>Contest order</Button>;
    button_cancel = <Button warning onClick={() => cancelOrder(orderBlock[0])}>Cancel</Button>;
  } else if (orderBlock[3] === 'CONCLUDED') {
    button_second = null;
    button_cancel = null;
    if (!ratingDone && REPUTATION_ADDRESS && orderBlock[8] &&
        orderBlock[8] !== '0x0000000000000000000000000000000000000000') {
      button_accept = ratingLoading
        ? <CircularProgress size={20} />
        : (
          <div>
            <p>Rate the deliveryman anonymously:</p>
            {[1,2,3,4,5].map(s => (
              <Button key={s} onClick={() => submitRatingHandler(s)}>{'★'.repeat(s)}</Button>
            ))}
          </div>
        );
    } else if (ratingDone) {
      button_accept = <p>Thank you for your anonymous rating!</p>;
    } else {
      button_accept = null;
    }
  } else {
    button_accept = null;
    button_second = null;
    button_cancel = null;
  }

  function handleChange(e) {
    setCode(parseInt(e.target.value));
  }

  function handleChange2(e) {
    setEvaluation("true" === e.target.value.toLowerCase());
  }


  const decryptDetails = async function () {
    const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
    let unecryptedItems;
    if (orderBlock[1] && orderBlock[1].startsWith('0x')) {
      unecryptedItems = await decrypt(accounts[0], orderBlock[1]);
    } else {
      unecryptedItems = orderBlock[1];
    }
    const json_obj = JSON.parse(unecryptedItems);
    json_obj.map(item=>{console.log(item);})
    setItems(json_obj);
    setReadMore(true);
  }

  const cancelOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        var accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        var orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        await sendFromStealth('cancelOrder', [orderAddress]);
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert(parseContractError(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  const callSecondDeliveryman = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        var accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        var orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        await sendFromStealth('callSecondDeliveryman', [orderAddress], { value: orderBlock[2] });
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert(parseContractError(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  const contestOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        var accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        var orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        var result = await sendFromStealth('contestOrder', [orderAddress, deliveryEvaluation]);
        console.log(result);
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert(parseContractError(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }
  
  const pickupOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        var accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        var orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});
        await sendFromStealth('pickupOrder', [orderAddress, deliveryCode]);
        setLoading(false);
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert(parseContractError(err));
        setLoading(false);
      }
    } else {
      console.log('Connect to MetaMask!');
    }
  }


  const prepareOrder = async function (order_id) {
    if (window.ethereum){
      setLoading(true);
      try {
        const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
        let orderAddress = await chain.methods.findAddress(order_id).call({from: accounts[0]});

        // Generate anonymous rating secrets for ZK proof later
        const nullifier = BigInt('0x' + Array.from(window.crypto.getRandomValues(new Uint8Array(31))).map(b => b.toString(16).padStart(2,'0')).join(''));
        const trapdoor = BigInt('0x' + Array.from(window.crypto.getRandomValues(new Uint8Array(31))).map(b => b.toString(16).padStart(2,'0')).join(''));
        const restaurantCommitment = poseidon2([nullifier, trapdoor]).toString();

        // Persist rating secrets keyed by order id
        const orderSecrets = JSON.parse(localStorage.getItem('restaurantOrderSecrets') || '{}');
        orderSecrets[order_id] = { nullifier: nullifier.toString(), trapdoor: trapdoor.toString() };
        localStorage.setItem('restaurantOrderSecrets', JSON.stringify(orderSecrets));

        // Generate payment commitment for ZK payment pool withdrawal
        const paymentSecrets = generateNoteSecrets();
        const paymentCommitment = computePaymentCommitment(paymentSecrets.nullifier, paymentSecrets.trapdoor).toString();

        // Persist payment secrets — will be used to withdraw funds later
        const paymentNoteSecrets = JSON.parse(localStorage.getItem('paymentNoteSecrets') || '{}');
        paymentNoteSecrets[order_id] = {
          nullifier: paymentSecrets.nullifier.toString(),
          trapdoor: paymentSecrets.trapdoor.toString(),
          commitment: paymentCommitment,
        };
        localStorage.setItem('paymentNoteSecrets', JSON.stringify(paymentNoteSecrets));

        // With stealth addresses, we must:
        // 1. Withdraw from ZK pool to stealth address (unlinkable)
        // 2. Call prepareOrder from stealth wallet
        // orderBlock[11] = stealth address (appended by Orders page from scanning)
        // orderBlock[4] = address(0) when called by the restaurant (Order.getItems hides it)
        var restaurantField = orderBlock[11] || orderBlock[4];
        var stealthPrivKey = getStealthKey(restaurantField);
        console.log('[Order] Restaurant/stealth address:', restaurantField);
        console.log('[Order] Stealth private key found:', !!stealthPrivKey);
        var deliveryFee = orderBlock[2]; // already in wei (scaled)

        if (stealthPrivKey) {
          // Estimate total needed: delivery fee + gas for prepareOrder
          var ethersModule = await import('ethers');
          var ethers = ethersModule.ethers;
          var rpcProvider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL);
          var gasPrice = await rpcProvider.getGasPrice();
          // 2x gas price buffer for price fluctuation + 1M gas limit for prepareOrder
          var gasCost = gasPrice.mul(2).mul(1000000);
          var totalNeeded = BigInt(deliveryFee) + BigInt(gasCost.toString());

          // Check pool balance
          var poolBalance = getUnspentBalance();
          if (poolBalance < totalNeeded) {
            alert('Insufficient privacy pool balance. Need ' + ethers.utils.formatEther(totalNeeded.toString()) + ' ETH. Go to Menu page to deposit.');
            setLoading(false);
            return;
          }

          // Plan withdrawal from pool
          var unspent = getUnspentNotes();
          var plan = planWithdrawal(unspent, totalNeeded);
          if (plan.length === 0) {
            alert('Cannot plan pool withdrawal. Deposit more ETH to the privacy pool.');
            setLoading(false);
            return;
          }

          // Wait for rate limiter to cool down after stealth scanning
          await new Promise(function(r) { setTimeout(r, 3000); });

          // Fetch tree state for Merkle proofs
          var treeState = await fetchTreeState(logWeb3, REPUTATION_ADDRESS, DEPLOY_BLOCK || 0);

          if (treeState.allLeaves.length === 0) {
            alert('Failed to fetch tree state (RPC rate limited). Please wait a moment and try again.');
            setLoading(false);
            return;
          }

          // Get current root from contract
          var reputationContract = new web3.eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS);
          var currentRoot = await reputationContract.methods.globalRoot().call();

          // Select notes for withdrawal
          var note1, note2;
          if (unspent.length >= 2) {
            // Use two real notes — avoid the dummy note (its nullifier may be spent)
            note1 = unspent[0];
            note2 = unspent[1];
          } else if (unspent.length === 1) {
            // Only one note — must use dummy, but check if it's been spent
            note1 = unspent[0];
            note2 = getDummyNote();
            var dummyNullHash = computeNullifierHash(0n, 0n).toString();
            var dummySpent = await reputationContract.methods.usedNullifiers(dummyNullHash).call();
            if (dummySpent) {
              alert('Cannot withdraw with a single note (dummy note already used). Please make a second deposit to the privacy pool on the Menu page.');
              setLoading(false);
              return;
            }
          } else {
            alert('No unspent notes in the pool. Deposit ETH on the Menu page first.');
            setLoading(false);
            return;
          }
          var changeSecrets = generateNoteSecrets();

          // Convert stealth address to uint256 for the circuit
          var recipientUint = BigInt(restaurantField).toString();

          console.log('[Order] Generating ZK proof for pool withdrawal...');
          console.log('[Order] note1 amount:', note1.amount);
          console.log('[Order] note2 amount:', note2.amount);
          console.log('[Order] withdrawAmount:', totalNeeded.toString());
          console.log('[Order] recipient:', recipientUint);
          console.log('[Order] root:', currentRoot);
          console.log('[Order] allLeaves count:', treeState.allLeaves.length);

          var proofResult = await generateMergeWithdrawProof({
            note1: note1,
            note2: note2,
            withdrawAmount: totalNeeded.toString(),
            recipient: recipientUint,
            root: currentRoot,
            allLeaves: treeState.allLeaves,
            zeros: treeState.zeros,
            changeSecrets: changeSecrets,
          });

          console.log('[Order] Proof generated. publicSignals:', proofResult.publicSignals);

          console.log('[Order] Submitting pool withdrawal...');
          var mergeWithdrawCall = reputationContract.methods.mergeWithdraw(
            restaurantField,
            totalNeeded.toString(),
            proofResult.publicSignals[0],
            proofResult.publicSignals[1],
            proofResult.publicSignals[2],
            currentRoot,
            proofResult.proof.a,
            proofResult.proof.b,
            proofResult.proof.c
          );

          // Dry-run to get revert reason before spending gas
          try {
            await mergeWithdrawCall.call({ from: accounts[0], gas: 2000000 });
          } catch(dryErr) {
            console.error('[Order] mergeWithdraw dry-run failed:', dryErr.message || dryErr);
            alert('Pool withdrawal would fail: ' + (dryErr.message || dryErr));
            setLoading(false);
            return;
          }

          await mergeWithdrawCall.send({ from: accounts[0], gas: 2000000 });

          // Mark notes as spent and store change note
          markNoteSpent(note1.nullifier);
          if (note2.nullifier !== 0n && note2.nullifier !== '0') {
            markNoteSpent(note2.nullifier);
          }
          if (proofResult.changeNote.amount > 0n) {
            // Need to get the leafIndex from the TicketAdded event
            addChangeNote({
              nullifier: changeSecrets.nullifier,
              trapdoor: changeSecrets.trapdoor,
              amount: proofResult.changeNote.amount.toString(),
              leafIndex: treeState.allLeaves.length, // approximate — may need event lookup
              commitment: proofResult.changeNote.commitment.toString(),
            });
          }

          // Now call prepareOrder from the stealth wallet
          var stealthWallet = new ethers.Wallet(stealthPrivKey, rpcProvider);
          var stealthBalance = await rpcProvider.getBalance(stealthWallet.address);
          console.log('[Order] Stealth address funded. Balance:', ethers.utils.formatEther(stealthBalance), 'ETH');
          console.log('[Order] Delivery fee:', ethers.utils.formatEther(ethers.BigNumber.from(String(deliveryFee))), 'ETH');
          console.log('[Order] Remaining for gas:', ethers.utils.formatEther(stealthBalance.sub(ethers.BigNumber.from(String(deliveryFee)))), 'ETH');

          var chainContract = new ethers.Contract(CHAIN_ADDRESS, chain.options.jsonInterface, stealthWallet);
          var tx = await chainContract.prepareOrder(
            orderAddress,
            restaurantCommitment,
            paymentCommitment,
            minReputation,
            minOrders,
            { value: ethers.BigNumber.from(String(deliveryFee)), gasLimit: 400000 }
          );
          await tx.wait();
        } else {
          // Fallback: no stealth key, use main wallet (legacy non-stealth orders)
          await chain.methods.prepareOrder(orderAddress, restaurantCommitment, paymentCommitment, minReputation, minOrders)
            .send({ from: accounts[0], gas: 4000000, value: deliveryFee });
        }
      } catch(err) {
        console.error(err);
        alert(parseContractError(err));
        setLoading(false);
        return;
      }
      setLoading(false);
      window.location.reload();
    } else {
      console.log('Connect to MetaMask!');
    }
  }

  const submitRatingHandler = async function (score) {
    if (!orderBlock[8] || orderBlock[8] === '0x0000000000000000000000000000000000000000') return;
    setRatingLoading(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const reputationContract = new (logWeb3 || web3).eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS);

      // Use restaurant secrets stored at accept time
      const orderSecrets = JSON.parse(localStorage.getItem('restaurantOrderSecrets') || '{}');
      const secrets = orderSecrets[orderBlock[0]];
      if (!secrets) throw new Error('Rating secrets not found for this order');

      // Pre-check: compute nullifierHash cheaply and verify it hasn't been used
      const preNullifierHash = poseidon2([BigInt(secrets.nullifier), BigInt(orderBlock[8])]).toString();
      const alreadyUsed = await reputationContract.methods.usedNullifiers(preNullifierHash).call();
      if (alreadyUsed) {
        alert('You have already rated this delivery worker.');
        setRatingLoading(false);
        setRatingDone(true);
        return;
      }

      const { a, b, c, nullifierHash, root } = await generateRatingProof(
        web3, reputationContract, orderBlock[8], score, orderBlock[0]
      );
      await chain.methods.submitRating(
        REPUTATION_ADDRESS, orderBlock[8], score, nullifierHash, root, a, b, c
      ).send({ from: accounts[0], gas: 4000000 });
      setRatingDone(true);
      setRating(score);
    } catch (err) {
      console.error('Rating submission failed:', err);
      alert(parseContractError(err));
    }
    setRatingLoading(false);
  }
  const hasRepRequirements = parseInt(orderBlock[9]) > 0 || parseInt(orderBlock[10]) > 0;

  return (
    <Order>
      <div className="order-header">
        <span className="order-id">Order #{orderBlock[0]}</span>
        <StatusBadge status={orderBlock[3]}>{orderBlock[3]}</StatusBadge>
      </div>

      {hasRepRequirements && (
        <ReputationBadge>
          <span className="rep-icon">⭐</span>
          <span>Requirements:</span>
          {parseInt(orderBlock[9]) > 0 && (
            <span className="rep-item">
              <span className="rep-label">Min rating</span>
              {(parseInt(orderBlock[9]) / 10).toFixed(1)}★
            </span>
          )}
          {parseInt(orderBlock[10]) > 0 && (
            <span className="rep-item">
              <span className="rep-label">Min orders</span>
              {orderBlock[10]}
            </span>
          )}
        </ReputationBadge>
      )}

      {workerReputation && (
        <WorkerReputationBadge>
          <span className="rep-icon">🚴</span>
          {workerReputation[1] > 0
            ? `${(workerReputation[0] / 10).toFixed(1)}★ · ${workerReputation[1]} ratings · ${workerReputation[2]} deliveries`
            : `New worker · ${workerReputation[2]} deliveries`}
        </WorkerReputationBadge>
      )}

      <div className="customer-info">
        <p><span>Delivery fee:</span> U${priceUtils.weiToDollars(orderBlock[2])}</p>
        {readMore && <p><span>Items total:</span> U${items.reduce((sum, item) => sum + item.quantity * item.price, 0)}</p>}
        <p><span>Placed:</span> <Moment unix>{orderBlock[6]}</Moment></p>
        <p><span>Updated:</span> <Moment unix>{orderBlock[7]}</Moment></p>
      </div>

      { readMore ? (
        <div className="order-info">
          {items.map((item, index) => (
            <ItemLine key={index} quantity={item.quantity} itemName={item.name} />
          ))}
        </div>
      ) : (
        <div className="customer-info">
          <button onClick={decryptDetails} style={{fontSize:'13px', background:'none', border:'1px solid #ddd', borderRadius:'6px', padding:'5px 10px', cursor:'pointer'}}>
            Show items
          </button>
        </div>
      )}

      {loading ? <CircularProgress style={{margin:'10px auto', display:'block'}} /> :
        <div className="accept-btn">
          {rep_inputs}
          {button_cancel}
          {button_second}
          {button_accept}
        </div>
      }
    </Order>
  )
}

