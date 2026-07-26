import styled from 'styled-components';

export const HeaderContainer = styled.div``;

export const Container = styled.div`
  margin: 0 auto;
  max-width: 1250px;
  width: 100%;
  padding: 80px 20px 60px;

  @media (max-width: 600px) {
    padding: 70px 15px 60px;
  }
`;

export const WalletBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: white;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 14px 20px;
  margin-bottom: 28px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05);

  .wallet-info {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .address {
      font-size: 13px;
      color: #444;
      font-family: monospace;
    }

    .balance { font-size: 12px; color: #999; }
  }

  .rep-info {
    font-size: 13px;
    color: #555;
    display: flex;
    align-items: center;
    gap: 8px;

    span { color: #888; }

    .rep-score {
      font-weight: 700;
      color: #856404;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 50px;
      padding: 3px 10px;
      font-size: 12px;
    }

    .rep-new {
      font-weight: 600;
      color: #155724;
      background: #d4edda;
      border: 1px solid #b2dfce;
      border-radius: 50px;
      padding: 3px 10px;
      font-size: 12px;
    }
  }
`;

export const ConnectButton = styled.button`
  background-color: black;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;

  &:hover { background-color: #222; }
`;

export const SectionHeader = styled.div`
  margin-bottom: 20px;

  h2 { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
  p  { font-size: 14px; color: #888; margin: 0; }
`;

export const OrdersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;

  @media (max-width: 1000px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 620px)  { grid-template-columns: 1fr; }
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;

  .icon { font-size: 48px; margin-bottom: 12px; }

  h3 { font-size: 18px; font-weight: 600; color: #666; margin: 0 0 6px; }
  p  { font-size: 14px; color: #aaa; margin: 0; }
`;
