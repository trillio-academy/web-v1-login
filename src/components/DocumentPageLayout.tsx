'use client';

import Link from 'next/link';
import { useDocumentLocale } from '../lib/use-document-locale';

type TitleKey = 'termosDeUso' | 'politicaProtecaoDados' | 'politicaPrivacidade';

interface DocumentPageLayoutProps {
  url: string;
  titleKey: TitleKey;
  children: React.ReactNode;
}

export default function DocumentPageLayout({ url, titleKey, children }: DocumentPageLayoutProps) {
  const { t } = useDocumentLocale();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">{t(`title.${titleKey}`)}</h1>
        <div className="prose prose-invert max-w-none space-y-4 text-sm whitespace-pre-line">
          {children}
        </div>
        <p className="mt-8">
          <Link href={url ? `/${url}/login` : '#'} className="text-blue-400 hover:underline">
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
