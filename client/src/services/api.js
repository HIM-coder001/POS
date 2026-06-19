import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('retailedge_user') || 'null');
  if (user?.token) config.headers.Authorization = `Bearer ${user.token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('retailedge_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
