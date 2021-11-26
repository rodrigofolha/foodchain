import React from 'react';
import { FiUser } from 'react-icons/fi';

import { HeaderStyle, LinkBtn } from './styles';
import { WhiteButton } from '../../global-styles';
import { Link } from 'react-router-dom';
import { isAuthenticated, signOut } from '../../utils/auth';

import Logo from '../../assets/BlockFood.jpg';

export default function Header() {
  const HandleLogout = () => {
    signOut();
  }

  return (
  <HeaderStyle>
    <Link to="/">
      <img src={Logo} height="76" width="214" />
    </Link>
    <div> { isAuthenticated() ? <WhiteButton onClick={HandleLogout}>Logout</WhiteButton> :
      <>
      <LinkBtn white={'true'} to="/session"><FiUser className="icon" size={20}/> Sign in</LinkBtn>
      <LinkBtn to="/">Sign up</LinkBtn>
      </>
    }
    </div>
  </HeaderStyle>
  );
}
