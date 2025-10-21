import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(
  config => {
    console.log('[API] Request:', config.method?.toUpperCase(), config.url, config.params);
    return config;
  },
  error => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for auth errors and debugging
api.interceptors.response.use(
  response => {
    console.log('[API] Response:', response.config.url, 'Status:', response.status);
    return response;
  },
  error => {
    console.error('[API] Response error:', error.config?.url, error.response?.status, error.message);
    if (error.response?.status === 401) {
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        console.log('[API] Redirecting to login due to 401');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

