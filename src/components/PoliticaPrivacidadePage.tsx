'use client';

import { useDocumentLocale } from '../lib/use-document-locale';
import DocumentPageLayout from './DocumentPageLayout';
import { politicaPrivacidade } from '../documents/politica-privacidade';
import type { DocumentLocale } from '../documents/messages';

interface PoliticaPrivacidadePageProps {
  url: string;
}

export default function PoliticaPrivacidadePage({ url }: PoliticaPrivacidadePageProps) {
  const { locale } = useDocumentLocale();
  const content = politicaPrivacidade[(locale || 'pt') as DocumentLocale] ?? politicaPrivacidade.pt;
  const paragraphs = content.split(/\n\n+/).filter(Boolean);

  return (
    <DocumentPageLayout url={url} titleKey="politicaPrivacidade">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </DocumentPageLayout>
  );
}
