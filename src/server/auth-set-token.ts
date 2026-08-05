import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { FRESH_LOGIN_COOKIE } from '../lib/fresh-login';

function isValidJWTFormat(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

function getAllowedOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API_V1_URL,
    process.env.NEXT_PUBLIC_WEB_V1_URL,
    process.env.NEXT_PUBLIC_CLIENT_URL,
    process.env.NEXT_PUBLIC_TRILLIO_URL,
    process.env.NEXT_PUBLIC_PLAY_APP_URL,
    process.env.NEXT_PUBLIC_BUSINESS_APP_URL,
    process.env.NEXT_PUBLIC_BACKOFFICE_APP_URL,
    process.env.APP_TRILLIO_PLAY_URL,
    process.env.APP_TRILLIO_BUSINESS_URL,
    process.env.APP_TRILLIO_BACKOFFICE_URL,
    'https://backoffice.trillio.app',
    'http://localhost:3001',
    'http://localhost:5000',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082',
  ].filter((url): url is string => Boolean(url));
}

function isTrillioHostname(hostname: string): boolean {
  return (
    hostname === 'trillio.app' ||
    hostname.endsWith('.trillio.app') ||
    hostname === 'trillio.com.br' ||
    hostname.endsWith('.trillio.com.br')
  );
}

function isAllowedOrigin(origin: string): boolean {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (isDevelopment && origin.includes('localhost')) return true;
  if (getAllowedOrigins().some((allowed) => origin.startsWith(allowed))) return true;
  try {
    return isTrillioHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function buildCorsHeaders(origin: string): Headers {
  const headers = new Headers();
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (isAllowedOrigin(origin) && origin) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (isDevelopment) {
    headers.set('Access-Control-Allow-Origin', origin || '*');
  }
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

function sanitizeRedirectUrl(redirectUrl: string | null, request: NextRequest): string | null {
  if (!redirectUrl) return null;
  let target = redirectUrl.trim();
  if (!target) return null;

  if (/^https?:\/[^/]/i.test(target)) {
    target = target.startsWith('https:/') ? `https://${target.slice(7)}` : `http://${target.slice(6)}`;
  }

  if (target.startsWith('/https:/') || target.startsWith('/http:/')) {
    return null;
  }

  if (/\/(login|logout|sso)(\/|$)/i.test(target)) {
    return null;
  }

  if (target.startsWith('http://') || target.startsWith('https://')) {
    try {
      const urlObj = new URL(target);
      const currentHost = (request.headers.get('host') || '').split(':')[0];
      const allowedHostnames = [currentHost, 'localhost', 'trillio.app', 'trillio.com.br'];
      const ok = allowedHostnames.some(
        (host) => urlObj.hostname === host || urlObj.hostname.endsWith(`.${host}`)
      );
      if (!ok) return null;
      target = urlObj.pathname + urlObj.search;
    } catch {
      return null;
    }
  }

  if (!target.startsWith('/')) return null;
  if (/\.\.|javascript:|data:|vbscript:/i.test(target)) return null;
  return target.replace(/\?inlineAuth=[^&]*&?/g, '').replace(/&inlineAuth=[^&]*/g, '').replace(/\?$/, '');
}

async function parseRequestBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    try {
      return (await request.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    try {
      const formData = await request.formData();
      return {
        token: formData.get('token'),
        refreshToken: formData.get('refreshToken'),
        redirectUrl: formData.get('redirectUrl'),
      };
    } catch {
      // fallback abaixo
    }
  }

  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const params = new URLSearchParams(text);
    return {
      token: params.get('token'),
      refreshToken: params.get('refreshToken'),
      redirectUrl: params.get('redirectUrl'),
    };
  } catch {
    return {};
  }
}

export async function handleAuthSetTokenOptions(request: NextRequest) {
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  return new NextResponse(null, { status: 204, headers: buildCorsHeaders(origin) });
}

export async function handleAuthSetTokenPost(request: NextRequest) {
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  const headers = buildCorsHeaders(origin);

  if (!isAllowedOrigin(origin) && origin) {
    return NextResponse.json({ error: 'Origem não permitida' }, { status: 403, headers });
  }

  const body = await parseRequestBody(request);

  const token = String(body.token || request.nextUrl.searchParams.get('token') || '');
  const refreshToken = String(body.refreshToken || request.nextUrl.searchParams.get('refreshToken') || '');
  let redirectUrl = String(body.redirectUrl || request.nextUrl.searchParams.get('redirectUrl') || '');

  if (!token || !isValidJWTFormat(token)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400, headers });
  }

  const tenantFromPath = request.nextUrl.pathname.match(/^\/([^/]+)\/auth\/set-token/)?.[1];
  const fallbackRedirect = tenantFromPath ? `/${tenantFromPath}/home` : '/';
  redirectUrl = sanitizeRedirectUrl(redirectUrl, request) || fallbackRedirect;

  const domain =
    process.env.NEXT_PUBLIC_COOKIE_DOMAIN &&
    process.env.NEXT_PUBLIC_COOKIE_DOMAIN !== 'localhost'
      ? process.env.NEXT_PUBLIC_COOKIE_DOMAIN
      : undefined;

  const cookieStore = await cookies();
  // httpOnly: false — apiClient lê via js-cookie/document.cookie (httpOnly não é visível ao JS).
  const cookieOptions = {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 3,
    path: '/',
    ...(domain ? { domain } : {}),
  };

  cookieStore.set('Authorization', token, cookieOptions);
  if (refreshToken) {
    cookieStore.set('refreshToken', refreshToken, { ...cookieOptions, maxAge: 60 * 60 * 6 });
  }
  cookieStore.set(FRESH_LOGIN_COOKIE, '1', { ...cookieOptions, maxAge: 20 });

  if (redirectUrl) {
    const useHtmlHandoff =
      request.method === 'POST' ||
      (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded') ||
      (request.headers.get('content-type') || '').includes('multipart/form-data');

    if (useHtmlHandoff) {
      const tokenJson = JSON.stringify(token);
      const refreshJson = refreshToken ? JSON.stringify(refreshToken) : 'null';
      const redirectJson = JSON.stringify(redirectUrl);
      const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Entrando...</title></head>
<body><p>Entrando, aguarde...</p>
<script>
(function() {
  var token = ${tokenJson};
  var refresh = ${refreshJson};
  var redirect = ${redirectJson};
  var tokenKey = '__trillio_token__Authorization';
  var tokenExpKey = '__trillio_token__Authorization_expires';
  var refreshKey = '__trillio_token__refreshToken';
  var refreshExpKey = '__trillio_token__refreshToken_expires';
  function writeCookie(name, value, days) {
    var exp = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    var parts = [name + '=' + encodeURIComponent(value), 'expires=' + exp, 'path=/', 'SameSite=Lax'];
    var dom = ${JSON.stringify(domain || '')};
    if (dom) parts.push('domain=' + dom);
    if (location.protocol === 'https:') parts.push('Secure');
    document.cookie = parts.join('; ');
  }
  try {
    localStorage.setItem(tokenKey, token);
    localStorage.setItem(tokenExpKey, String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    if (refresh) {
      localStorage.setItem(refreshKey, refresh);
      localStorage.setItem(refreshExpKey, String(Date.now() + 6 * 24 * 60 * 60 * 1000));
    }
    sessionStorage.setItem('trillio:justLoggedIn', '1');
  } catch (e) {}
  writeCookie('Authorization', token, 3);
  if (refresh) writeCookie('refreshToken', refresh, 6);
  writeCookie(${JSON.stringify(FRESH_LOGIN_COOKIE)}, '1', 1 / 24 / 60 / 3);
  window.location.replace(redirect);
})();
</script></body></html>`;
      const htmlResponse = new NextResponse(html, { status: 200, headers });
      htmlResponse.headers.set('Content-Type', 'text/html; charset=utf-8');
      return htmlResponse;
    }

    const redirectResponse = NextResponse.redirect(new URL(redirectUrl, request.url), { status: 302 });
    headers.forEach((value, key) => redirectResponse.headers.set(key, value));
    return redirectResponse;
  }

  return NextResponse.json({ success: true }, { headers });
}
