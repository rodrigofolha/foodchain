import styled from 'styled-components';

export const OrdersContainer = styled.div`
display: flex;
flex-direction: column;

border-bottom: 1px solid #e0e0e0;
`;

export const Order = styled.div`
display: flex;
justify-content: space-between;
margin: 15px 0;
`;

export const OrderDetails = styled.div`
display: flex;

.details {
  flex: 2;
  padding: 0 10px;
  
  h2 {
    font-size: 22px;
  }

  p {
    margin: 5px 0 20px 0;
    color: #5e5e5e;
    font-size: 14px;
  }
}


.items {
  display: flex;
}  
.quantity {
  padding: 4px 7px;
  border: 1px solid #c9c9c9;
}

.item-detail {
  line-height: 20px;
  padding: 5px 10px;

  h3 {
    font-weight: 400;
  }

  span {
    color: #06c167;
    margin: 0 10px;
    cursor: pointer;
    font-weight: bold;
  }
}
`;

export const RestaurantThumbnail = styled.div`
flex: 1;
max-width: 330px;
height: 100%;

background: url(${props => `https://api.arthurcarvalho.info/food/files/${props.banner}`}) no-repeat center center;
background-size: cover;
overflow: hidden;

`;

export const OrderAgain = styled.div`
button {
  border: none;
  padding: 15px 100px;
  font-size: 18px;
  font-weight: bold;
  color: white;
  background-color: #06c167;
  cursor: pointer;

  &:hover {
    background-color: #04a759;
    transition-duration: 400ms;
  }
}
`;

export const Button = styled.button`
  position: relative;
  border: none;
  padding: 10px;
  color: black;

  &:hover {
    background-color: ${props => props.warning ? "#db1a3a" : "#06C167"};
    color: white;
  }
`;

export const ButtonsContainer = styled.div`
  display: flex;
  margin-top: 15px;
`