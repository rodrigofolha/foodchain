import React from 'react';

import * as Yup from 'yup';
import { Formik } from 'formik';

import { Container, FormContainer, Footer, Input, SubmitButton} from './styles';
import { SecondaryLink, ErrorText } from '../../GlobalStyles';

import Logo from '../../assets/ue_logo_horizontal.png';

import api from '../../services/api';
//import { Login } from '../../utils/auth';

const validationSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  email: Yup.string().email('Type a valid email').required('Email is required'),
  password: Yup.string().min(6).required('Password is required'),
  transport: Yup.string().required('Transportation is required'),

})

export default function Signup({ history }) {
  const emailsAlreadyInUse = [];

  async function handleSubmit(values, {
    setSubmitting,
    setFieldError
  }) {
    try {
      await api.post('/signup', values) 
      setSubmitting(false)
      history.push('/login');
    } catch(err) {
      setFieldError('email', 'email already used');
      emailsAlreadyInUse.push(err.data);
      setSubmitting(false);
    }

  }

  return (
    <Container>
      <FormContainer>
        <div className="logo-container">
          <img src={Logo} alt="ue logo"/>
        </div>
          
        <h2>Welcome back</h2>
        
        <Formik
          initialValues={{
            name: "",
            email: "",
            password: "",
            transport: "",
          }}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
          validade={
            values => {
              let errors = {};
              if (emailsAlreadyInUse.includes[values.email]) {
                errors.email = 'email is already in use'
              }
              return errors;
            }
          }
        >
        {({ handleSubmit, handleChange, values, touched, isSubmitting, errors, handleBlur }) => (
          <form onSubmit={handleSubmit}>
            <Input 
              name="name"
              type="text"   
              placeholder="Full name"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.name}
            />
            {errors.name && touched.name && <ErrorText>{errors.name}</ErrorText>}
            
            <Input 
              name="email"
              type="email"  
              placeholder="Email address"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.email}
            />
            {errors.email && touched.email && <ErrorText>{errors.email}</ErrorText>}
            
            <Input 
              name="password"
              type="password" 
              placeholder="Password"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.password}
            />
            {errors.password && touched.password && <ErrorText>{errors.password}</ErrorText>}

            <Input 
              name="transport"
              type="text" 
              placeholder="Transportation"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.address}
            />
            {errors.transport && touched.transport && <ErrorText>{errors.transport}</ErrorText>}

            <SubmitButton type="submit">
              {isSubmitting ? "Creating account..." : "Submit"}
            </SubmitButton>
          </form>
        )} 
        </Formik>

        <div className="new-user">
          <p>Already an user? <SecondaryLink to="/login">Login</SecondaryLink></p>
        </div>
      </FormContainer>

      <Footer>
      <span>© 2021 by <a target="_blank" rel="noopener noreferrer" href="https://github.com/rodrigofolha">Rodrigo Folha</a></span>
      <span>My sincere thanks to <a target="_blank" rel="noopener noreferrer" href="https://github.com/joaovitorzv">João vitor oliveira</a> for template</span>
      <span>
        <a href="/session">this site was made for study purposes only.</a>
      </span>
    </Footer>
    </Container>
  )
}