export const signIn = (token, restaurant) => {
  localStorage.setItem('authorization', token);
  // Set frequently used info on localstorage
  localStorage.setItem('userLogged', restaurant);
}

// Ends the API session only. The stealth keys, the note secrets of the payment pool
// (kept per deployment, see deploymentStorage.js) and the rating secrets stay in localStorage: clearing them would lose the funds in
// the pool and the control of the open orders.
export const signOut = () => {
  ['authorization', 'userLogged'].forEach(key => localStorage.removeItem(key));
  window.location.reload();
}

export const isAuthenticated = () => {
  if (localStorage.getItem('authorization')) {
    return true;
  }
  return false;
}