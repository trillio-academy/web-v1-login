import { apiClient } from './api-client';
import { getSafeRedirectUrl, resolvePostLoginRedirect } from './redirect';
import type { LoginApp } from '../components/LoginPage';

/**
 * Resolve destino pós-login no app play (assessment / autoavaliação / home).
 * Para business, mantém redirect por role.
 */
export async function resolvePlayPostLoginPath(
  url: string,
  fallbackPath: string
): Promise<string> {
  try {
    const redirectParam =
      typeof window !== 'undefined'
        ? getSafeRedirectUrl(new URLSearchParams(window.location.search).get('redirect'))
        : null;
    const query = redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : '';
    const response = await apiClient.get(`/app/cliente/${url}/site/post-login-path${query}`);
    const path = response.data?.path;
    const reason = response.data?.reason;
    if (typeof path === 'string' && path.startsWith('/')) {
      if (reason === 'assessment' || reason === 'autoavaliacao') {
        return path;
      }
      return resolvePostLoginRedirect(path);
    }
  } catch {
    // fallback
  }
  return resolvePostLoginRedirect(fallbackPath);
}

export async function resolvePostLoginDestination(
  app: LoginApp,
  url: string,
  roles: string[],
  defaultPath: string
): Promise<string> {
  if (app === 'play') {
    return resolvePlayPostLoginPath(url, defaultPath);
  }
  return resolvePostLoginRedirect(defaultPath);
}
