type ImagemRef = { webPath?: string; caminho?: string; caminhoWeb?: string } | null | undefined;

function extractFilename(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

/** Absolute URL for an upload path; relative paths are prefixed with apiBaseUrl. */
export function toAbsoluteUploadUrl(raw: string | null | undefined, apiBaseUrl = ''): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const base = apiBaseUrl.replace(/\/$/, '');
  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

function refUrls(ref: ImagemRef): string[] {
  if (!ref) return [];
  const out: string[] = [];
  for (const key of ['webPath', 'caminhoWeb', 'caminho'] as const) {
    const v = ref[key];
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
  }
  return out;
}

/**
 * Ordered logo candidates for the login page (Backblaze only):
 * logoGrande → logoTelaDeLogin → logo
 */
export function buildLoginLogoCandidates(
  cliente: Record<string, unknown> | null | undefined,
  apiBaseUrl = ''
): string[] {
  if (!cliente) return [];
  const sources: ImagemRef[] = [
    cliente.logoGrandeTelaDeLogin as ImagemRef,
    cliente.logoTelaDeLogin as ImagemRef,
    cliente.logo as ImagemRef,
  ];
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const src of sources) {
    for (const raw of refUrls(src)) {
      const absolute = toAbsoluteUploadUrl(raw, apiBaseUrl);
      if (!absolute || seen.has(absolute)) continue;
      // Prefer filename-stable identity so duplicate refs collapse
      const key = extractFilename(absolute) || absolute;
      if (seen.has(key)) continue;
      seen.add(absolute);
      seen.add(key);
      candidates.push(absolute);
    }
  }
  return candidates;
}
