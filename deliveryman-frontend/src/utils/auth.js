export const Login = (token, deliveryman) => {
  localStorage.setItem('authorization', token);
  localStorage.setItem('deliveryman', JSON.stringify(deliveryman));
}

export const isAuthenticated = () => {
  return true;
  if (localStorage.getItem('authorization')) {
    return true;
  }
  return false
}

// Ends the API session only.
export const SignOut = () => {
  ['authorization', 'deliveryman'].forEach(key => localStorage.removeItem(key));
  window.location.reload();
}