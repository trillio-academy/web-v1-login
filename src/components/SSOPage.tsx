'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function SSOPage() {
  const params = useParams();
  const url = params?.url as string;

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    window.location.href = `${apiUrl}/app/cliente/${url}/sso`;
  }, [url]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-white">Redirecionando para SSO...</div>
    </div>
  );
}
