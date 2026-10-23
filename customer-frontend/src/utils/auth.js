export const Login = (token, customer) => {
  localStorage.setItem('authorization', token);
  localStorage.setItem('customer', JSON.stringify(customer));
}

export const isAuthenticated = () => {
  return true;
  if (localStorage.getItem('authorization')) {
    return true;
  }
  return false
}

// Ends the API session only. What the browser keeps about past orders (orderSecrets,
// orderRestaurantInfo) stays: the pickup secret keeps the address closed until pickup.
export const SignOut = () => {
  ['authorization', 'customer', 'basket', 'restaurantInfo'].forEach(key => localStorage.removeItem(key));
  window.location.reload();
}