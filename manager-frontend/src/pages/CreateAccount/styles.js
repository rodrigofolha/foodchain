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
    @media(max-width: 800px){
      padding: 0 20px;
      flex-direction: column;
    }
  }
`;

export const ItemContainer = styled.div`
  padding: 13% 3%;
  max-width: 550px;
  h2 {
    font-size: 3em;
    @media(max-width: 800px){
      font-size: 2em;
    }
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

  @media(max-width: 800px){
    width: unset;
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
