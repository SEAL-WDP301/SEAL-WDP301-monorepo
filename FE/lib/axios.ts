import axios, { AxiosHeaders, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './stores/auth.store';

const baseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;

export const axiosClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Variables for refresh token queue
let isRefreshing = false;
let failedQueue: { resolve: (value?: unknown) => void; reject: (reason?: unknown) => void; }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosClient.interceptors.request.use(
  (config) => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        config.headers = AxiosHeaders.from(config.headers);
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Extended type to track retries
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Don't intercept refresh calls to avoid infinite loops
      if (originalRequest.url?.includes('/auth/refresh')) {
        useAuthStore.getState().clearAccessToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-unauthorized'));
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If refreshing is already in progress, put subsequent requests into a queue
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = AxiosHeaders.from(originalRequest.headers);
            originalRequest.headers.set('Authorization', `Bearer ${token}`);
            return axiosClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const currentRefreshToken = useAuthStore.getState().refreshToken;
        if (!currentRefreshToken) {
          throw new Error('No refresh token available');
        }

        const res = await axiosClient.post('/auth/refresh', { refreshToken: currentRefreshToken });
        const newAccessToken = res.data?.data?.accessToken;
        const newRefreshToken = res.data?.data?.refreshToken;

        if (newAccessToken) {
          useAuthStore.getState().setAccessToken(newAccessToken);
          if (newRefreshToken) {
            useAuthStore.getState().setRefreshToken(newRefreshToken);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('token-refreshed'));
          }
          
          originalRequest.headers = AxiosHeaders.from(originalRequest.headers);
          originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
          
          processQueue(null, newAccessToken);
          
          // Retry the original request
          return axiosClient(originalRequest);
        } else {
          throw new Error('Refresh token response missing access token');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // If refresh fails, log the user out
        useAuthStore.getState().clearAccessToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-unauthorized'));
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
