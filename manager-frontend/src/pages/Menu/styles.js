import styled from 'styled-components';

export const MenuContainer = styled.div`
  max-width: 1300px;
  margin: 2% auto;
  
  .settings-container {

    h4 {
      padding: 0 15px;
    }

    h2 {
      color: rgb(67, 164, 34);

      @media (max-width: 800px) {
        font-size: 20px;
      }
    }
  
    .form-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h2 {
        padding: 0 20px;
      }
    }

    .about-manager  {
      display: flex;
      background-color: white;
      padding: 20px;
      margin: .5% 0 3% 0;

      p {
        margin-left: 10px;
        font-weight: bold;
        color: #5e5e5e;
      }

      strong {
        color: rgb(67, 164, 34);
      }
    }
  }

  .form-container {
    background-color: white;
    padding: 10px;
    display: flex;
    justify-content: space-evenly;
    flex-direction: row;
    flex-wrap: wrap;
    margin-top: 20px;

    @media (max-width: 1219px) {
        padding: 2% 10%;
        flex-direction: column;
      }

    .form-appearence {
      @media (max-width: 1219px) {
        margin-top: 30px;
      }
    }
    
    .input-group {
      justify-content: center;
      display: flex;
      flex-direction: column;

      width: 600px;
      @media (max-width: 1219px) {
        width: unset;
      }

      &:not(:first-child) {
          margin-top: 15px;
      }

      label {
        color: #8f8f8f;
        &:not(first-child) {
          margin-top: 10px;
        }
      }

      input {
        width: 100%;
        border: 2px solid transparent;
        background-color: #faf5f5;
        padding: 15px 20px;
        font-size: .9em;

        &:focus {
          border-bottom: 2px solid black;
        }
      }

      h3 {
        font-weight: bold;
        font-size: 16px;
      }
      
      .file-input-group {
        display: flex;
        flex-direction: row;
        justify-content: space-between;

        label {
          display: flex;
          flex-direction: column;
        }

        input {
          max-width: 295px;
          padding: 10px;
        }

      }

    }

    
  }

  .menu-items {
    padding-top: 20px;
    display: flex;
    flex-wrap: wrap;
  }
`;

export const AlertFill = styled.p`
  padding: 4px 20px;
  background-color: ${props => props.filled ? "#06C167" : "red"};
  color: white;
  @media (max-width: 800px) {
    font-size: 14px;
  }
`;

export const ImgPreview = styled.img`
  max-width: auto;
  max-height: 64px;
  overflow: hidden;
  width: auto;
  height: auto;
  border: 1px solid #dbdbdb;
  margin: 10px 0;
`; 