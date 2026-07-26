import styled from 'styled-components';

const statusColors = {
  ORDERED:     { bg: '#FFF3CD', color: '#856404' },
  PREPARATION: { bg: '#D1ECF1', color: '#0C5460' },
  WAITING:     { bg: '#E2D9F3', color: '#4A235A' },
  DISPATCHED:  { bg: '#FFE5D0', color: '#7D3C00' },
  CONCLUDED:   { bg: '#D4EDDA', color: '#155724' },
};

export const Order = styled.div`
  margin: 10px;
  width: 300px;
  max-width: 100%;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.07);
  border: 1px solid #ebebeb;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .order-header {
    padding: 14px 16px 12px;
    border-bottom: 1px solid #f3f3f3;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .order-id {
      font-size: 12px;
      color: #999;
      font-weight: 600;
    }
  }

  .order-info {
    padding: 12px 16px;

    h3 {
      span { color: #06C167; }
    }
  }

  .customer-info {
    padding: 12px 16px;
    flex: 1;

    p {
      margin: 5px 0;
      font-size: 13px;
      color: #666;

      span {
        font-weight: 600;
        color: #222;
      }
    }
  }

  .accept-btn {
    padding: 12px 16px;
    border-top: 1px solid #f3f3f3;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    input[type="text"], input[type="number"] {
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 13px;
      width: 60px;
      outline: none;

      &:focus { border-color: #06C167; }
    }

    label {
      font-size: 12px;
      color: #555;
      margin-right: 4px;
    }

    .rep-inputs {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 0 8px;

      .rep-input-row {
        display: flex;
        align-items: center;
        justify-content: space-between;

        label {
          font-size: 12px;
          color: #555;
        }

        input[type="number"] {
          width: 70px;
        }
      }
    }
  }
`;

export const StatusBadge = styled.span`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 50px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  background-color: ${props => (statusColors[props.status] || { bg: '#F8D7DA' }).bg};
  color: ${props => (statusColors[props.status] || { color: '#721C24' }).color};
`;

export const ReputationBadge = styled.div`
  margin: 0 16px 12px;
  padding: 9px 12px;
  background: linear-gradient(135deg, #fffbea, #fff3cd);
  border: 1.5px solid #ffc107;
  border-radius: 8px;
  font-size: 12px;
  color: #856404;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  .rep-icon {
    font-size: 16px;
  }

  .rep-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
  }

  .rep-label {
    font-weight: 400;
    opacity: 0.8;
  }
`;

export const WorkerReputationBadge = styled.div`
  margin: 0 16px 10px;
  padding: 8px 12px;
  background-color: #f0f8f4;
  border: 1px solid #b2dfce;
  border-radius: 8px;
  font-size: 12px;
  color: #155724;
  display: flex;
  align-items: center;
  gap: 6px;

  .rep-icon { font-size: 14px; }
`;

export const Button = styled.button`
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 150ms;
  color: white;
  background-color: ${props =>
    props.warning  ? '#dc3545' :
    props.attention ? '#e6a817' :
    '#06C167'
  };

  &:hover { opacity: 0.85; }
`;
