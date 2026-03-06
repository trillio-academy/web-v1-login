'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getClientBaseUrl } from '../lib/api-client';
import { useDocumentLocale } from '../lib/use-document-locale';
import { useState } from 'react';
import { CERTIFICADO_STORAGE_KEY } from './CertificadoResultadoPage';
import TrillioLogo from './TrillioLogo';

interface ValidacaoCertificadoPageProps {
  url: string;
}

/** Resposta da API antiga: certificado de curso (matricula) ou certificado de evento (dataCriacao). */
interface CertificadoApi {
  id?: number;
  data?: string;
  dataCriacao?: string;
  codigo?: string;
  matricula?: {
    aluno?: string;
    curso?: { nome?: string };
  };
  foto?: { webPath?: string; caminho?: string };
}

interface CertificadoExibicao {
  aluno: string;
  cursoNome: string;
  data: string;
  imgUrl: string;
}

function normalizarCertificado(json: CertificadoApi): CertificadoExibicao {
  const raw = json as Record<string, unknown>;
  const matricula = (json.matricula ?? raw.Matricula) as CertificadoApi['matricula'] | undefined;
  const aluno = (matricula && typeof matricula === 'object' && 'aluno' in matricula)
    ? String((matricula as { aluno?: string }).aluno ?? '')
    : '';
  const curso = matricula && typeof matricula === 'object' && 'curso' in matricula ? (matricula as { curso?: { nome?: string } }).curso : null;
  const cursoNome = curso && typeof curso === 'object' && curso !== null ? (curso.nome ?? '') : '';
  const data = json.data ?? json.dataCriacao ?? (raw.Data as string) ?? '';
  const foto = (json.foto ?? raw.Foto) as CertificadoApi['foto'] | undefined;
  const imgUrl = foto && typeof foto === 'object'
    ? ('webPath' in foto ? foto.webPath : foto.caminho) ?? ''
    : '';
  return { aluno, cursoNome, data, imgUrl };
}

function isRespostaCertificadoValido(data: unknown): data is CertificadoApi {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  // Aceitar codigo em minúsculo ou maiúsculo (API pode variar)
  const temCodigo = typeof d.codigo === 'string' || typeof d.Codigo === 'string';
  const temMatricula = (d.matricula != null && typeof d.matricula === 'object') || (d.Matricula != null && typeof d.Matricula === 'object');
  const temFoto = (d.foto != null && typeof d.foto === 'object') || (d.Foto != null && typeof d.Foto === 'object');
  const temId = d.id != null && (typeof d.id === 'number' || (typeof d.id === 'string' && String(d.id).trim() !== ''));
  // Prioridade: se tem formato de certificado, é sucesso (id + codigo também indica certificado da API)
  if (temCodigo && (temMatricula || temFoto || temId)) return true;
  // Só tratar como erro se tiver mensagem/error e não for certificado
  if ('mensagem' in d && typeof d.mensagem === 'string') return false;
  if ('error' in d && typeof d.error === 'string') return false;
  return false;
}

export default function ValidacaoCertificadoPage({ url }: ValidacaoCertificadoPageProps) {
  const { t } = useDocumentLocale();
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    setLoading(true);
    setErro(null);
    try {
      const baseUrl = getClientBaseUrl();
      const requestUrl = `${baseUrl}/app/cliente/${url}/site/certificado/validar`;
      const res = await fetch(
        requestUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ codigo: codigo.trim() }),
        }
      );
      // Sempre ler o body como texto (evita CORS opaque response consumir duas vezes)
      const rawText = await res.text();
      const text = rawText?.replace(/^\uFEFF/, '')?.trim() ?? '';
      let data: unknown = null;
      if (text && (text.startsWith('{') || text.startsWith('['))) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }
      // Resposta pode vir em wrapper (ex.: { data: { codigo, matricula, foto } })
      // Só fazer unwrap se "data" for um objeto (wrapper), não a string de data do certificado
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const root = data as Record<string, unknown>;
        if ('data' in root) {
          const inner = root.data;
          if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
            const innerObj = inner as Record<string, unknown>;
            // Só usar inner se parecer wrapper (ex.: tem codigo/matricula/foto no inner), não quando root já é o certificado
            if ('codigo' in innerObj || 'matricula' in innerObj || 'foto' in innerObj) data = inner;
          }
        }
      }

      const isOk = res.ok && res.status >= 200 && res.status < 300;
      // Aceitar resposta em array (ex.: [{ codigo, matricula, foto }])
      if (data && Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
        data = data[0] as unknown;
      }
      let isValidCert = isRespostaCertificadoValido(data);
      // Fallback: status 200 e body com formato de certificado — tentar parse de novo se ainda não temos data válido
      if (!isValidCert && res.status === 200 && text && (text.includes('"codigo"') || text.includes('"Codigo"')) && (text.includes('"matricula"') || text.includes('"foto"') || text.includes('"id"')) ) {
        if (!data && text) {
          try {
            data = JSON.parse(text) as unknown;
            // Unwrap se vier { data: { codigo, matricula, foto } }
            if (data && typeof data === 'object' && !Array.isArray(data) && 'data' in (data as Record<string, unknown>)) {
              const inner = (data as { data?: unknown }).data;
              if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
                const innerObj = inner as Record<string, unknown>;
                if ('codigo' in innerObj || 'matricula' in innerObj || 'foto' in innerObj) data = inner;
              }
            }
          } catch {
            // ignore
          }
        }
        if (data && Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') data = data[0] as unknown;
        isValidCert = isRespostaCertificadoValido(data);
      }

      if (isOk && isValidCert) {
        const exibir = normalizarCertificado(data as CertificadoApi);
        try {
          sessionStorage.setItem(CERTIFICADO_STORAGE_KEY, JSON.stringify(exibir));
        } catch {
          // ignore
        }
        setErro(null);
        router.push(`/${url}/validacao-certificado/resultado`);
        return;
      } else {
        const msg =
          typeof data === 'object' && data != null && 'mensagem' in (data as Record<string, unknown>)
            ? (data as { mensagem?: string }).mensagem
            : typeof data === 'string'
              ? data
              : t('validacao.notFound');
        setErro(msg || t('validacao.notFound'));
      }
    } catch {
      setErro(t('validacao.notFound'));
    } finally {
      setLoading(false);
    }
  };

  const handleFechar = () => setErro(null);

  return (
    <div className="min-h-screen bg-black text-white py-12 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        {/* Logo Trillio */}
        <div className="mb-8 flex justify-center">
          <Link href={url ? `/${url}/login` : '#'} className="inline-flex focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black rounded">
            <TrillioLogo />
          </Link>
        </div>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-800 border border-gray-700 text-gray-300" aria-hidden>
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('title.validacaoCertificado')}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{t('validacao.description')}</p>
          </div>
        </div>

        {/* Card do formulário */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 shadow-xl">
          <form onSubmit={handleValidar} className="space-y-5">
            <div>
              <label htmlFor="codigo-validacao" className="sr-only">
                {t('validacao.placeholder')}
              </label>
              <input
                id="codigo-validacao"
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder={t('validacao.placeholder')}
                className="w-full px-4 py-3.5 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black"
            >
              {loading ? t('validacao.checking') : t('validacao.confirm')}
            </button>
          </form>

          {erro && (
            <div className="mt-5 p-4 rounded-lg bg-red-950/50 border border-red-900/50 text-red-200 flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 mt-0.5" aria-hidden>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span className="flex-1 text-sm">{erro}</span>
              <button
                type="button"
                onClick={handleFechar}
                className="shrink-0 p-1 rounded hover:bg-red-900/30 text-red-300 transition-colors"
                aria-label={t('validacao.close')}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <p className="mt-6 text-center text-sm text-gray-500">{t('validacao.noCode')}</p>
        <p className="mt-4 text-center">
          <Link href={url ? `/${url}/login` : '#'} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
