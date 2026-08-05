'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getApiUrlFromEnv } from '../lib/api-client';
import { getSafeRedirectUrl } from '../lib/redirect';

export type SsoApp = 'play' | 'business';

interface SSOPageProps {
  /** App de origem do SSO — define o destino do handoff pós-login. */
  app?: SsoApp;
}

export default function SSOPage({ app }: SSOPageProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const url = params?.url as string;

  useEffect(() => {
    const apiUrl = getApiUrlFromEnv();
    const redirect = getSafeRedirectUrl(searchParams.get('redirect'));
    const appFromQuery = searchParams.get('app');
    const resolvedApp =
      app === 'play' || app === 'business'
        ? app
        : appFromQuery === 'play' || appFromQuery === 'business'
          ? appFromQuery
          : null;

    const qs = new URLSearchParams();
    if (redirect) qs.set('redirect', redirect);
    if (resolvedApp) qs.set('app', resolvedApp);

    const query = qs.toString();
    const target = `${apiUrl}/app/cliente/${url}/sso${query ? `?${query}` : ''}`;
    window.location.href = target;
  }, [url, searchParams, app]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-white">Redirecionando para SSO…</div>
    </div>
  );
}
