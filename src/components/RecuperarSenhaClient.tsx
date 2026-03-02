'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, getApiUrlFromEnv } from '../lib/api-client';

interface RecuperarSenhaClientProps {
  url: string;
  token: string;
}

export default function RecuperarSenhaClient({ url, token }: RecuperarSenhaClientProps) {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cliente, setCliente] = useState<Record<string, unknown> | null>(null);
  const [loadingCliente, setLoadingCliente] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
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
        })
      )
      .finally(() => setLoadingCliente(false));
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!senha) {
      setError('Por favor, preencha o campo de senha.');
      return;
    }
    if (!confirmarSenha) {
      setError('Por favor, confirme sua senha.');
      return;
    }
    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }
    if (senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const apiUrl = getApiUrlFromEnv();
      const response = await fetch(`${apiUrl}/app/recover/change/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha }),
      });
      const data = (await response.json()) as { message?: string };
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => router.push(`/${url}/login`), 2000);
      } else {
        setError(data.message || 'Erro ao alterar senha. Verifique se o token ainda é válido.');
      }
    } catch {
      setError('Erro ao processar solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingCliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  const corPrimaria = (cliente?.CorPrimaria || cliente?.corPrimaria || '#000000') as string;
  const corSecundaria = (cliente?.CorSecundaria || cliente?.corSecundaria || '#000000') as string;
  const gradientStyle = {
    background: `linear-gradient(to right, ${corPrimaria === '#000000' ? '#333' : corPrimaria} 0%, ${corSecundaria === '#000000' ? '#333' : corSecundaria} 100%)`,
    minHeight: '100vh',
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={gradientStyle}>
        <div className="w-full max-w-md mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Senha alterada com sucesso!</h2>
            <p className="text-gray-600 mb-4">Você será redirecionado para a página de login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={gradientStyle}>
      <div className="w-full max-w-md mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Alterar Senha</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
            )}
            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">
                Nova Senha
              </label>
              <input
                id="senha"
                name="senha"
                type="password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Digite sua nova senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                minLength={6}
              />
            </div>
            <div>
              <label htmlFor="confirmarSenha" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar Senha
              </label>
              <input
                id="confirmarSenha"
                name="confirmarSenha"
                type="password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Confirme sua nova senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                minLength={6}
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{
                  backgroundColor: corPrimaria === '#000000' ? '#333' : corPrimaria,
                  backgroundImage: `linear-gradient(to right, ${corPrimaria === '#000000' ? '#333' : corPrimaria} 0%, ${corSecundaria === '#000000' ? '#333' : corSecundaria} 100%)`,
                }}
              >
                {loading ? 'Alterando...' : 'Alterar Senha'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
