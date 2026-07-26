import styled from 'styled-components';

import userImg from '../../assets/user.jpeg';

export const Container = styled.div`
  margin: 0 auto;
  max-width: 1250px;
  padding: 80px 15px 100px;

  @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500&display=swap');
  font-family: 'Hind Siliguri', sans-serif;
`;


export const Customer = styled.div`
  display: flex;
  flex-wrap: wrap;
  border-bottom: 2px solid #f0f0f0;
  margin-bottom: 20px;

  .user-picture {
    width: 80px;
    height: 80px;
    border-radius: 50px;
    background: url(${userImg}) center no-repeat;
    background-size: cover;
    margin-right: 30px;
  }

  .basic-section {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: 5%;

    p {
      margin-top: 3px;
    }
  }

  .customer-info {
    h3 {
      color: #2f2f2f;
      font-size: 17px;
    }
    a {
      color: #5e5e5e;
      font-size: 14px;
    }
  }

  .info-container {
    margin-top: 20px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto;

    div {
      display: flex;
      flex-direction: center;
      align-items: center;
      justify-content: space-between;

      font-size: 18px;
      color: #2f2f2f;
      margin-top: 10px;
      margin-right: 15px;
      cursor: default;

      h4 {
        background-color: #f0f0f0;
        color: #5e5e5e;
        font-weight: 400;
        padding: 10px;
        min-width: 150px;
        max-width: 100%;
        margin-left: 20px;
      }
    }
  }
`;

export const FilterTabs = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
`;

export const FilterTab = styled.button`
  padding: 8px 20px;
  border-radius: 50px;
  border: none;
  font-weight: bold;
  font-size: 14px;
  cursor: pointer;
  background-color: ${props => props.active ? 'black' : '#f0f0f0'};
  color: ${props => props.active ? 'white' : '#555'};
  transition: background-color 150ms;

  &:hover {
    background-color: ${props => props.active ? 'black' : '#ddd'};
  }
`;

export const OrdersContainer = styled.div`
`