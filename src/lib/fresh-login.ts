import Cookies from 'js-cookie';

/** Cookie de curta duração lido no servidor para pular o gate de auth pós-login. */
export const FRESH_LOGIN_COOKIE = 'trillio_fresh_login';

const FRESH_LOGIN_SESSION_KEY = 'trillio:justLoggedIn';
const FRESH_LOGIN_MAX_AGE_SEC = 20;

function getCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  if (domain) return domain;
  if (window.location.hostname.endsWith('trillio.com.br')) return '.trillio.com.br';
  if (window.location.hostname.endsWith('trillio.app')) return '.trillio.app';
  return undefined;
}

/** Marca que o usuário acabou de autenticar (login ou SSO). */
export function markFreshLogin(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(FRESH_LOGIN_SESSION_KEY, '1');
  } catch {
    // ignore
  }
  const domain = getCookieDomain();
  const options: Cookies.CookieAttributes = {
    path: '/',
    sameSite: 'lax',
    secure: window.location.protocol === 'https:',
    expires: new Date(Date.now() + FRESH_LOGIN_MAX_AGE_SEC * 1000),
  };
  if (domain) options.domain = domain;
  try {
    Cookies.set(FRESH_LOGIN_COOKIE, '1', options);
  } catch {
    // ignore
  }
}

function clearFreshLoginCookie(): void {
  if (typeof document === 'undefined') return;
  const domain = getCookieDomain();
  Cookies.remove(FRESH_LOGIN_COOKIE, { path: '/' });
  if (domain) Cookies.remove(FRESH_LOGIN_COOKIE, { path: '/', domain });
  document.cookie = `${FRESH_LOGIN_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  if (domain) {
    document.cookie = `${FRESH_LOGIN_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`;
  }
}

/** Retorna true uma vez se o login acabou de ocorrer; limpa os marcadores. */
export function consumeFreshLoginMark(): boolean {
  if (typeof window === 'undefined') return false;
  let fresh = false;
  try {
    if (sessionStorage.getItem(FRESH_LOGIN_SESSION_KEY)) {
      fresh = true;
      sessionStorage.removeItem(FRESH_LOGIN_SESSION_KEY);
    }
  } catch {
    // ignore
  }
  if (Cookies.get(FRESH_LOGIN_COOKIE)) fresh = true;
  if (fresh) clearFreshLoginCookie();
  return fresh;
}
