import styled from 'styled-components';
import { Link } from "react-router-dom";
export const HeaderStyle = styled.header`
  background-color: black;
  color: white;
  padding: 1% 10%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 400;
  flex-wrap: wrap;
  gap: 8px;

  @media (max-width: 600px) {
    padding: 8px 12px;
  }

  div {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 4px;
  }
`;

export const LinkBtn = styled(Link)`
  background-color: ${props => props.white ? "black" : "#f8f8f9"};
  color: ${props => props.white ? "white" : "black" };
  padding: 7px 15px;
  text-decoration: none;
  font-size: .9em;
  margin-left: 10px;
  display: flex;
  align-items: center;

  .icon {
    margin-right: 5px;
  }
`;