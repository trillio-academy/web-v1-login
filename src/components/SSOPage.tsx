'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getApiUrlFromEnv } from '../lib/api-client';
import { getSafeRedirectUrl } from '../lib/redirect';

export default function SSOPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const url = params?.url as string;

  useEffect(() => {
    const apiUrl = getApiUrlFromEnv();
    const redirect = getSafeRedirectUrl(searchParams.get('redirect'));
    let target = `${apiUrl}/app/cliente/${url}/sso`;
    if (redirect) {
      target += `?redirect=${encodeURIComponent(redirect)}`;
    }
    window.location.href = target;
  }, [url, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-white">Redirecionando para SSO…</div>
    </div>
  );
}
