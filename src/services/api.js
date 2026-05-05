import axios from 'axios';

const BASE_URL = 'https://whisperbox.koyeb.app/';

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// We can optionally add an interceptor to handle 401s and refresh the token here.

export default api;
