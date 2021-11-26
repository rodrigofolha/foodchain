import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.arthurcarvalho.info/food/customer'
})

export default api;