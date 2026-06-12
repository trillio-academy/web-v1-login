/**
 * Contraste de texto sobre fundo (luminância relativa WCAG).
 */
export function pickTextColorBasedOnBgColor(
  bgColor: string | null | undefined,
  lightColor: string,
  darkColor: string
): string {
  if (!bgColor || typeof bgColor !== 'string') {
    return lightColor;
  }
  const hex = bgColor.charAt(0) === '#' ? bgColor.slice(1, 7) : bgColor;
  if (hex.length !== 6) return lightColor;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  const L = 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  return L > 0.179 ? darkColor : lightColor;
}

export function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  if (!value || typeof value !== 'string') return fallback;
  const s = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s}`;
  return fallback;
}
