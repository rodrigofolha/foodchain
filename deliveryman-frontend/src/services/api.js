import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.arthurcarvalho.info/food/deliveryman'
})

export default api;