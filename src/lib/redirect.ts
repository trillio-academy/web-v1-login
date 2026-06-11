import Cookies from 'js-cookie';

const REDIRECT_COOKIE = 'redirect';

function isLoginOrLogoutPath(path: string): boolean {
  return /\/(login|logout)(\/|$)/i.test(path);
}

function getTrustedOrigins(): string[] {
  const origins = new Set<string>();
  if (typeof window !== 'undefined') {
    origins.add(window.location.origin);
  }
  [
    process.env.NEXT_PUBLIC_PLAY_APP_URL,
    process.env.NEXT_PUBLIC_BUSINESS_APP_URL,
    process.env.NEXT_PUBLIC_WEB_V1_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_V1_URL,
  ]
    .filter(Boolean)
    .forEach((url) => {
      try {
        origins.add(new URL(url as string).origin);
      } catch {
        // ignore
      }
    });
  return [...origins];
}

/** Valida redirect contra open redirect; retorna path+search (relativo) ou URL absoluta confiável. */
export function getSafeRedirectUrl(redirect: string | null | undefined): string | null {
  if (!redirect || typeof window === 'undefined') {
    return null;
  }

  try {
    let decoded = redirect;
    try {
      decoded = decodeURIComponent(redirect);
    } catch {
      // usa valor original
    }

    if (/[\r\n]/.test(decoded)) {
      return null;
    }

    const parsed = new URL(decoded, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    if (!getTrustedOrigins().includes(parsed.origin)) {
      return null;
    }

    const pathWithSearch = parsed.pathname + parsed.search;
    if (isLoginOrLogoutPath(pathWithSearch)) {
      return null;
    }

    return pathWithSearch;
  } catch {
    return null;
  }
}

/** Monta URL de login preservando a rota atual para retorno pós-autenticação. */
export function buildLoginUrl(tenantUrl: string, returnPath?: string): string {
  const base = `/${tenantUrl}/login`;
  let path = returnPath;
  if (path === undefined && typeof window !== 'undefined') {
    path = window.location.pathname + window.location.search;
  }
  if (!path || isLoginOrLogoutPath(path.split('?')[0])) {
    return base;
  }
  return `${base}?redirect=${encodeURIComponent(path)}`;
}

export function readStoredRedirect(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const fromQuery = new URLSearchParams(window.location.search).get('redirect');
  const safeFromQuery = getSafeRedirectUrl(fromQuery);
  if (safeFromQuery) {
    return safeFromQuery;
  }
  const fromCookie = Cookies.get(REDIRECT_COOKIE);
  return getSafeRedirectUrl(fromCookie);
}

export function clearRedirectCookie(): void {
  Cookies.remove(REDIRECT_COOKIE, { path: '/' });
}

/** Resolve destino pós-login: redirect armazenado ou fallback padrão. */
export function resolvePostLoginRedirect(defaultPath: string): string {
  const stored = readStoredRedirect();
  if (stored) {
    clearRedirectCookie();
    return stored;
  }
  return defaultPath;
}
