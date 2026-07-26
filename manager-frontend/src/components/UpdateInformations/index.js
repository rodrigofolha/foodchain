
import React, { useState, useEffect } from 'react';
import { Formik } from 'formik';
import * as Yup from 'yup';

import { ErrorText, SubmitBtn, AlignBtn} from '../../global-styles';

import api from '../../services/api';
import { getOrCreateSpendKey } from '../../utils/stealth';

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
  var [walletMatch, setWalletMatch] = useState(null); // null = checking, true = match, false = mismatch

  useEffect(function() {
    async function checkWallet() {
      if (!window.ethereum || !props.response.digital_address) {
        setWalletMatch(false);
        return;
      }
      var accounts = await window.ethereum.request({ method: 'eth_accounts' }).catch(function() { return []; });
      if (accounts && accounts.length > 0) {
        setWalletMatch(accounts[0].toLowerCase() === props.response.digital_address.toLowerCase());
      } else {
        setWalletMatch(false);
      }
    }
    checkWallet();
  }, [props.response.digital_address]);

  async function handleSubmit(values, { setSubmitting }) {
    try {
      console.log(values);
      var response = await api.put('/manager/update-restaurant', values, {
        headers: {
          authorization: localStorage.getItem('authorization')
        }
      });
      console.log(response.data);
      setSubmitting(false);
      alert('Changes saved successfully!');
    } catch (err) {
      console.log(err);
      setSubmitting(false);
    }
  }

  function generateSpendKey(setFieldValue, setFieldTouched) {
    var spendKey = getOrCreateSpendKey();
    setFieldValue('spend_public_key', spendKey.publicKeyCompressed);
    setFieldTouched('spend_public_key', true, false);
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

  if (walletMatch === false) {
    return (
      <div style={{padding: '15px', background: '#f8d7da', borderRadius: '8px', marginBottom: '20px'}}>
        <p style={{color: '#721c24', fontWeight: 'bold'}}>Wallet mismatch</p>
        <p style={{color: '#721c24'}}>Connect MetaMask with the wallet address registered for this restaurant ({props.response.digital_address}) to edit.</p>
      </div>
    );
  }

  if (walletMatch === null) {
    return <p>Checking wallet...</p>;
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
