'use client';

import Link from 'next/link';
import { useDocumentLocale } from '../lib/use-document-locale';
import { useState, useEffect, useCallback } from 'react';
import TrillioLogo from './TrillioLogo';

export interface CertificadoExibicao {
  aluno: string;
  cursoNome: string;
  data: string;
  imgUrl: string;
}

export const CERTIFICADO_STORAGE_KEY = 'trillio_certificado_exibicao';

/** Sanitiza string para uso em nome de arquivo (remove caracteres inválidos, limita tamanho). */
function safeFileNamePart(s: string, maxLen = 40): string {
  const sanitized = s
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized.length > maxLen ? sanitized.slice(0, maxLen) : sanitized;
}

/** Monta nome de arquivo para download: Certificado_[aluno]_[curso]_[data].ext */
function formatCertificateFileName(cert: CertificadoExibicao, ext: string): string {
  const parts: string[] = ['Certificado'];
  if (cert.aluno) parts.push(safeFileNamePart(cert.aluno));
  if (cert.cursoNome) parts.push(safeFileNamePart(cert.cursoNome));
  if (cert.data) parts.push(safeFileNamePart(cert.data, 20));
  const base = parts.join('_') || 'Certificado';
  return `${base}.${ext}`;
}

interface CertificadoResultadoPageProps {
  url: string;
}

export function getCertificadoFromStorage(): CertificadoExibicao | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CERTIFICADO_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CertificadoExibicao;
    if (data && typeof data === 'object' && (data.aluno != null || data.cursoNome != null || data.data != null || data.imgUrl != null)) {
      return {
        aluno: typeof data.aluno === 'string' ? data.aluno : '',
        cursoNome: typeof data.cursoNome === 'string' ? data.cursoNome : '',
        data: typeof data.data === 'string' ? data.data : '',
        imgUrl: typeof data.imgUrl === 'string' ? data.imgUrl : '',
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function clearCertificadoStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CERTIFICADO_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function CertificadoResultadoPage({ url }: CertificadoResultadoPageProps) {
  const { t } = useDocumentLocale();
  const [certificado, setCertificado] = useState<CertificadoExibicao | null>(null);
  const [mounted, setMounted] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setCertificado(getCertificadoFromStorage());
    setMounted(true);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!certificado?.imgUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(certificado.imgUrl, { mode: 'cors' });
      if (!res.ok) throw new Error('Falha ao obter imagem');
      const blob = await res.blob();
      const ext = (blob.type && blob.type.startsWith('image/'))
        ? blob.type.replace('image/', '') || 'png'
        : 'png';
      const fileName = formatCertificateFileName(certificado, ext === 'jpeg' ? 'jpg' : ext);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: abrir em nova aba para o usuário salvar manualmente
      window.open(certificado.imgUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  }, [certificado]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6">
        <Link href={url ? `/${url}/login` : '#'} className="inline-flex">
          <TrillioLogo />
        </Link>
        <p className="text-gray-400">{t('validacao.checking')}</p>
      </div>
    );
  }

  if (!certificado) {
    return (
      <div className="min-h-screen bg-black text-white py-12 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="mb-8 flex justify-center">
            <Link href={url ? `/${url}/login` : '#'} className="inline-flex">
              <TrillioLogo />
            </Link>
          </div>
          <p className="text-gray-400 mb-6">{t('validacao.notFound')}</p>
          <Link
            href={url ? `/${url}/validacao-certificado` : '#'}
            className="inline-block px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
          >
            {t('validacao.confirm')}
          </Link>
          <p className="mt-6">
            <Link href={url ? `/${url}/login` : '#'} className="text-blue-400 hover:underline">
              {t('backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const hasInfo = certificado.aluno || certificado.cursoNome || certificado.data;

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Logo Trillio */}
        <div className="mb-8 flex justify-center">
          <Link href={url ? `/${url}/login` : '#'} className="inline-flex focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black rounded">
            <TrillioLogo />
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400" aria-hidden>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div>
              <h1 className="text-xl font-bold text-white">{t('validacao.valid')}</h1>
              <p className="text-sm text-gray-400">{t('validacao.validSubtitle')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              href={url ? `/${url}/validacao-certificado` : '#'}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-md text-sm font-medium transition-colors"
            >
              {t('validacao.validarOutro')}
            </Link>
            <Link
              href={url ? `/${url}/login` : '#'}
              className="px-4 py-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              {t('backToLogin')}
            </Link>
          </div>
        </div>

        {hasInfo && (
          <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900/50 p-5">
            <dl className="grid gap-4 sm:grid-cols-1">
              {certificado.aluno && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">{t('validacao.certificateOf')}</dt>
                  <dd className="text-white font-medium">{certificado.aluno}</dd>
                </div>
              )}
              {certificado.cursoNome && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">{t('validacao.referenteAoCurso')}</dt>
                  <dd className="text-white font-medium">{certificado.cursoNome}</dd>
                </div>
              )}
              {certificado.data && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">{t('validacao.concluidoEm')}</dt>
                  <dd className="text-white font-medium">{certificado.data}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <div className="rounded-lg overflow-hidden border border-gray-800 bg-gray-900/50 shadow-xl">
          {certificado.imgUrl ? (
            <img
              src={certificado.imgUrl}
              alt={certificado.aluno ? `${t('validacao.certificateOf')} ${certificado.aluno}` : 'Certificado'}
              className="w-full h-auto object-contain"
            />
          ) : (
            <div className="py-20 text-center text-gray-500">{t('validacao.valid')}</div>
          )}
        </div>

        {certificado.imgUrl && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black"
            >
              {downloading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{t('validacao.checking')}</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>{t('validacao.downloadCertificate')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
