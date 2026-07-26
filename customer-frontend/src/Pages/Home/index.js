import React, { useEffect, useState } from 'react';

import Header from '../../Components/Header';
import RestaurantItem from '../../Components/RestaurantItem';
import Basket from '../../Components/Basket';

import BasketProvider from '../../Context/BasketContext';

import {
  HeaderContainer,
  Container,
  RestaurantsGrid,
  SearchBar,
} from './styles';

import { SubTitleItem, Title, SmallText} from '../../GlobalStyles';

import { FaSearch } from 'react-icons/fa';

import api from '../../services/api';

export default function Home({ history }) {
  const [restaurants, setRestaurants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchData() {
      const response = await api.get('/restaurants');
      setRestaurants(response.data);
    }

    fetchData();
  }, []);

  const query = searchQuery.toLowerCase().trim();
  const filteredRestaurants = query
    ? restaurants.filter(r =>
        r.restaurant_name.toLowerCase().includes(query) ||
        (r.culinary && r.culinary.toLowerCase().includes(query))
      )
    : null;

  return (
    <BasketProvider>
      <HeaderContainer>
        <Header />
        <Basket history={history} />
      </HeaderContainer>

      <Container>
        <SearchBar>
          <FaSearch size={16} />
          <input
            type="text"
            placeholder="Search restaurants or cuisines..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </SearchBar>

        {filteredRestaurants ? (
          <>
            <SubTitleItem>
              <Title size="28px">Results for "{searchQuery}"</Title>
              <SmallText>{filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''} found</SmallText>
            </SubTitleItem>
            <RestaurantsGrid>
              {filteredRestaurants.map(restaurant => (
                <RestaurantItem restaurant={restaurant} key={restaurant.id} />
              ))}
            </RestaurantsGrid>
          </>
        ) : (
          <>
            <SubTitleItem>
              <Title size="28px">Free deliveries</Title>
              <SmallText>Your favorites food without delivery fee</SmallText>
            </SubTitleItem>
            <RestaurantsGrid>
              {restaurants.filter(restaurant => restaurant.delivery_price == 0).map(restaurant => (
                <RestaurantItem restaurant={restaurant} key={restaurant.id} />
              ))}
            </RestaurantsGrid>

            <SubTitleItem>
              <Title size="28px">When You're Hungry Now</Title>
              <SmallText>The fastest food to your door</SmallText>
            </SubTitleItem>
            <RestaurantsGrid>
              {restaurants.filter(restaurant => restaurant.delivery_price > 0).map(restaurant => (
                <RestaurantItem restaurant={restaurant} key={restaurant.id} />
              ))}
            </RestaurantsGrid>
          </>
        )}
      </Container>
    </BasketProvider>
  )
}