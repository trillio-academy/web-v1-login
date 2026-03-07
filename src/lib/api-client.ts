/**
 * API Client for API-V1 (shared)
 * Use in client components only. Token/refresh from auth in same package.
 */
'use client';

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { LS_TOKEN_KEY, LS_TOKEN_EXPIRES_KEY, LS_REFRESH_KEY, LS_REFRESH_EXPIRES_KEY } from './auth';

const LOG_PREFIX = '[Trillio Auth]';

/** Rotas que não exigem token (login, dados do cliente na tela de login, recuperar senha, etc.) */
const PUBLIC_PATH_PATTERNS = ['/login', '/site/cliente/show', '/recover', '/cliente/show'];

/** Uma vez por carregamento: ao não ter token em rota protegida, espera um pouco (evita race pós-redirect). */
let tokenWaitDone = false;

function isPublicRequestUrl(url: string): boolean {
  return PUBLIC_PATH_PATTERNS.some((p) => url.includes(p));
}

function isAuthDebug(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    process.env.NEXT_PUBLIC_LOG_TRILLIO_AUTH === 'true' ||
    (window as unknown as { __TRILLIO_AUTH_DEBUG__?: boolean }).__TRILLIO_AUTH_DEBUG__ === true
  );
}

function getTokenSecure(): string | null {
  if (typeof document === 'undefined') return null;
  const debug = isAuthDebug();
  const onLoginPage = typeof window !== 'undefined' && window.location.pathname.includes('/login');

  // 1) Sempre priorizar localStorage (garante uso do token após login e evita 401)
  try {
    const stored = localStorage.getItem(LS_TOKEN_KEY);
    const expiresStr = localStorage.getItem(LS_TOKEN_EXPIRES_KEY);
    if (stored) {
      const exp = expiresStr ? parseInt(expiresStr, 10) : 0;
      if (!exp || Date.now() < exp) {
        if (debug) console.log(LOG_PREFIX, 'getTokenSecure: token from localStorage', { length: stored.length, expOk: !!exp });
        return stored;
      }
      if (debug) console.warn(LOG_PREFIX, 'getTokenSecure: localStorage token expirado', { exp, now: Date.now() });
    } else if (debug && !onLoginPage) console.log(LOG_PREFIX, 'getTokenSecure: localStorage vazio para', LS_TOKEN_KEY);
  } catch (e) {
    if (debug) console.warn(LOG_PREFIX, 'getTokenSecure: localStorage read error', e);
  }

  let value = Cookies.get('Authorization') || null;
  if (value) {
    if (debug) console.log(LOG_PREFIX, 'getTokenSecure: token from cookie', { length: value.length });
    return value;
  }
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
        if (value) {
          if (debug) console.log(LOG_PREFIX, 'getTokenSecure: token from document.cookie');
          return value;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  if (debug && !onLoginPage) console.log(LOG_PREFIX, 'getTokenSecure: nenhum token encontrado');
  return null;
}

function getRefreshTokenSecure(): string | null {
  if (typeof document === 'undefined') return null;

  try {
    const stored = localStorage.getItem(LS_REFRESH_KEY);
    const expiresStr = localStorage.getItem(LS_REFRESH_EXPIRES_KEY);
    if (stored) {
      const exp = expiresStr ? parseInt(expiresStr, 10) : 0;
      if (!exp || Date.now() < exp) return stored;
    }
  } catch (e) {
    // ignore
  }

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
    const storedValue = localStorage.getItem(LS_REFRESH_KEY);
    const expiresStr = localStorage.getItem(LS_REFRESH_EXPIRES_KEY);
    if (storedValue) {
      const expires = expiresStr ? parseInt(expiresStr, 10) : 0;
      if (!expires || Date.now() < expires) return storedValue;
    }
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

/** URL padrão da API em produção quando env não está disponível (ex.: build/cache no Amplify). */
const PRODUCTION_API_URL = 'https://api-x.trillio.app';

/** Base URL para chamadas à API: usa proxy quando configurado (evita CORS em dev e em produção). */
export function getClientBaseUrl(): string {
  // Se o app pediu uso do proxy, sempre usar same-origin /api/proxy (evita CORS; o servidor Next repassa ao backend).
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === 'true') {
    return '/api/proxy';
  }
  let apiUrl = getApiUrlFromEnv();
  // Em host de produção (play/business .trillio.app), se env veio vazia, usar URL padrão
  if (typeof window !== 'undefined' && window.location?.hostname?.includes('trillio.app') && (!apiUrl || apiUrl.includes('localhost'))) {
    apiUrl = PRODUCTION_API_URL;
  }
  if (apiUrl && apiUrl.trim() && !apiUrl.includes('localhost')) {
    return apiUrl.replace(/\/$/, '');
  }
  // Em dev (front em localhost + API em localhost): usar proxy para evitar resposta opaca por CORS
  const useProxy =
    typeof window !== 'undefined' &&
    /^localhost|127\.0\.0\.1$/i.test(window.location?.hostname ?? '') &&
    apiUrl?.includes('localhost');
  return useProxy ? '/api/proxy' : apiUrl || 'http://localhost:5001';
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
      async (config) => {
        let token = getTokenSecure();
        const url = (config.baseURL ?? '') + (config.url ?? '');
        if (!token && !isPublicRequestUrl(url) && !tokenWaitDone) {
          tokenWaitDone = true;
          await new Promise((r) => setTimeout(r, 220));
          token = getTokenSecure();
        }
        const refreshToken = getRefreshTokenSecure();
        const debug = isAuthDebug();
        if (token) {
          const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
          config.headers.Authorization = `Bearer ${cleanToken}`;
          if (debug) {
            const url = (config.baseURL ?? '') + (config.url ?? '');
            console.log(LOG_PREFIX, 'request: Authorization header set', { url: url.slice(-60), tokenLen: cleanToken.length });
          }
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
        } else if (debug) {
          if (!isPublicRequestUrl(url)) console.warn(LOG_PREFIX, 'request: sem token', { url: url.slice(-60) });
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
          const requestUrl = (error.config?.baseURL ?? '') + (error.config?.url ?? '');
          if (isAuthDebug()) {
            console.warn(LOG_PREFIX, '401 recebido (token inválido ou expirado)', { url: requestUrl.slice(-80) });
          }
          // Em qualquer 401 (token inválido/expirado), fazer logout e redirecionar para login
          if (typeof window !== 'undefined') {
            const isLoginPage = window.location.pathname.includes('/login');
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            const urlCliente = pathParts[0] || (document.referrer ? new URL(document.referrer).pathname.split('/').filter(Boolean)[0] : null);
            if (!isLoginPage && !isPublicRequestUrl(requestUrl)) {
              const { auth } = await import('./auth');
              auth.logout(urlCliente ?? undefined);
              window.location.href = urlCliente ? `/${urlCliente}/login` : '/login';
            }
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
