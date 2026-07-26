import styled from 'styled-components';

export const HeaderContainer = styled.div``;

export const Container = styled.div`
  margin: 0 auto;
  max-width: 1250px;
  width: 100%;
  padding: 80px 15px 80px;

  @media (max-width: 600px) {
    padding-top: 73px;
  }
`;

export const Filter = styled.div`
`;

export const FilterContainer = styled.div`
  padding: 20px 0;
  display: flex;
  flex-direction: row;

`;

export const FilterButton = styled.div `
  display: flex;
  align-items: center;
  justify-content: center;
  
  border: none;
  background-color: ${props => props.isSelected ? 'black' : 'rgb(240, 240, 240)'};
  color: ${props => props.isSelected ? 'white' : 'black'};
  padding: 10px 15px;
  font-weight: bold;
  font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
  font-size: 14px;
  margin-right: 5px;
  border-radius: 50px;
  cursor: pointer;
`;

export const SearchBar = styled.div`
  display: flex;
  align-items: center;
  background-color: #f0f0f0;
  border-radius: 50px;
  padding: 10px 18px;
  margin-bottom: 10px;

  svg {
    color: #666;
    flex-shrink: 0;
    margin-right: 8px;
  }

  input {
    border: none;
    background: transparent;
    outline: none;
    font-size: 15px;
    width: 100%;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
  }
`;

export const RestaurantsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: auto;
  column-gap: 15px;
  row-gap: 35px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;
