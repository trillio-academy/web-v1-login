'use client';

import Link from 'next/link';
import { useDocumentLocale } from '../lib/use-document-locale';
import { useState } from 'react';

interface ValidacaoCertificadoPageProps {
  url: string;
}

export default function ValidacaoCertificadoPage({ url }: ValidacaoCertificadoPageProps) {
  const { t } = useDocumentLocale();
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState<{ valido: boolean; mensagem?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    setLoading(true);
    setResultado(null);
    try {
      const apiUrl = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL
        : (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_V1_URL) || '';
      const res = await fetch(`${apiUrl}/app/cliente/${url}/site/certificado/validar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigo.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.valido) {
        setResultado({ valido: true, mensagem: t('validacao.valid') });
      } else {
        setResultado({ valido: false, mensagem: data.mensagem || t('validacao.notFound') });
      }
    } catch {
      setResultado({ valido: false, mensagem: t('validacao.notFound') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 py-12 px-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-2">{t('title.validacaoCertificado')}</h1>
        <p className="text-gray-400 mb-8">{t('validacao.description')}</p>
        <form onSubmit={handleValidar} className="space-y-4">
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder={t('validacao.placeholder')}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-md transition-colors"
          >
            {loading ? t('validacao.checking') : t('validacao.confirm')}
          </button>
        </form>
        {resultado && (
          <div className={`mt-6 p-4 rounded-md ${resultado.valido ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
            {resultado.mensagem}
          </div>
        )}
        <p className="mt-8 text-sm text-gray-500">{t('validacao.noCode')}</p>
        <p className="mt-6">
          <Link href={url ? `/${url}/login` : '#'} className="text-blue-400 hover:underline">
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
