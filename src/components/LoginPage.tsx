'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth } from '../lib/auth';
import { apiClient } from '../lib/api-client';
import { useDocumentLocale } from '../lib/use-document-locale';
import Loading from './Loading';

export type LoginApp = 'play' | 'business';

interface LoginPageProps {
  url: string;
  app: LoginApp;
}

function getRedirectAfterLogin(app: LoginApp, url: string, roles: string[]): string {
  if (app === 'play') {
    return `/${url}/home`;
  }
  const isAdminUser = roles.includes('ROLE_ADMIN_CLIENTE') || roles.includes('ROLE_ADMIN');
  const isHoldingUser = roles.includes('ROLE_HOLDING');
  if (isAdminUser) return `/${url}/admin/dashboard`;
  if (isHoldingUser) return `/${url}/holding/dashboard`;
  return `/${url}/admin/dashboard`;
}

function getRedirectWhenAlreadyAuth(app: LoginApp, url: string, roles: string[]): string {
  if (app === 'play') return `/${url}/home`;
  const isAdminUser = roles.includes('ROLE_ADMIN_CLIENTE') || roles.includes('ROLE_ADMIN');
  const isHoldingUser = roles.includes('ROLE_HOLDING');
  if (isAdminUser) return `/${url}/admin/dashboard`;
  if (isHoldingUser) return `/${url}/holding/dashboard`;
  return `/${url}/home`;
}

function getFriendlyLoginErrorKey(err: unknown): string {
  const ax = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
  const status = ax?.response?.status;
  const serverMessage = ax?.response?.data?.message;
  if (serverMessage && typeof serverMessage === 'string' && !serverMessage.includes('status code')) {
    return serverMessage;
  }
  if (status === 400 || status === 401) return 'login.errorInvalidCredentials';
  if (status === 403) return 'login.errorAccessDenied';
  if (status === 404) return 'login.errorNotFound';
  if (status && status >= 500) return 'login.errorServer';
  if (err instanceof Error && !err.message.includes('status code')) return err.message;
  return 'login.errorGeneric';
}

export default function LoginPage({ url, app }: LoginPageProps) {
  const { t } = useDocumentLocale();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cliente, setCliente] = useState<Record<string, unknown> | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingCliente, setLoadingCliente] = useState(true);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [showRecoverModal, setShowRecoverModal] = useState(false);
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverMessage, setRecoverMessage] = useState('');
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [cliente?.logoGrandeTelaDeLogin, cliente?.logoTelaDeLogin, cliente?.logo]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = auth.getToken();
      if (!token) {
        setCheckingAuth(false);
        return;
      }
      // Se o token existe e não está expirado, redireciona direto para a home (sessão ativa em outra aba)
      if (!auth.isTokenExpired(token)) {
        const user = auth.decodeToken(token);
        const roles = user?.roles || [];
        const redirect = getRedirectWhenAlreadyAuth(app, url, roles);
        window.location.replace(redirect);
        return;
      }
      // Token expirado ou inválido: validar na API (pode retornar 401 e limpar sessão)
      try {
        await apiClient.get(`/app/cliente/${url}/site/home?getClientePublicData=true`);
        const user = auth.decodeToken(token);
        const roles = user?.roles || [];
        const redirect = getRedirectWhenAlreadyAuth(app, url, roles);
        window.location.replace(redirect);
      } catch (err: unknown) {
        const status = err && typeof err === 'object' && 'response' in err ? (err as { response?: { status?: number } }).response?.status : undefined;
        if (status === 401) auth.logout(url);
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, [url, app]);

  useEffect(() => {
    if (checkingAuth) return;
    setLoadingCliente(true);
    apiClient
      .get(`/app/cliente/${url}/site/cliente/show`)
      .then((response: { data: Record<string, unknown> }) => setCliente(response.data))
      .catch(() =>
        setCliente({
          url,
          CorPrimaria: '#000000',
          corPrimaria: '#000000',
          CorSecundaria: '#000000',
          corSecundaria: '#000000',
          corBackgroundInformacoesDeLogin: '#d4d3d3',
        })
      )
      .finally(() => setLoadingCliente(false));
  }, [url, checkingAuth]);

  const handleRecoverPassword = () => {
    setShowRecoverModal(true);
    setRecoverEmail(login || '');
    setRecoverMessage('');
  };

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverEmail) {
      setRecoverMessage(t('login.recoverFillEmail'));
      return;
    }
    setRecoverLoading(true);
    setRecoverMessage('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_V1_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/app/cliente/${url}/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoverEmail, login: recoverEmail }),
      });
      const data = (await response.json()) as { message?: string };
      if (response.ok) {
        setRecoverMessage(data.message || t('login.recoverSuccess'));
        setTimeout(() => {
          setShowRecoverModal(false);
          setRecoverEmail('');
        }, 3000);
      } else {
        setRecoverMessage(data.message || t('login.recoverError'));
      }
    } catch {
      setRecoverMessage(t('login.recoverRequestError'));
    } finally {
      setRecoverLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await auth.login(url, { login, senha });
      if (!token) throw new Error('Token não foi retornado pelo servidor');
      const user = auth.decodeToken(token);
      if (!user) throw new Error('Erro ao decodificar token');
      await new Promise((r) => setTimeout(r, 200));
      const roles = user.roles || [];
      const redirect = getRedirectAfterLogin(app, url, roles);
      window.location.href = redirect;
    } catch (err: unknown) {
      const key = getFriendlyLoginErrorKey(err);
      setError(key.startsWith('login.') ? t(key) : key);
    } finally {
      setLoading(false);
    }
  };

  const corPrimaria = (cliente?.CorPrimaria || cliente?.corPrimaria || '#333333') as string;
  const corSecundaria = (cliente?.CorSecundaria || cliente?.corSecundaria || '#333333') as string;
  const corBackgroundLogin = (cliente?.corBackgroundInformacoesDeLogin || '#d4d3d3') as string;
  const imagemBackgroundLogin = (cliente?.imagemBackgroundLogin as { webPath?: string; caminho?: string } | undefined)
    ?.webPath || (cliente?.imagemBackgroundLogin as { webPath?: string; caminho?: string } | undefined)?.caminho || null;
  const apiBaseUrl = (typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_V1_URL)) || '';
  const rawLogoUrl =
    (cliente?.logoGrandeTelaDeLogin as { webPath?: string; caminho?: string } | undefined)?.webPath ||
    (cliente?.logoGrandeTelaDeLogin as { webPath?: string; caminho?: string } | undefined)?.caminho ||
    (cliente?.logoTelaDeLogin as { webPath?: string; caminho?: string } | undefined)?.webPath ||
    (cliente?.logoTelaDeLogin as { webPath?: string; caminho?: string } | undefined)?.caminho ||
    (cliente?.logo as { webPath?: string; caminho?: string } | undefined)?.webPath ||
    (cliente?.logo as { webPath?: string; caminho?: string } | undefined)?.caminho ||
    null;
  const logoUrl =
    rawLogoUrl && typeof rawLogoUrl === 'string' && !rawLogoUrl.startsWith('http')
      ? `${apiBaseUrl.replace(/\/$/, '')}${rawLogoUrl.startsWith('/') ? '' : '/'}${rawLogoUrl}`
      : rawLogoUrl;

  const gradientStyle = {
    background: `linear-gradient(to right, ${corPrimaria === '#000000' ? '#333' : corPrimaria} 0%, ${corSecundaria === '#000000' ? '#333' : corSecundaria} 100%)`,
  };
  const cardRightStyle = {
    backgroundColor: corBackgroundLogin,
    backgroundImage: imagemBackgroundLogin ? `url("${imagemBackgroundLogin}")` : undefined,
    backgroundSize: imagemBackgroundLogin ? 'cover' : undefined,
    backgroundPosition: imagemBackgroundLogin ? 'center' : undefined,
  };

  if (checkingAuth || loadingCliente) {
    return (
      <Loading
        fullScreen
        size="large"
        text={checkingAuth ? t('login.checkingAuth') : t('login.loading')}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={gradientStyle}>
      <div className="w-full max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row shadow-2xl rounded-lg overflow-hidden" style={{ maxHeight: '608px' }}>
          <div
            className="w-full md:w-2/5 flex flex-col justify-between items-center px-8 md:px-12 py-12"
            style={{ ...cardRightStyle, minHeight: '608px', borderRadius: '5px 0 0 5px' }}
          >
            {cliente?.permitirTraducao ? (
              <div className="w-full flex justify-center mb-4" role="group" aria-label="Selecionar idioma">
                <div className="flex gap-2">
                  <button type="button" className="w-8 h-8 rounded-full border-2 opacity-70 hover:opacity-100 transition-opacity flex items-center justify-center text-sm" style={{ borderColor: (cliente?.corFonteTelaLogin as string) || '#333333' }} title="Português" aria-label="Selecionar Português" onClick={() => { document.cookie = 'locale=pt; path=/; max-age=31536000'; window.location.reload(); }}>🇧🇷</button>
                  <button type="button" className="w-8 h-8 rounded-full border-2 opacity-70 hover:opacity-100 transition-opacity flex items-center justify-center text-sm" style={{ borderColor: (cliente?.corFonteTelaLogin as string) || '#333333' }} title="English" aria-label="Selecionar English" onClick={() => { document.cookie = 'locale=en; path=/; max-age=31536000'; window.location.reload(); }}>🇺🇸</button>
                  <button type="button" className="w-8 h-8 rounded-full border-2 opacity-70 hover:opacity-100 transition-opacity flex items-center justify-center text-sm" style={{ borderColor: (cliente?.corFonteTelaLogin as string) || '#333333' }} title="Español" aria-label="Selecionar Español" onClick={() => { document.cookie = 'locale=es; path=/; max-age=31536000'; window.location.reload(); }}>🇪🇸</button>
                </div>
              </div>
            ) : null}
            <div className="mt-8 mb-8 flex justify-center min-h-[120px] items-center">
              {logoUrl && !logoError ? (
                <a href="https://trillio.com.br/" target="_blank" rel="noopener noreferrer" className="flex justify-center">
                  <img src={logoUrl} alt={(cliente?.nome as string) || 'Trillio'} className="w-full max-w-[300px] h-auto object-contain" onError={() => setLogoError(true)} />
                </a>
              ) : (
                <span className="text-2xl font-bold tracking-tight opacity-90" style={{ color: (cliente?.corFonteTelaLogin as string) || '#333333' }}>
                  {(cliente?.nome as string) || 'Trillio'}
                </span>
              )}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <p className="text-xl md:text-2xl font-bold leading-relaxed" style={{ color: (cliente?.corFonteTelaLogin as string) || '#333333' }}>
                {cliente?.textoTelaLogin ? (cliente.textoTelaLogin as string) : t('login.welcome')}
              </p>
              <p className="mt-2 text-base md:text-lg font-light tracking-wide opacity-80" style={{ color: (cliente?.corFonteTelaLogin as string) || '#333333' }}>
                {app === 'play' ? t('login.play') : t('login.business')}
              </p>
            </div>
            {cliente?.permitirRedesSociais ? (
              <div className="flex gap-6 mt-8">
                <a href="https://www.facebook.com/trillioacademy" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80" style={{ background: 'linear-gradient(to right, rgb(239, 137, 70) 0%, rgb(222, 52, 109) 100%)' }}>
                  <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://www.instagram.com/trillioacademy/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80" style={{ background: 'linear-gradient(to right, rgb(239, 137, 70) 0%, rgb(222, 52, 109) 100%)' }}>
                  <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/></svg>
                </a>
                <a href="https://www.linkedin.com/company/trillioacademy/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80" style={{ background: 'linear-gradient(to right, rgb(239, 137, 70) 0%, rgb(222, 52, 109) 100%)' }}>
                  <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              </div>
            ) : null}
          </div>
          <div className="w-full md:w-3/5 flex flex-col justify-center px-8 md:px-12 py-12 bg-white" style={{ borderRadius: '0 5px 5px 0' }}>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('login.title')}</h2>
            </div>
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label htmlFor="login" className="block text-sm font-medium text-gray-700 mb-1">{t('login.loginLabel')}</label>
                  <input id="login" name="login" type="text" required className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" placeholder={t('login.loginPlaceholder')} value={login} onChange={(e) => setLogin(e.target.value)} />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="senha" className="block text-sm font-medium text-gray-700">{t('login.password')}</label>
                    <a href="#" onClick={(e) => { e.preventDefault(); handleRecoverPassword(); }} className="text-sm text-blue-600 hover:text-blue-800 hover:underline">{t('login.forgotPassword')}</a>
                  </div>
                  <input id="senha" name="senha" type="password" required className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" placeholder={t('login.passwordPlaceholder')} value={senha} onChange={(e) => setSenha(e.target.value)} />
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200"
                  style={{
                    backgroundColor: corPrimaria === '#000000' ? '#333' : corPrimaria,
                    backgroundImage: loading ? undefined : `linear-gradient(to right, ${corPrimaria === '#000000' ? '#333' : corPrimaria} 0%, ${corSecundaria === '#000000' ? '#333' : corSecundaria} 100%)`,
                    opacity: loading ? 0.9 : 1,
                  }}
                >
                  {loading ? (
                    <>
                      <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                      <span>{t('login.submitting')}</span>
                    </>
                  ) : (
                    t('login.submit')
                  )}
                </button>
              </div>
              <div className="mt-4 text-center">
                <a href={`/${url}/autocadastro`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                  {t('login.noAccount')}
                </a>
              </div>
            </form>
            <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500 space-y-1">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                <Link href={url ? `/${url}/validacao-certificado` : '#'} className="hover:underline">{t('login.certificateValidation')}</Link>
                <Link href={url ? `/${url}/termos-de-uso` : '#'} className="hover:underline">{t('login.termsOfUse')}</Link>
                <Link href={url ? `/${url}/politica-protecao-dados` : '#'} className="hover:underline">{t('login.dataProtection')}</Link>
                <Link href={url ? `/${url}/politica-privacidade` : '#'} className="hover:underline">{t('login.privacyPolicy')}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showRecoverModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowRecoverModal(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('login.recoverTitle')}</h2>
            <form onSubmit={handleRecoverSubmit}>
              <div className="mb-4">
                <label htmlFor="recover-email" className="block text-sm font-medium text-gray-700 mb-1">{t('login.email')}</label>
                <input id="recover-email" type="email" value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} required className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" placeholder={t('login.emailPlaceholder')} />
              </div>
              {recoverMessage && (
                <div className={`mb-4 p-3 rounded-md text-sm ${recoverMessage.includes('sucesso') || recoverMessage.includes('success') || recoverMessage.includes('éxito') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>{recoverMessage}</div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowRecoverModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">{t('login.cancel')}</button>
                <button type="submit" disabled={recoverLoading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{recoverLoading ? t('login.sending') : t('login.send')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
