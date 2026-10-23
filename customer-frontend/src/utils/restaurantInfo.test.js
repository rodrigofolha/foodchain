import { loadRestaurantInfo } from './restaurantInfo';

afterEach(() => localStorage.clear());

describe('loadRestaurantInfo', () => {
  const INFO = { id: 12, name: 'Cantina', delivery: 5, public_key: 'pk', spend_public_key: '0x02aa', view_public_key: '0x03bb' };

  it('returns the record as stored', () => {
    localStorage.setItem('restaurantInfo', JSON.stringify(INFO));
    expect(loadRestaurantInfo()).toEqual(INFO);
    expect(JSON.parse(localStorage.getItem('restaurantInfo'))).toEqual(INFO);
  });

  it('removes a stored establishment wallet from the record and from the store', () => {
    const wallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    localStorage.setItem('restaurantInfo', JSON.stringify(Object.assign({ digital_address: wallet }, INFO)));
    expect(loadRestaurantInfo()).toEqual(INFO);
    expect(localStorage.getItem('restaurantInfo')).not.toContain(wallet);
    expect(localStorage.getItem('restaurantInfo')).not.toContain('digital_address');
    expect(JSON.parse(localStorage.getItem('restaurantInfo'))).toEqual(INFO);
  });

  it('removes the field also when it is empty', () => {
    localStorage.setItem('restaurantInfo', JSON.stringify({ id: 1, digital_address: null }));
    expect(loadRestaurantInfo()).toEqual({ id: 1 });
    expect(localStorage.getItem('restaurantInfo')).toBe('{"id":1}');
  });

  it('returns null without a record, and for a record that is not an object', () => {
    expect(loadRestaurantInfo()).toBeNull();
    expect(localStorage.getItem('restaurantInfo')).toBeNull();
    localStorage.setItem('restaurantInfo', 'not json');
    expect(loadRestaurantInfo()).toBeNull();
    localStorage.setItem('restaurantInfo', '[]');
    expect(loadRestaurantInfo()).toBeNull();
    localStorage.setItem('restaurantInfo', '"text"');
    expect(loadRestaurantInfo()).toBeNull();
  });
});
