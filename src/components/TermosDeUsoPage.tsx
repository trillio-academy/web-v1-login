'use client';

import { useDocumentLocale } from '../lib/use-document-locale';
import DocumentPageLayout from './DocumentPageLayout';
import { termosDeUso } from '../documents/termos-de-uso';
import type { DocumentLocale } from '../documents/messages';

interface TermosDeUsoPageProps {
  url: string;
}

export default function TermosDeUsoPage({ url }: TermosDeUsoPageProps) {
  const { locale } = useDocumentLocale();
  const content = termosDeUso[(locale || 'pt') as DocumentLocale] ?? termosDeUso.pt;
  const paragraphs = content.split(/\n\n+/).filter(Boolean);

  return (
    <DocumentPageLayout url={url} titleKey="termosDeUso">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </DocumentPageLayout>
  );
}
