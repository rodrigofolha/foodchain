/* global BigInt */
import React, { useState, useEffect } from 'react';
import { Formik } from 'formik';
import * as Yup from 'yup';

import { MenuContainer, AlertFill, ImgPreview } from './styles';
import { SubmitBtn, ErrorText, AlignBtn } from '../../global-styles';

import Header from '../../components/Header';
import Navigation from '../../components/Navigation';
import Item from '../../components/Item';
import CreateItem from '../../components/CreateItem'
import UpdateInformations from '../../components/UpdateInformations';

import api from '../../services/api';
import { useWeb3 } from '../../services/getWeb3';
import { REPUTATION_ADDRESS, REPUTATION_ABI } from '../../services/config';
import { generateNoteSecrets, computePaymentCommitment, storePaymentNote, getUnspentBalance } from '../../utils/zkWithdraw';
import { poseidon2 } from '../../utils/poseidon';

const validationAppearance = Yup.object().shape({
  description: Yup.string().required('Description is required'),
  delivery_price: Yup.number().required('Delivery price is required'),
  logo: Yup.mixed().required('Logo is required'),
  banner: Yup.mixed().required('Banner is required')
});

const validationUpdateAppeareance = Yup.object().shape({
  description: Yup.string(),
  delivery_price: Yup.number(),  
});

export default function Dashboard() {
  const [restaurant, setRestaurant] = useState('');
  const [menu, setMenu] = useState('');
  const [logo, setLogo] = useState('');
  const [banner, setBanner] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [poolBalance, setPoolBalance] = useState('0');
  const { web3 } = useWeb3();

  // Update pool balance display
  useEffect(function() {
    try {
      var bal = getUnspentBalance();
      setPoolBalance(bal.toString());
    } catch(_) {}
  }, [depositing]);

  var depositToPool = async function() {
    if (!window.ethereum || !depositAmount || !web3) return;
    setDepositing(true);
    try {
      var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      var amountWei = web3.utils.toWei(depositAmount, 'ether');

      // Generate note secrets
      var secrets = generateNoteSecrets();
      var commitment = computePaymentCommitment(secrets.nullifier, secrets.trapdoor);

      // Call Reputation.depositPayment(commitment) with msg.value
      var reputationContract = new web3.eth.Contract(REPUTATION_ABI, REPUTATION_ADDRESS);
      var receipt = await reputationContract.methods.depositPayment(commitment.toString())
        .send({ from: accounts[0], gas: 2000000, value: amountWei });

      // Extract leafIndex from TicketAdded event
      var leafIndex = 0;
      if (receipt.events && receipt.events.TicketAdded) {
        leafIndex = parseInt(receipt.events.TicketAdded.returnValues.leafIndex);
      }

      // Compute the leaf as the contract does: poseidon(commitment, amount)
      var leaf = poseidon2([BigInt(commitment.toString()), BigInt(amountWei)]);

      // Store note in localStorage
      storePaymentNote({
        nullifier: secrets.nullifier,
        trapdoor: secrets.trapdoor,
        amount: amountWei,
        leafIndex: leafIndex,
        commitment: commitment.toString(),
      });

      setDepositAmount('');
      alert('Deposited ' + depositAmount + ' ETH into privacy pool!');
    } catch(err) {
      console.error('Pool deposit error:', err);
      alert('Deposit failed: ' + (err.message || err));
    }
    setDepositing(false);
  };
  
  useEffect(() => {
    async function fetchData() {
      const token = localStorage.getItem('authorization');
      const response = await api.get('/manager/restaurant', {
        headers: {
          authorization: token
        }
      });
      
      if (response.data.restaurant) {
        setRestaurant(response.data.restaurant);
        setMenu(response.data);       
        setLogo(`https://api.arthurcarvalho.info/food/files/${response.data.logo_path}`);
        setBanner(`https://api.arthurcarvalho.info/food/files/${response.data.banner_path}`);
      } else {
        setRestaurant(response.data);
      }
    } 
    fetchData();
  }, [])

  async function handleSubmit(values, { setSubmitting }) {
    try {
      const formData = new FormData();
      formData.append('description', values.description);
      formData.append('delivery_price', values.delivery_price);
      formData.append('logo', values.logo);
      formData.append('banner', values.banner);

      if (restaurant.active) {
        await api.put('/manager/update-menu', 
          formData, {
            headers: {
              authorization: localStorage.getItem('authorization'),
              'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
            }
          }
        );
        
      } else {
        await api.post('/manager/create-menu', 
          formData, {
            headers: {
              authorization: localStorage.getItem('authorization'),
              'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
            }
          }
        );
      }
      
      setSubmitting(false);    
    } catch(err) {
      alert('Something went wrong, try again later')
      setSubmitting(false);
    }
  }

  return (
    <>
    <Header />
    <Navigation />
    <MenuContainer>
      <div className="settings-container">
        <h4>About manager</h4>
        <div className="about-manager">
        <p><strong>Name: </strong>{restaurant.name}</p>
        <p><strong>Email: </strong>{restaurant.email}</p>
        </div>

        <div className="form-header">
          <h2>Update your restaurant Informations </h2>
          <AlertFill filled={restaurant.active}>{restaurant.active ? "You're all set to start selling" : 'Please fill out all fields to start selling'}</AlertFill>
        </div>
        <div className="form-container">

        <UpdateInformations response={restaurant} />

        <div className="input-group" style={{marginTop: '20px', padding: '20px', background: '#f0f4ff', borderRadius: '8px'}}>
          <h3>Privacy Pool</h3>
          <p style={{fontSize: '14px', color: '#555', marginBottom: '10px'}}>
            Deposit ETH to fund stealth addresses privately. This balance is used to accept orders without revealing your identity.
          </p>
          <p style={{marginBottom: '10px'}}><strong>Pool balance:</strong> {web3 ? web3.utils.fromWei(poolBalance, 'ether') : '0'} ETH</p>
          <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="Amount in ETH"
              value={depositAmount}
              onChange={function(e) { setDepositAmount(e.target.value); }}
              style={{flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
            />
            <button
              type="button"
              onClick={depositToPool}
              disabled={depositing || !depositAmount}
              style={{padding: '8px 20px', cursor: 'pointer', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px'}}
            >
              {depositing ? 'Depositing...' : 'Deposit'}
            </button>
          </div>
        </div>

        <Formik
          validationSchema={restaurant.active ? validationUpdateAppeareance : validationAppearance}
          initialValues={{
            description: menu.description || '',
            delivery_price: menu.delivery_price || '',
          }}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ handleSubmit, handleChange, values, setFieldValue, touched, isSubmitting, errors }) => (
          <form onSubmit={handleSubmit} encType="multipart/form-data" className='form-appearence'>
            <div className="input-group">
              <h3>Appearance</h3>
              <label htmlFor="description">Description</label>
              <input 
                name="description"
                type="text"
                value={values.description}
                onChange={handleChange}
                placeholder="ex: The best restaurant of the city" 
              />
              {errors.description && touched.description && <ErrorText>{errors.description}</ErrorText>}

              <label htmlFor="delivery_price">Delivery price</label>
              <input 
                name="delivery_price"
                type="number"
                onChange={handleChange} 
                value={values.delivery_price}
                placeholder="ex: 7.89"
              />
              {errors.delivery_price && touched.delivery_price && <ErrorText>{errors.delivery_price}</ErrorText>}

              <div className="file-input-group">
                <label >
                  Upload your logo

                  <div className="preview-container">
                    <ImgPreview src={logo} />
                  </div>

                  <input name="logo" type="file" onChange={(event) => {
                    setFieldValue("logo", event.currentTarget.files[0]);
                  }} />

                  {errors.logo && touched.logo && <ErrorText>{errors.logo}</ErrorText>}
                </label>

                <label>
                  Upload your banner

                  <div className="preview-container">
                    <ImgPreview src={banner} />
                  </div>

                  <input name="banner"  type="file" onChange={(event) => {
                    setFieldValue("banner", event.currentTarget.files[0]);
                  }} />

                  {errors.banner && touched.banner && <ErrorText>{errors.banner}</ErrorText>}
                </label>
              </div>
            </div>

            <AlignBtn>
              <SubmitBtn size={'100%'} type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving changes" : "Submit"}
              </SubmitBtn>
            </AlignBtn>
        </form>
        )}
      </Formik>
      </div>
    </div>

    <CreateItem />
    </MenuContainer>
    </>
  )
}