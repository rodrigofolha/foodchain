
import React, { useState, useEffect } from 'react';
import { Formik } from 'formik';
import * as Yup from 'yup';

import { ErrorText, SubmitBtn, AlignBtn} from '../../global-styles';

import api from '../../services/api';
import { getOrCreateSpendKey } from '../../utils/stealth';
import { getEncryptionPublicKey } from '../../utils/crypto';
import { readStoredSpendKey, settingsAccess, isPublishedEncryptionKey } from '../../utils/establishmentKeys';

var validationUpdateInformations = Yup.object().shape({
  restaurant_city: Yup.string().required('City is required'),
  restaurant_name: Yup.string().required('Name is required'),
  restaurant_address: Yup.string().required('Address is required'),
  culinary: Yup.string().required('Culinary is required'),
  latitude: Yup.number().required('Latitude is required'),
  longitude: Yup.number().required('Longitude is required'),
  spend_public_key: Yup.string().required('Spend key is required')
});

export default function UpdateInformation(props) {
  // 'loading', 'open' or 'wallet' (see settingsAccess)
  var [access, setAccess] = useState('loading');
  var [verifying, setVerifying] = useState(false);
  var [verifyError, setVerifyError] = useState('');

  // No wallet address is stored for the establishment. The form opens when this
  // browser holds the published stealth keys; otherwise the connected account has
  // to show the published encryption key (asked on a click, never on page load).
  useEffect(function() {
    setVerifyError('');
    setAccess(settingsAccess(readStoredSpendKey(), props.response));
  }, [props.response]);

  async function verifyWallet() {
    if (!window.ethereum) {
      setVerifyError('MetaMask is not installed. Please install it to continue.');
      return;
    }
    setVerifying(true);
    setVerifyError('');
    try {
      var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      var accountKey = await getEncryptionPublicKey(accounts[0]);
      if (isPublishedEncryptionKey(accountKey, props.response)) {
        setAccess('open');
      } else {
        setVerifyError('This account is not the one used to register this restaurant. Switch the account in MetaMask and try again.');
      }
    } catch (err) {
      setVerifyError('The wallet could not be checked. Approve the encryption key request in MetaMask and try again.');
    }
    setVerifying(false);
  }

  async function handleSubmit(values, { setSubmitting }) {
    try {
      await api.put('/manager/update-restaurant', values, {
        headers: {
          authorization: localStorage.getItem('authorization')
        }
      });
      setSubmitting(false);
      alert('Changes saved successfully!');
    } catch (err) {
      console.error('Restaurant update failed:', (err && err.message) || 'unknown error');
      setSubmitting(false);
    }
  }

  function generateSpendKey(setFieldValue, setFieldTouched) {
    var spendKey = getOrCreateSpendKey();
    setFieldValue('spend_public_key', spendKey.publicKeyCompressed);
    setFieldTouched('spend_public_key', true, false);
    // The customer derives the stealth address from both keys
    setFieldValue('view_public_key', spendKey.viewPublicKeyCompressed);
  }

  function fillCurrentLocation(setFieldValue, setFieldTouched) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        setFieldValue('latitude', pos.coords.latitude);
        setFieldTouched('latitude', true, false);
        setFieldValue('longitude', pos.coords.longitude);
        setFieldTouched('longitude', true, false);
      }, function() {
        alert('Could not get your location. Please enter coordinates manually.');
      });
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  }

  if (access === 'loading') {
    return <p>Loading...</p>;
  }

  if (access === 'wallet') {
    return (
      <div style={{padding: '15px', background: '#f8d7da', borderRadius: '8px', marginBottom: '20px'}}>
        <p style={{color: '#721c24', fontWeight: 'bold'}}>Wallet check needed</p>
        <p style={{color: '#721c24'}}>This browser does not hold the stealth keys published for this restaurant. To edit, connect MetaMask with the account used to register it.</p>
        <button type="button" onClick={verifyWallet} disabled={verifying}
          style={{marginTop: '10px', padding: '8px 16px', cursor: 'pointer'}}>
          {verifying ? 'Checking wallet...' : 'Check wallet'}
        </button>
        {verifyError && <ErrorText>{verifyError}</ErrorText>}
      </div>
    );
  }

  return (
      <Formik
        validationSchema={validationUpdateInformations}
        initialValues={{
          restaurant_city: props.response.restaurant_city || '',
          restaurant_name: props.response.restaurant_name || '',
          restaurant_address: props.response.restaurant_address || '',
          culinary: props.response.culinary || '',
          latitude: props.response.latitude || '',
          longitude: props.response.longitude || '',
          spend_public_key: props.response.spend_public_key || '',
          view_public_key: props.response.view_public_key || '',
        }}
        enableReinitialize
        onSubmit={handleSubmit}
      >
        {function({ handleSubmit, handleChange, values, touched, isSubmitting, errors, setFieldValue, setFieldTouched }) { return (
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <h3>Basic informations</h3>

            <label htmlFor="restaurant_city">City</label>
            <input
              name="restaurant_city"
              type="text"
              value={values.restaurant_city}
              onChange={handleChange}
            />
            {errors.restaurant_city && touched.restaurant_city && <ErrorText>{errors.restaurant_city}</ErrorText>}

            <label htmlFor="restaurant_name">Name</label>
            <input
              name="restaurant_name"
              type="text"
              value={values.restaurant_name}
              onChange={handleChange}
            />
            {errors.restaurant_name && touched.restaurant_name && <ErrorText>{errors.restaurant_name}</ErrorText>}

            <label htmlFor="restaurant_address">Address</label>
            <input
              name="restaurant_address"
              type="text"
              value={values.restaurant_address}
              onChange={handleChange}
            />
            {errors.restaurant_address && touched.restaurant_address && <ErrorText>{errors.restaurant_address}</ErrorText>}

            <label htmlFor="culinary">Culinary</label>
            <input
              name="culinary"
              type="text"
              value={values.culinary}
              onChange={handleChange}
            />
            {errors.culinary && touched.culinary && <ErrorText>{errors.culinary}</ErrorText>}
          </div>

          <div className="input-group">
            <h3>Location</h3>
            <button type="button" onClick={function() { fillCurrentLocation(setFieldValue, setFieldTouched); }}
              style={{marginBottom: '10px', padding: '8px 16px', cursor: 'pointer'}}>
              Use Current Location
            </button>

            <label htmlFor="latitude">Latitude</label>
            <input
              name="latitude"
              type="number"
              step="any"
              value={values.latitude}
              onChange={handleChange}
            />
            {errors.latitude && touched.latitude && <ErrorText>{errors.latitude}</ErrorText>}

            <label htmlFor="longitude">Longitude</label>
            <input
              name="longitude"
              type="number"
              step="any"
              value={values.longitude}
              onChange={handleChange}
            />
            {errors.longitude && touched.longitude && <ErrorText>{errors.longitude}</ErrorText>}
          </div>

          <div className="input-group">
            <h3>Privacy</h3>
            {!values.spend_public_key && (
              <button type="button" onClick={function() { generateSpendKey(setFieldValue, setFieldTouched); }}
                style={{marginBottom: '10px', padding: '8px 16px', cursor: 'pointer'}}>
                Generate Stealth Spend Key
              </button>
            )}

            <label htmlFor="spend_public_key">Stealth Spend Key</label>
            <input
              name="spend_public_key"
              type="text"
              value={values.spend_public_key}
              readOnly
            />
            {errors.spend_public_key && touched.spend_public_key && <ErrorText>{errors.spend_public_key}</ErrorText>}
          </div>

          <AlignBtn>
              <SubmitBtn size={'100%'} type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving changes" : "Submit"}
              </SubmitBtn>
            </AlignBtn>
        </form>
        ); }}
      </Formik>
  )
}
