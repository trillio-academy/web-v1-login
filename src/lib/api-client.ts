/**
 * API Client for API-V1 (shared)
 * Use in client components only. Token/refresh from auth in same package.
 */
'use client';

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const TOKEN_STORAGE_KEY = '__trillio_token__';

function getTokenSecure(): string | null {
  if (typeof document === 'undefined') return null;
  let value = Cookies.get('Authorization') || null;
  if (value) return value;
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      const [cookieName, ...valueParts] = trimmed.split('=');
      if (cookieName === 'Authorization' && valueParts.length > 0) {
        try {
          value = decodeURIComponent(valueParts.join('='));
        } catch {
          value = valueParts.join('=');
        }
        if (value) return value;
      }
    }
  } catch (e) {
    // ignore
  }
  try {
    const storedValue = localStorage.getItem(`${TOKEN_STORAGE_KEY}_Authorization`);
    const expiresStr = localStorage.getItem(`${TOKEN_STORAGE_KEY}_Authorization_expires`);
    if (storedValue && expiresStr && Date.now() < parseInt(expiresStr, 10)) return storedValue;
  } catch (e) {
    // ignore
  }
  return null;
}

function getRefreshTokenSecure(): string | null {
  if (typeof document === 'undefined') return null;
  let value = Cookies.get('refreshToken') || null;
  if (value) return value;
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      const [cookieName, ...valueParts] = trimmed.split('=');
      if (cookieName === 'refreshToken' && valueParts.length > 0) {
        try {
          value = decodeURIComponent(valueParts.join('='));
        } catch {
          value = valueParts.join('=');
        }
        if (value) return value;
      }
    }
  } catch (e) {
    // ignore
  }
  try {
    const storedValue = localStorage.getItem(`${TOKEN_STORAGE_KEY}_refreshToken`);
    const expiresStr = localStorage.getItem(`${TOKEN_STORAGE_KEY}_refreshToken_expires`);
    if (storedValue && expiresStr && Date.now() < parseInt(expiresStr, 10)) return storedValue;
  } catch (e) {
    // ignore
  }
  return null;
}

export function getApiUrlFromEnv(): string {
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __TRILLIO_API_URL__?: string };
    if (w.__TRILLIO_API_URL__ && w.__TRILLIO_API_URL__.trim()) return w.__TRILLIO_API_URL__.trim();
  }
  return process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_V1_URL || 'http://localhost:5001';
}

/** Base URL para o client: se a API foi injetada (produção), chama a API direto; senão usa proxy ou fallback. */
function getClientBaseUrl(): string {
  const injected = typeof window !== 'undefined' && (window as unknown as { __TRILLIO_API_URL__?: string }).__TRILLIO_API_URL__?.trim();
  if (injected) return injected;
  const useProxy = process.env.NEXT_PUBLIC_USE_API_PROXY === 'true';
  return useProxy ? '/api/proxy' : getApiUrlFromEnv();
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    if (typeof window === 'undefined') {
      throw new Error('ApiClient can only be used in client components');
    }
    this.client = axios.create({
      baseURL: getClientBaseUrl(),
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = getTokenSecure();
        const refreshToken = getRefreshTokenSecure();
        if (token) {
          const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
          config.headers.Authorization = `Bearer ${cleanToken}`;
          try {
            const base64Url = cleanToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            const decoded = JSON.parse(jsonPayload);
            const clienteId = decoded.cliente_id ?? decoded.clienteId ?? decoded.cliente;
            if (clienteId) config.headers['X-Cliente-Id'] = String(clienteId);
          } catch (e) {
            // ignore
          }
        }
        if (refreshToken) config.headers.refreshToken = refreshToken;
        return config;
      },
      (err) => Promise.reject(err)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          const { auth } = await import('./auth');
          auth.logout();
          if (typeof window !== 'undefined') {
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            const urlCliente = pathParts[0] || (document.referrer ? new URL(document.referrer).pathname.split('/').filter(Boolean)[0] : null);
            const isLoginPage = window.location.pathname.includes('/login');
            if (!isLoginPage) window.location.href = urlCliente ? `/${urlCliente}/login` : '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  get(url: string, config?: AxiosRequestConfig) {
    return this.client.get(url, config);
  }

  post(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.client.post(url, data, config);
  }

  put(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.client.put(url, data, config);
  }

  delete(url: string, config?: AxiosRequestConfig) {
    return this.client.delete(url, config);
  }

  patch(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.client.patch(url, data, config);
  }
}

let apiClientInstance: ApiClient | null = null;

export const apiClient = new Proxy({} as ApiClient, {
  get(_target, prop) {
    if (typeof window === 'undefined') throw new Error('ApiClient can only be used in client components');
    if (!apiClientInstance) apiClientInstance = new ApiClient();
    return (apiClientInstance as unknown as Record<string, unknown>)[prop as string];
  },
});
