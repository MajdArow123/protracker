import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export const tokenStorage = {
  getAccess: () => localStorage.getItem('pt_access'),
  setAccess: (t: string) => localStorage.setItem('pt_access', t),
  getRefresh: () => localStorage.getItem('pt_refresh'),
  setRefresh: (t: string) => localStorage.setItem('pt_refresh', t),
  clear: () => { localStorage.removeItem('pt_access'); localStorage.removeItem('pt_refresh'); },
};

// Attach Bearer token to every request
api.interceptors.request.use(config => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function drainQueue(token: string) {
  refreshQueue.forEach(resolve => resolve(token));
  refreshQueue = [];
}

api.interceptors.response.use(
  response => {
    // Unwrap { success: true, data: X } envelope
    if (
      response.data &&
      typeof response.data === 'object' &&
      'success' in response.data &&
      'data' in response.data
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  async error => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise(resolve => {
          refreshQueue.push((token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshToken = tokenStorage.getRefresh();
        const res = await axios.post(
          `${BASE_URL}/api/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        );
        // Response is already the unwrapped data from the envelope
        const data = res.data?.data ?? res.data;
        const newAccess: string = data.accessToken;
        const newRefresh: string = data.refreshToken;

        tokenStorage.setAccess(newAccess);
        tokenStorage.setRefresh(newRefresh);

        drainQueue(newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        tokenStorage.clear();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    const message = error.response?.data?.message || error.message || 'An error occurred';
    // Preserve the HTTP status so callers (e.g. query retry logic) can branch on it —
    // wrapping in a plain Error previously discarded error.response entirely.
    const wrapped = Object.assign(new Error(message), { status: error.response?.status });
    return Promise.reject(wrapped);
  }
);

export default api;
