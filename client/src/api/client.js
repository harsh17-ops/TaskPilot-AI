import axios from 'axios';

/**
 * TaskPilot API Axios Instance
 * 
 * - baseURL: Uses VITE_API_URL environment variable if set, otherwise defaults to local Express port 4000.
 * - withCredentials: true ensures HTTP-only JWT cookies are sent along with cross-origin/same-origin requests.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
});

// Attach JWT token from localStorage to every outgoing request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('taskpilot_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
