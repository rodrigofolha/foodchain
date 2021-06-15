import React from 'react';
import { FiUser } from 'react-icons/fi';

import { HeaderStyle, LinkBtn } from './styles';
import { WhiteButton } from '../../global-styles';

import { isAuthenticated, signOut } from '../../utils/auth';

import Logo from '../../assets/BlockFood.jpg';

export default function Header() {
  const HandleLogout = () => {
    signOut();
  }

  return (
  <HeaderStyle>
    <a href="/">
      <img src={Logo} height="76" width="214" />
    </a>
    <div> { isAuthenticated() ? <WhiteButton onClick={HandleLogout}>Logout</WhiteButton> :
      <>
      <LinkBtn white={true} href="/session"><FiUser className="icon" size={20}/> Sign in</LinkBtn>
      <LinkBtn href="/">Sign up</LinkBtn>
      </>
    }
    </div>
  </HeaderStyle>
  );
}
