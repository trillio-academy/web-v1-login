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

function getCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  if (domain) return domain;
  if (window.location.hostname.endsWith('trillio.com.br')) return '.trillio.com.br';
  // Em localhost, usar domain 'localhost' para o cookie ser compartilhado entre portas (ex.: play 8081 e business 8082)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'localhost';
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
    const { apiClient } = await import('./api-client');
    const loginEndpoint = `/app/cliente/${url}/login`;
    const response = await apiClient.post(loginEndpoint, credentials);
    const { token, refreshToken } = response.data;

    if (!token) throw new Error('Token não foi retornado pelo servidor');

    const tokenSaved = setCookieSecure(TOKEN_KEY, token, 3);
    if (refreshToken) setCookieSecure(REFRESH_TOKEN_KEY, refreshToken, 6);

    if (!tokenSaved) throw new Error('Falha ao salvar token de autenticação');

    return { token, refreshToken };
  },

  logout(url?: string): void {
    removeCookieSecure(TOKEN_KEY);
    removeCookieSecure(REFRESH_TOKEN_KEY);
    try {
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

  getToken(): string | undefined {
    const token = getCookieSecure(TOKEN_KEY);
    return token || undefined;
  },

  getRefreshToken(): string | undefined {
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
