import styled from 'styled-components';

export const FilterTabs = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  padding: 0 15px;
`;

export const FilterTab = styled.button`
  padding: 8px 20px;
  border-radius: 50px;
  border: none;
  font-weight: bold;
  font-size: 14px;
  cursor: pointer;
  background-color: ${props => props.active ? 'black' : '#f0f0f0'};
  color: ${props => props.active ? 'white' : '#555'};
  transition: background-color 150ms;

  &:hover {
    background-color: ${props => props.active ? 'black' : '#ddd'};
  }
`;

export const TitleSection = styled.div`
  max-width: 1300px;
  margin: 2% auto;
  padding: 0 15px;

  @media (max-width: 600px) {
    margin-top: 10px;
  }
`;

export const OrdersContainer = styled.div`
  max-width: 1300px;
  margin: 0 auto 40px;
  padding: 0 15px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 4px;
`;

