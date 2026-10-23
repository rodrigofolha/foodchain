import styled from 'styled-components';

export const CashoutBox = styled.div`
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #c9d3ee;

  h4 {
    padding: 0;
    margin-bottom: 8px;
  }

  p {
    font-size: 14px;
    margin-bottom: 8px;
  }
`;

export const Hint = styled.p`
  color: #555;
`;

export const CashoutBtn = styled.button`
  padding: 8px 20px;
  cursor: pointer;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;

  &:disabled {
    background: #a5a5a5;
    cursor: default;
  }
`;

export const PlainBtn = styled.button`
  margin-left: 10px;
  padding: 8px 12px;
  cursor: pointer;
  background: none;
  color: #555;
  border: 1px solid #ccc;
  border-radius: 4px;

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`;

export const StepList = styled.ul`
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  font-size: 14px;

  li {
    padding: 3px 0;
  }
`;

export const StepState = styled.span`
  color: ${props => (props.status === 'failed' ? '#c62828' : props.status === 'done' ? '#2e7d32' : '#555')};
`;

export const Warning = styled.div`
  margin-top: 12px;
  padding: 12px;
  background: #fff4e5;
  border: 1px solid #f0b46a;
  border-radius: 4px;

  p {
    color: #6b3d00;
  }
`;

export const DangerBtn = styled.button`
  padding: 8px 12px;
  cursor: pointer;
  background: #c62828;
  color: white;
  border: none;
  border-radius: 4px;
`;

export const ErrorLine = styled.p`
  margin-top: 10px;
  color: #c62828;
`;

export const PendingLine = styled.p`
  margin-top: 10px;
  padding: 8px 10px;
  background: #fff8e1;
  border: 1px solid #f0d58a;
  border-radius: 4px;
  color: #6b5200;
`;
