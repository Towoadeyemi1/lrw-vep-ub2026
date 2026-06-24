import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'InvoiceDemo2026';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'X-Demo-Password': PASSWORD },
  timeout: 60000,
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const msg = error.response.data?.detail || error.response.data?.message || 'An error occurred';
      error.displayMessage = msg;
    } else if (error.request) {
      error.displayMessage = 'Cannot reach the server. Is the API running on port 8000?';
    } else {
      error.displayMessage = error.message;
    }
    return Promise.reject(error);
  }
);

export default client;
export { API_BASE, PASSWORD };
