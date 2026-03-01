'use client';

import { useDocumentLocale } from '../lib/use-document-locale';
import DocumentPageLayout from './DocumentPageLayout';
import { politicaProtecaoDados } from '../documents/politica-protecao-dados';
import type { DocumentLocale } from '../documents/messages';

interface PoliticaProtecaoDadosPageProps {
  url: string;
}

export default function PoliticaProtecaoDadosPage({ url }: PoliticaProtecaoDadosPageProps) {
  const { locale } = useDocumentLocale();
  const content = politicaProtecaoDados[(locale || 'pt') as DocumentLocale] ?? politicaProtecaoDados.pt;
  const paragraphs = content.split(/\n\n+/).filter(Boolean);

  return (
    <DocumentPageLayout url={url} titleKey="politicaProtecaoDados">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </DocumentPageLayout>
  );
}
