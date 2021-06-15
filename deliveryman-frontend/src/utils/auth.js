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

export const SignOut = () => {
  localStorage.clear();
  window.location.reload();
}