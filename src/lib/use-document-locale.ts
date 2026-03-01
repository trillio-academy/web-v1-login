'use client';

import { useState, useEffect } from 'react';
import { documentMessages, type DocumentLocale } from '../documents/messages';

const LOCALE_COOKIE = 'locale';
const SUPPORTED: DocumentLocale[] = ['pt', 'en', 'es'];

function getLocaleFromCookie(): DocumentLocale {
  if (typeof document === 'undefined') return 'pt';
  const match = document.cookie.match(new RegExp(`(^| )${LOCALE_COOKIE}=([^;]+)`));
  const value = match?.[2];
  if (value && (SUPPORTED as string[]).includes(value)) return value as DocumentLocale;
  return 'pt';
}

export function useDocumentLocale(): { locale: DocumentLocale; t: (key: string) => string } {
  const [locale, setLocale] = useState<DocumentLocale>(() =>
    typeof document !== 'undefined' ? getLocaleFromCookie() : 'pt'
  );

  useEffect(() => {
    setLocale(getLocaleFromCookie());
  }, []);

  const messages = documentMessages[locale];

  const t = (key: string): string => {
    const parts = key.split('.');
    let current: unknown = messages;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return key;
      }
    }
    return typeof current === 'string' ? current : key;
  };

  return { locale, t };
}
