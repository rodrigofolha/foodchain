import React from 'react';
import { BrowserRouter, Switch } from 'react-router-dom';

import PublicRoute from './Components/PublicRoute';
import PrivateRoute from './Components/PrivateRoute';

import Home from  './Pages/Home';
import Signup from './Pages/Signup';
import Login from './Pages/Login';
import User from './Pages/User';


export default function Routes() {
  return (
    <BrowserRouter>
      <Switch>
        <PublicRoute restricted={false} path="/" exact component={Home} />
        {/* <PublicRoute restricted={true} path="/signup" component={Signup} />
        <PublicRoute restricted={true}  path="/login" component={Login} /> */}

        <PublicRoute path="/user" component={User} />
      </Switch>
    </BrowserRouter>
  )
}