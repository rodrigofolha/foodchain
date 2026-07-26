import React from 'react';
import { Formik } from 'formik';
import * as Yup from 'yup';

import Header from '../../components/Header';
import Loading from '../../components/Loading';

import { Container, FormContainer, ItemContainer, InputBox } from './styles';
import { Button, Input, ErrorText } from '../../global-styles';

import api from '../../services/api';
import { getEncryptionPublicKey } from '../../utils/crypto';
import { getOrCreateSpendKey } from '../../utils/stealth';

const validationSchema = Yup.object().shape({
  restaurant_name: Yup.string().required("Restaurant name is required"),
  restaurant_address: Yup.string().required("Restaurant address is required"),
  restaurant_city: Yup.string().required("Restaurant city is required"),
  name: Yup.string().required('Name is required'),
  email: Yup.string().email('Put a valid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
  culinary: Yup.string().required('Cuisine is required'),
  latitude: Yup.number().required('Latitude is required'),
  longitude: Yup.number().required('Longitude is required'),
  digital_address: Yup.string().required('Digital address is required'),
  public_key: Yup.string().required('Connect MetaMask to generate your encryption key'),
  spend_public_key: Yup.string().required('Spend key is required (auto-generated)'),
  view_public_key: Yup.string().required('View key is required (auto-generated)')
});

export default function CreateAccount({ history }) {
  const emailsAlreadyInUse = [];
  async function handleSubmit (values, {
    setSubmitting,
    setFieldError
  }) {
    try {
      await api.post('/manager/signup', values);
      setSubmitting(false);
      history.push('/session')
    }
    catch (err) {
      setFieldError('email', 'email already used');
      emailsAlreadyInUse.push(err.data);
      setSubmitting(false);
    }
  }

  // Connect MetaMask and auto-fill digital_address + public_key + spend_public_key
  async function connectWallet(setFieldValue, setFieldTouched) {
    if (!window.ethereum) {
      alert('MetaMask is not installed. Please install it to continue.');
      return;
    }
    try {
      var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      var account = accounts[0];
      setFieldValue('digital_address', account);
      setFieldTouched('digital_address', true, false);

      var encryptionKey = await getEncryptionPublicKey(account);
      setFieldValue('public_key', encryptionKey);
      setFieldTouched('public_key', true, false);

      // Generate stealth keypairs (spend + view) for privacy (EIP-5564)
      var spendKey = getOrCreateSpendKey();
      setFieldValue('spend_public_key', spendKey.publicKeyCompressed);
      setFieldTouched('spend_public_key', true, false);
      setFieldValue('view_public_key', spendKey.viewPublicKeyCompressed);
      setFieldTouched('view_public_key', true, false);
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      alert('Failed to connect MetaMask. Please try again.');
    }
  }

  return (
      <>
      <Header />
      <Container>
        <div className="home-container">
            <ItemContainer>
              <h2>Get you independance today. Be the owner of your own business</h2>
              <p>FoodChain is a plataform to connect clients, restaurants and drivers with no comission. Be part of revolution!</p>
            </ItemContainer>

            <FormContainer className="item-container  form-container">
              <h2>Partner with us</h2>

              <Formik
                initialValues={{
                  restaurant_address: "",
                  restaurant_city: "",
                  restaurant_name: "",
                  name: "",
                  email: "",
                  password: "",
                  culinary: "",
                  latitude: "",
                  longitude: "",
                  digital_address: "",
                  public_key: "",
                  spend_public_key: "",
                  view_public_key: ""
                }}
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
                validate={
                  values => {
                    let errors = {};
                    if (emailsAlreadyInUse.includes(values.email)) {
                      errors.email = 'email is already in use';
                    }
                    return errors;
                  }
                }
              >
                {({ handleSubmit, handleChange, values, errors, touched, isSubmitting, setFieldValue, setFieldTouched }) => (
                <form onSubmit={handleSubmit}>
                  <InputBox>
                    <Input
                      type="text"
                      placeholder="Restaurant Name"
                      name="restaurant_name"
                      onChange={handleChange}
                      values={values.restaurant_name}
                    />
                    {errors.restaurant_name && touched.restaurant_name && <ErrorText>{errors.restaurant_name}</ErrorText>}
                    <Input
                      type="text"
                      name="restaurant_address"
                      placeholder="Restaurant Address"
                      onChange={handleChange}
                      values={values.restaurant_address}
                    />
                    {errors.restaurant_address && touched.restaurant_address && <ErrorText>{errors.restaurant_address}</ErrorText>}
                    <Input
                      type="text"
                      name="restaurant_city"
                      placeholder="Restaurant City"
                      onChange={handleChange}
                      values={values.restaurant_city}
                    />
                    {errors.restaurant_city && touched.restaurant_city && <ErrorText>{errors.restaurant_city}</ErrorText>}
                  </InputBox>

                  <InputBox>
                    <Input
                      type="text"
                      name="name"
                      placeholder="Full Name"
                      onChange={handleChange}
                      values={values.name}
                    />
                    {errors.name && touched.name && <ErrorText>{errors.name}</ErrorText>}
                    <Input
                      type="email"
                      name="email"
                      placeholder="Email"
                      onChange={handleChange}
                      values={values.email}
                    />
                    {errors.email && touched.email && <ErrorText>{errors.email}</ErrorText>}
                    <Input
                      type="password"
                      name="password"
                      placeholder="Password"
                      onChange={handleChange}
                      values={values.password}
                    />
                    {errors.password && touched.password && <ErrorText>{errors.password}</ErrorText>}
                  </InputBox>

                  <InputBox>
                    <Input
                      type="text"
                      name="culinary"
                      placeholder="Type of cuisine"
                      onChange={handleChange}
                      values={values.culinary}
                    />
                    {errors.culinary && touched.culinary && <ErrorText>{errors.culinary}</ErrorText>}
                  </InputBox>

                  <InputBox>
                    <Button
                      type="button"
                      onClick={function() {
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
                      }}
                      style={{ marginBottom: '10px' }}
                    >
                      Use Current Location
                    </Button>
                    <Input
                      type="number"
                      step="any"
                      name="latitude"
                      placeholder="Latitude (e.g., 41.3851)"
                      onChange={handleChange}
                      value={values.latitude}
                    />
                    {errors.latitude && touched.latitude && <ErrorText>{errors.latitude}</ErrorText>}
                    <Input
                      type="number"
                      step="any"
                      name="longitude"
                      placeholder="Longitude (e.g., 2.1734)"
                      onChange={handleChange}
                      value={values.longitude}
                    />
                    {errors.longitude && touched.longitude && <ErrorText>{errors.longitude}</ErrorText>}
                  </InputBox>

                  <InputBox>
                    <Button
                      type="button"
                      onClick={() => connectWallet(setFieldValue, setFieldTouched)}
                      style={{ marginBottom: '10px' }}
                    >
                      Connect MetaMask
                    </Button>
                    <Input
                      type="text"
                      name="digital_address"
                      placeholder="Wallet address (connect MetaMask above)"
                      onChange={handleChange}
                      value={values.digital_address}
                      readOnly
                    />
                    {errors.digital_address && touched.digital_address && <ErrorText>{errors.digital_address}</ErrorText>}
                    <Input
                      type="text"
                      name="public_key"
                      placeholder="Encryption key (auto-generated)"
                      value={values.public_key}
                      readOnly
                    />
                    {errors.public_key && touched.public_key && <ErrorText>{errors.public_key}</ErrorText>}
                    <Input
                      type="text"
                      name="spend_public_key"
                      placeholder="Stealth spend key (auto-generated)"
                      value={values.spend_public_key}
                      readOnly
                    />
                    {errors.spend_public_key && touched.spend_public_key && <ErrorText>{errors.spend_public_key}</ErrorText>}
                  </InputBox>

                  <Button type="submit" disabled={isSubmitting}>Submit</Button>
                  {isSubmitting && <Loading />}
                </form>
                )}
              </Formik>

            </FormContainer>
        </div>
      </Container>
      </>
  );
}
