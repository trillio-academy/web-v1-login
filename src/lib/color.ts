import type { CSSProperties } from 'react';

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

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.charAt(0) === '#' ? hex.slice(1, 7) : hex;
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return [r, g, b];
}

/** Luminância relativa WCAG (0 = preto, 1 = branco). */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [rs, gs, bs] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function isVisibleOnSurface(color: string, surfaceBg: string, minContrast = 0.28): boolean {
  return Math.abs(relativeLuminance(color) - relativeLuminance(surfaceBg)) >= minContrast;
}

/** Cores de marca visíveis para gradiente/fundo (quando primária/secundária são brancas). */
export function resolveLoginBrandColors(
  prim: string,
  sec: string,
  accents: string[] = []
): { prim: string; sec: string } {
  const fallback = '#333333';
  const distinct = [...new Set([prim, sec, ...accents, fallback])];
  const vivid = distinct.filter((c) => relativeLuminance(c) < 0.85);

  if (vivid.length >= 2) return { prim: vivid[0], sec: vivid[1] };
  if (vivid.length === 1) return { prim: vivid[0], sec: vivid[0] };
  return { prim: fallback, sec: fallback };
}

/** Cor com contraste suficiente sobre o fundo do painel (ex.: botão SSO no painel branco). */
export function resolveLoginButtonColors(
  prim: string,
  sec: string,
  surfaceBg = '#ffffff',
  accents: string[] = []
): { bg: string; bgEnd: string; color: string } {
  const fallback = '#333333';
  const candidates = [...new Set([prim, sec, ...accents, fallback])];

  const pickBg = (pool: string[]) => {
    for (const c of pool) {
      if (isVisibleOnSurface(c, surfaceBg)) return c;
    }
    return fallback;
  };

  const bg = pickBg(candidates);
  const bgEnd = pickBg([sec, prim, ...accents, bg, fallback]);

  return {
    bg,
    bgEnd,
    color: pickTextColorBasedOnBgColor(bg, '#ffffff', '#171717'),
  };
}

export function buildLoginPrimaryButtonStyle(
  prim: string,
  sec: string,
  surfaceBg = '#ffffff',
  accents: string[] = []
): CSSProperties {
  const { bg, bgEnd, color } = resolveLoginButtonColors(prim, sec, surfaceBg, accents);
  return {
    backgroundColor: bg,
    backgroundImage: `linear-gradient(to right, ${bg} 0%, ${bgEnd} 100%)`,
    color,
  };
}
