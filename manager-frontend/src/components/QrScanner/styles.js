import styled from 'styled-components';

export const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;

  .qr-reader {
    display: none;
  }

  &.open .qr-reader {
    display: block;
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    background-color: #111;

    video {
      display: block;
      width: 100% !important;
    }
  }

  .qr-message {
    margin: 0;
    font-size: 12px;
    color: #dc3545;
  }
`;

export const ScanButton = styled.button`
  border: ${props => (props.secondary ? '1px solid #ddd' : 'none')};
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 150ms;
  color: ${props => (props.secondary ? '#333' : 'white')};
  background-color: ${props => (props.secondary ? 'white' : '#222')};

  &:hover { opacity: 0.85; }
`;
