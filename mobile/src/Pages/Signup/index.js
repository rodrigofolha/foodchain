import React, { useState } from 'react';
import { Formik } from 'formik';
import * as Yup from 'yup';

import Icon from 'react-native-vector-icons/MaterialIcons';
Icon.loadFont();

import {
  Header,
  BackLink,
  Text,
  Container, 
  Card,
  Input,
  LoginButton,
  CardTitle,
  TextButton
} from './styles';

import { ErrorText, ScrollView } from '../../globalStyles';

const validationSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  address: Yup.string().required('Address is required'),
  district: Yup.string().required('Distric is required'),
  email: Yup.string().email('Put a valid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

export default function Login({ navigation }) {
  return (
    <>
    <Header>
      <BackLink onPress={() => navigation.goBack()}>
        <Icon name="chevron-left" size={24} color="#000" />
        <Text>Back</Text>
      </BackLink>
    </Header>
    
    <ScrollView>
    <Container>
      <Formik
        initialValues={{ 
          name: '',
          address: '',
          district: '',
          email: '',
          password: '',
        }}
        validationSchema={validationSchema}
        onSubmit={(values) => console.log(values)}
      >
        {({ handleSubmit, handleBlur, handleChange, errors, values, touched }) => (
        <>
        <Card>
          <CardTitle>Create Account</CardTitle>

          <Input 
            placeholder="Name"
            onChangeText={handleChange('name')}
            onBlur={handleBlur('name')}
            value={values.name}
          />
          {errors.name && touched.name && <ErrorText>{errors.name}</ErrorText>}

          <Input 
            placeholder="Address"
            onChangeText={handleChange('address')}
            onBlur={handleBlur('address')}
            value={values.address}
          />
          {errors.address && touched.address && <ErrorText>{errors.address}</ErrorText>}
          
          <Input 
            placeholder="District"
            onChangeText={handleChange('district')}
            onBlur={handleBlur('district')}
            value={values.district}
          />
          {errors.district && touched.district && <ErrorText>{errors.district}</ErrorText>}

          <Input 
            placeholder="Email" 
            keyboardType="email-address"
            onChangeText={handleChange('email')}
            onBlur={handleBlur('email')}
            value={values.email} 
          />
          {errors.email && touched.email && <ErrorText>{errors.email}</ErrorText>}

          <Input 
            placeholder="Password" 
            secureTextEntry={true} 
            onChangeText={handleChange('password')}
            onBlur={handleBlur('password')}
            value={values.password}
          />
          {errors.password && touched.password && <ErrorText>{errors.password}</ErrorText>}

        </Card>

        <LoginButton onPress={() => handleSubmit()}>
          <TextButton>Create</TextButton>
        </LoginButton>
        </>
      )}
      </Formik>
    </Container>
    </ScrollView>
    </>
  )
}