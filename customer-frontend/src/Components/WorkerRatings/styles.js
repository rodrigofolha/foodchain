import styled from 'styled-components';

export const RatingsContainer = styled.div`
  margin: 10px 0 20px 0;

  .worker {
    margin-bottom: 10px;
  }

  .worker-address {
    word-break: break-all;
  }
`;

export const StarButton = styled.button`
  position: relative;
  border: none;
  padding: 10px;
  color: black;

  &:hover {
    background-color: #06C167;
    color: white;
  }
`;
