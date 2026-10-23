import styled from 'styled-components';

export const ScannerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 15px;
  max-width: 360px;

  .viewfinder {
    width: 100%;
    min-height: 120px;
    background-color: #f0f0f0;
  }

  .viewfinder video {
    width: 100%;
  }

  p {
    margin: 10px 0;
    color: #5e5e5e;
    font-size: 14px;
  }

  p.error {
    color: #db1a3a;
  }
`;

export const CloseButton = styled.button`
  border: none;
  padding: 10px;
  color: black;

  &:hover {
    background-color: #db1a3a;
    color: white;
  }
`;
