import styled from 'styled-components';
import { Link } from 'react-router-dom';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  border: 1px solid #ebebeb;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  overflow: hidden;
  opacity: ${props => props.disqualified ? 0.6 : 1};
`;

export const Thumbnail = styled.div`
  width: 100%;
  height: 160px;
  overflow: hidden;
  background-color: #f0f0f0;
  flex-shrink: 0;
`;

export const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const CardBody = styled.div`
  padding: 14px 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .restaurant-name {
    font-size: 16px;
    font-weight: 700;
    color: #111;
    margin: 0 0 4px;
  }

  .info-row {
    font-size: 12px;
    color: #777;
    margin: 0;
    line-height: 1.6;
  }

  .price-row {
    font-size: 13px;
    color: #333;
    font-weight: 600;
    margin-top: 4px;
  }
`;

export const ReqBadge = styled.div`
  margin: 8px 16px 0;
  padding: 8px 12px;
  background: linear-gradient(135deg, #fffbea, #fff3cd);
  border: 1.5px solid #ffc107;
  border-radius: 8px;
  font-size: 12px;
  color: #856404;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-weight: 600;
`;

export const DisqualifiedBanner = styled.div`
  margin: 8px 16px 0;
  padding: 8px 12px;
  background: #fff0f0;
  border: 1px solid #f5c2c7;
  border-radius: 8px;
  font-size: 12px;
  color: #842029;
`;

export const CardFooter = styled.div`
  padding: 12px 16px;
  border-top: 1px solid #f3f3f3;
`;

export const Button = styled.button`
  width: 100%;
  border: none;
  border-radius: 8px;
  padding: 11px 0;
  font-weight: 700;
  font-size: 14px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  background-color: ${props => props.disabled ? '#ccc' : '#06C167'};
  color: white;
  transition: opacity 150ms;

  &:hover { opacity: ${props => props.disabled ? 1 : 0.85}; }
`;

export const LinkToRestaurant = styled(Link)`
  text-decoration: none;
`;
