/**
 * Authentication utilities for Trillio Web (shared)
 * Uses cookies as primary storage, localStorage as backup
 * Cookie domain .trillio.com.br in production for shared session across subdomains
 */
import Cookies from 'js-cookie';
import type { LoginCredentials, User } from '../types';

const TOKEN_KEY = 'Authorization';
const REFRESH_TOKEN_KEY = 'refreshToken';
const TOKEN_STORAGE_KEY = '__trillio_token__';
const REFRESH_TOKEN_STORAGE_KEY = '__trillio_refresh_token__';

const LOG_PREFIX = '[Trillio Auth]';

function isAuthDebug(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    process.env.NEXT_PUBLIC_LOG_TRILLIO_AUTH === 'true' ||
    (window as unknown as { __TRILLIO_AUTH_DEBUG__?: boolean }).__TRILLIO_AUTH_DEBUG__ === true
  );
}

/** Chaves exatas do localStorage (usadas em login e api-client). Export para consistência. */
export const LS_TOKEN_KEY = `${TOKEN_STORAGE_KEY}_${TOKEN_KEY}`;
export const LS_TOKEN_EXPIRES_KEY = `${TOKEN_STORAGE_KEY}_${TOKEN_KEY}_expires`;
export const LS_REFRESH_KEY = `${TOKEN_STORAGE_KEY}_${REFRESH_TOKEN_KEY}`;
export const LS_REFRESH_EXPIRES_KEY = `${TOKEN_STORAGE_KEY}_${REFRESH_TOKEN_KEY}_expires`;

function getCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  if (domain) return domain;
  if (window.location.hostname.endsWith('trillio.com.br')) return '.trillio.com.br';
  if (window.location.hostname.endsWith('trillio.app')) return '.trillio.app';
  // Em localhost NÃO definir domain: navegadores não persistem cookie com domain=localhost.
  // Sem domain o cookie fica vinculado ao host exato (ex.: localhost:8081) e é enviado nas requisições.
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return undefined;
  return undefined;
}

function setCookieSecure(name: string, value: string, days: number): boolean {
  if (typeof document === 'undefined') return false;

  const domain = getCookieDomain();
  const options: Cookies.CookieAttributes = {
    expires: days,
    path: '/',
    sameSite: 'lax',
    secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
  };
  if (domain) options.domain = domain;

  let success = false;

  try {
    Cookies.remove(name, { path: '/', ...(domain && { domain }) });
    Cookies.set(name, value, options);
    success = true;
  } catch (e) {
    console.warn(`setCookieSecure - js-cookie failed for ${name}:`, e);
  }

  try {
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + days);
    const expires = expiresDate.toUTCString();
    let cookieString = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    if (domain) cookieString += `; domain=${domain}`;
    document.cookie = cookieString;
    success = true;
  } catch (e) {
    console.warn(`setCookieSecure - document.cookie failed for ${name}:`, e);
  }

  try {
    localStorage.setItem(`${TOKEN_STORAGE_KEY}_${name}`, value);
    localStorage.setItem(`${TOKEN_STORAGE_KEY}_${name}_expires`, String(Date.now() + (days * 24 * 60 * 60 * 1000)));
  } catch (e) {
    console.warn(`setCookieSecure - localStorage backup failed for ${name}:`, e);
  }

  return success;
}

function getCookieSecure(name: string): string | null {
  if (typeof document === 'undefined') return null;

  let value = Cookies.get(name) || null;
  if (value) return value;

  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      const [cookieName, ...valueParts] = trimmed.split('=');
      if (cookieName === name && valueParts.length > 0) {
        const cookieValue = valueParts.join('=');
        try {
          value = decodeURIComponent(cookieValue);
        } catch {
          value = cookieValue;
        }
        if (value) return value;
      }
    }
  } catch (e) {
    console.warn(`getCookieSecure - document.cookie read failed for ${name}:`, e);
  }

  try {
    const storedValue = localStorage.getItem(`${TOKEN_STORAGE_KEY}_${name}`);
    const expiresStr = localStorage.getItem(`${TOKEN_STORAGE_KEY}_${name}_expires`);
    if (storedValue && expiresStr) {
      const expires = parseInt(expiresStr, 10);
      if (Date.now() < expires) {
        setCookieSecure(name, storedValue, Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000)));
        return storedValue;
      } else {
        localStorage.removeItem(`${TOKEN_STORAGE_KEY}_${name}`);
        localStorage.removeItem(`${TOKEN_STORAGE_KEY}_${name}_expires`);
      }
    }
  } catch (e) {
    console.warn(`getCookieSecure - localStorage backup read failed for ${name}:`, e);
  }

  return null;
}

function removeCookieSecure(name: string): void {
  if (typeof document === 'undefined') return;

  const domain = getCookieDomain();
  Cookies.remove(name, { path: '/' });
  if (domain) Cookies.remove(name, { path: '/', domain });
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  if (domain) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`;

  try {
    localStorage.removeItem(`${TOKEN_STORAGE_KEY}_${name}`);
    localStorage.removeItem(`${TOKEN_STORAGE_KEY}_${name}_expires`);
  } catch (e) {
    // ignore
  }
}

export const auth = {
  async login(url: string, credentials: LoginCredentials): Promise<{ token: string; refreshToken?: string }> {
    const debug = isAuthDebug();
    const { apiClient } = await import('./api-client');
    const loginEndpoint = `/app/cliente/${url}/login`;
    if (debug) console.log(LOG_PREFIX, 'login: POST', loginEndpoint);
    const response = await apiClient.post(loginEndpoint, credentials);
    console.log(LOG_PREFIX, 'login resposta da requisição', { status: response.status, data: response.data });
    const raw = response.data ?? {};
    const data = raw.data ?? raw;
    const token =
      (typeof data.token === 'string' && data.token) ||
      (typeof data.access_token === 'string' && data.access_token) ||
      (typeof raw.token === 'string' && raw.token) ||
      (typeof raw.access_token === 'string' && raw.access_token) ||
      null;
    const refreshToken =
      (typeof data.refreshToken === 'string' && data.refreshToken) ||
      (typeof data.refresh_token === 'string' && data.refresh_token) ||
      (typeof raw.refreshToken === 'string' && raw.refreshToken) ||
      (typeof raw.refresh_token === 'string' && raw.refresh_token) ||
      undefined;

    if (debug) console.log(LOG_PREFIX, 'login: response', { hasToken: !!token, hasRefresh: !!refreshToken, responseKeys: Object.keys(raw) });

    if (!token) throw new Error('Token não foi retornado pelo servidor');

    const exp = Date.now() + 3 * 24 * 60 * 60 * 1000;
    const refExp = Date.now() + 6 * 24 * 60 * 60 * 1000;

    // 1) Salvar no localStorage (fonte principal para o api-client evitar 401)
    const writeStorage = () => {
      localStorage.setItem(LS_TOKEN_KEY, token);
      localStorage.setItem(LS_TOKEN_EXPIRES_KEY, String(exp));
      if (refreshToken) {
        localStorage.setItem(LS_REFRESH_KEY, refreshToken);
        localStorage.setItem(LS_REFRESH_EXPIRES_KEY, String(refExp));
      }
    };
    try {
      writeStorage();
      let readBack = localStorage.getItem(LS_TOKEN_KEY);
      if (readBack !== token) {
        writeStorage();
        readBack = localStorage.getItem(LS_TOKEN_KEY);
      }
      if (readBack !== token) {
        console.error(LOG_PREFIX, 'login: token não persistiu no localStorage', { key: LS_TOKEN_KEY, len: token.length });
        throw new Error('Falha ao salvar sessão. O token não foi gravado no navegador.');
      }
      if (debug) console.log(LOG_PREFIX, 'login: localStorage escrito e verificado', { key: LS_TOKEN_KEY, tokenLen: token.length });
    } catch (e) {
      console.warn(LOG_PREFIX, 'login: localStorage write failed', e);
      throw new Error('Falha ao salvar sessão no navegador. Verifique se o localStorage está disponível.');
    }

    setCookieSecure(TOKEN_KEY, token, 3);
    if (refreshToken) setCookieSecure(REFRESH_TOKEN_KEY, refreshToken, 6);
    if (debug) console.log(LOG_PREFIX, 'login: sucesso, cookie setado');

    return { token, refreshToken };
  },

  logout(url?: string): void {
    if (isAuthDebug()) console.log(LOG_PREFIX, 'logout: limpando sessão');
    removeCookieSecure(TOKEN_KEY);
    removeCookieSecure(REFRESH_TOKEN_KEY);
    try {
      localStorage.removeItem(LS_TOKEN_KEY);
      localStorage.removeItem(LS_TOKEN_EXPIRES_KEY);
      localStorage.removeItem(LS_REFRESH_KEY);
      localStorage.removeItem(LS_REFRESH_EXPIRES_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    } catch (e) {
      // ignore
    }
    if (typeof window !== 'undefined') {
      let finalUrl = url;
      if (!finalUrl) {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        finalUrl = pathParts[0] || undefined;
        if (!finalUrl && document.referrer) {
          try {
            const referrerUrl = new URL(document.referrer);
            finalUrl = referrerUrl.pathname.split('/').filter(Boolean)[0] || undefined;
          } catch (e) {
            // ignore
          }
        }
      }
      const redirectUrl = finalUrl ? `/${finalUrl}/login` : '/login';
      window.location.href = redirectUrl;
    }
  },

  /** Mesma fonte que o api-client: localStorage primeiro, depois cookie. Evita hadAuth: false quando o token está só no localStorage. */
  getToken(): string | undefined {
    if (typeof document === 'undefined') return undefined;
    try {
      const stored = localStorage.getItem(LS_TOKEN_KEY);
      const expiresStr = localStorage.getItem(LS_TOKEN_EXPIRES_KEY);
      if (stored) {
        const exp = expiresStr ? parseInt(expiresStr, 10) : 0;
        if (!exp || Date.now() < exp) return stored;
      }
    } catch {
      // ignore
    }
    const token = getCookieSecure(TOKEN_KEY);
    return token || undefined;
  },

  getRefreshToken(): string | undefined {
    if (typeof document === 'undefined') return undefined;
    try {
      const stored = localStorage.getItem(LS_REFRESH_KEY);
      const expiresStr = localStorage.getItem(LS_REFRESH_EXPIRES_KEY);
      if (stored) {
        const exp = expiresStr ? parseInt(expiresStr, 10) : 0;
        if (!exp || Date.now() < exp) return stored;
      }
    } catch {
      // ignore
    }
    const token = getCookieSecure(REFRESH_TOKEN_KEY);
    return token || undefined;
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  getClienteId(): number | null {
    const user = this.getCurrentUser();
    return user?.cliente_id ?? null;
  },

  /** Retorna true se o token não existe ou está expirado (exp no passado). */
  isTokenExpired(token?: string): boolean {
    const jwt = token || this.getToken();
    if (!jwt) return true;
    try {
      const base64Url = jwt.split('.')[1];
      if (!base64Url) return true;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const decoded = JSON.parse(jsonPayload) as { exp?: number };
      const exp = decoded.exp;
      if (exp == null) return false; // sem exp, considera válido
      const nowSec = Math.floor(Date.now() / 1000);
      return exp < nowSec; // expirado se exp já passou
    } catch {
      return true;
    }
  },

  decodeToken(token?: string): User | null {
    try {
      const jwt = token || this.getToken();
      if (!jwt) return null;

      const base64Url = jwt.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const decoded = JSON.parse(jsonPayload);

      return {
        id: parseInt(decoded.id || decoded.username || '0', 10),
        email: decoded.email,
        roles: Array.isArray(decoded.roles) ? decoded.roles : [],
        cliente_id: decoded.cliente_id ?? decoded.clienteId ?? decoded.cliente ?? undefined,
      };
    } catch (error) {
      console.error('auth.decodeToken error:', error);
      return null;
    }
  },

  getCurrentUser(): User | null {
    return this.decodeToken();
  },

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return !!(user?.roles?.includes(role));
  },

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    const roles = user.roles || [];
    return roles.includes('ROLE_ADMIN_CLIENTE') || roles.includes('ROLE_ADMIN');
  },

  async refreshToken(): Promise<boolean> {
    const refreshTokenValue = this.getRefreshToken();
    if (!refreshTokenValue) return false;

    try {
      const { apiClient } = await import('./api-client');
      const response = await apiClient.post(
        '/app/refresh/token',
        { refreshToken: refreshTokenValue },
        { headers: { refreshToken: refreshTokenValue } }
      );
      const { token, refreshToken: newRefreshToken } = response.data;
      if (token) setCookieSecure(TOKEN_KEY, token, 3);
      if (newRefreshToken) setCookieSecure(REFRESH_TOKEN_KEY, newRefreshToken, 6);
      return true;
    } catch (error: unknown) {
      console.error('auth.refreshToken error:', error);
      removeCookieSecure(TOKEN_KEY);
      removeCookieSecure(REFRESH_TOKEN_KEY);
      return false;
    }
  },
};
