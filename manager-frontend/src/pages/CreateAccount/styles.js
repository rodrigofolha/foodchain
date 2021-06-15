import styled from 'styled-components';


export const Container = styled.div`
  max-width: 1300px;
  margin: 0 auto;

  .home-container {
    background-image: url("https://du9bj9c2s4nh.cloudfront.net/wp-content/uploads/2020/10/Aloette-takeout-food-delivery.jpg");
    min-height: 550px;
    color: white;
    padding: 0 10%;
    display: flex;
    flex-direction: row;
    justify-content: center;
  }
`;

export const ItemContainer = styled.div`
  padding: 13% 3%;
  max-width: 550px;
  h2 {
    font-size: 3em;
  }
`;

export const FormContainer = styled.div`
  background-color: white;
  color: black;
  width: 700px;
  font-weight: bold;
  font-size: .9em;
  padding: 5% 4%;

  h2 {
    padding-bottom: 25px;
  }
`;

export const InputBox = styled.div`
  margin-bottom: 2%;
  color: #c7c7c7;

  label {
    color: rgb(67, 164, 34);
    font-weight: 400;
  }

  .feedback {
    color: red;
  }
`;
