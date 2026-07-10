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

if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', () => {
    tokenWaitDone = false;
  });
}

function isPublicRequestUrl(url: string): boolean {
  return PUBLIC_PATH_PATTERNS.some((p) => {
    const idx = url.indexOf(p);
    if (idx === -1) return false;
    const next = url[idx + p.length];
    return next === undefined || next === '?' || next === '&' || next === '/';
  });
}

/** Só deslogar em 401 quando a resposta indica falha de autenticação (não 404/rota inexistente). */
function shouldLogoutOn401(error: { response?: { status?: number; data?: unknown } }): boolean {
  if (error.response?.status !== 401) return false;
  const data = error.response.data;
  let msg = '';
  if (typeof data === 'string') {
    msg = data;
  } else if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    msg = String(o.message ?? o.error ?? o.msg ?? '');
  }
  const lower = msg.toLowerCase();
  if (
    lower.includes('token') ||
    lower.includes('autenticação') ||
    lower.includes('authentication') ||
    lower.includes('expirado') ||
    lower.includes('não fornecido') ||
    lower.includes('nao fornecido') ||
    lower.includes('unauthorized') ||
    lower.includes('usuário não autenticado') ||
    lower.includes('usuario nao autenticado')
  ) {
    return true;
  }
  // 401 sem corpo (gateway/proxy): tratar como sessão inválida
  if (!msg) return true;
  return false;
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

/** URL pública da API (sem /api/proxy). Usar em operações longas — Amplify limita o proxy a ~30s. */
export function getDirectApiBaseUrl(): string {
  return getApiUrlFromEnv().replace(/\/$/, '');
}

const PRODUCTION_TRILLIO_API_FALLBACK = 'https://api-x.trillio.app';

function isLocalOrMissingApiUrl(url: string): boolean {
  const u = (url || '').trim();
  if (!u || u === '/api/proxy') return true;
  return /localhost|127\.0\.0\.1/i.test(u);
}

/** API direta para operações longas; em *.trillio.app usa fallback se o build não injetou NEXT_PUBLIC_API_URL. */
export function getLongRunningApiBaseUrl(): string {
  const direct = getDirectApiBaseUrl();
  if (!isLocalOrMissingApiUrl(direct)) return direct;
  if (typeof window !== 'undefined' && /\.trillio\.app$/i.test(window.location.hostname)) {
    return PRODUCTION_TRILLIO_API_FALLBACK;
  }
  return direct;
}

/** Timeout máximo (15 min) para requisições síncronas longas (ex.: geração de imagem por IA). */
export const LONG_REQUEST_TIMEOUT_MS = 900_000;

/** Base URL para chamadas à API: usa proxy quando configurado (evita CORS em dev e em produção). */
export function getClientBaseUrl(): string {
  // Se o app pediu uso do proxy, sempre usar same-origin /api/proxy (evita CORS; o servidor Next repassa ao backend).
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === 'true') {
    return '/api/proxy';
  }
  const apiUrl = getApiUrlFromEnv();
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
          await new Promise((r) => setTimeout(r, 450));
          token = getTokenSecure();
        }
        const refreshToken = getRefreshTokenSecure();
        const debug = isAuthDebug();
        if (token) {
          const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
          config.headers.Authorization = `Bearer ${cleanToken}`;
          try {
            const { auth } = await import('./auth');
            auth.syncSessionCookie();
          } catch {
            // ignore
          }
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
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
          const h = config.headers;
          if (h && typeof (h as { delete?: (k: string) => void }).delete === 'function') {
            (h as { delete: (k: string) => void }).delete('Content-Type');
          } else if (h && typeof h === 'object') {
            delete (h as Record<string, unknown>)['Content-Type'];
          }
        }
        return config;
      },
      (err) => Promise.reject(err)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (shouldLogoutOn401(error)) {
          const requestUrl = (error.config?.baseURL ?? '') + (error.config?.url ?? '');
          if (isAuthDebug()) {
            console.warn(LOG_PREFIX, '401 de autenticação — encerrando sessão', { url: requestUrl.slice(-80) });
          }
          if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            const isAuthPublicPage =
              path.includes('/login') ||
              path.includes('/sso') ||
              path.includes('/logout') ||
              path.includes('/auth/');
            const pathParts = path.split('/').filter(Boolean);
            const urlCliente = pathParts[0] || (document.referrer ? new URL(document.referrer).pathname.split('/').filter(Boolean)[0] : null);
            if (!isAuthPublicPage && !isPublicRequestUrl(requestUrl)) {
              const { auth } = await import('./auth');
              auth.logout(urlCliente ?? undefined, { preserveReturnUrl: true });
            }
          }
        } else if (error.response?.status === 401 && isAuthDebug()) {
          const requestUrl = (error.config?.baseURL ?? '') + (error.config?.url ?? '');
          console.warn(LOG_PREFIX, '401 ignorado (não é falha de sessão)', { url: requestUrl.slice(-80), data: error.response?.data });
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
