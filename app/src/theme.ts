import { Platform, useColorScheme } from 'react-native';

import type { Language } from './lib/advice';

/** Tokens from docs/DESIGN.md: warm paper, ink, one terracotta accent. */
const light = {
  bg: '#F3EEE6', // paper
  surface: '#FBF8F2', // cards
  sunken: '#EAE3D7', // hatch ground, input wells
  hatch: '#D9CEBC',
  text: '#1E1A16', // ink
  muted: '#665D52',
  border: '#E1D8C9',
  primary: '#1E1A16', // the black action button
  onPrimary: '#FBF8F2',
  accent: '#B5391F', // labels, selection, "needs action"
  onAccent: '#FBF8F2',
  good: '#2F6B2F',
  warn: '#8F5200',
  danger: '#B5391F',
};

const dark: typeof light = {
  bg: '#16130F',
  surface: '#211D18',
  sunken: '#2A251F',
  hatch: '#3A332B',
  text: '#F2ECE2',
  muted: '#B3A999',
  border: '#3A332B',
  primary: '#F2ECE2',
  onPrimary: '#16130F',
  accent: '#F08A6C',
  onAccent: '#16130F',
  good: '#86C47A',
  warn: '#E3A54B',
  danger: '#F08A6C',
};

export type Colors = typeof light;

export const RADIUS = 6;
export const BUTTON_HEIGHT = 56;

/** System faces, so nothing is downloaded and Devanagari falls back cleanly. */
export const FONTS = {
  serif: Platform.select({ android: 'serif', ios: 'Georgia', default: 'Georgia, "Noto Serif", "Times New Roman", serif' }),
  mono: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'ui-monospace, Menlo, Consolas, monospace' }),
};

/** Hindi is never set below 16 px (docs/DESIGN.md), so the small mono sizes apply to English only. */
export function sizes(language: Language) {
  const hi = language === 'hi';
  return {
    kicker: hi ? 16 : 12,
    meta: hi ? 16 : 13,
    body: 17,
    small: 16,
    title: 30,
    heading: 22,
    cardTitle: 21,
  };
}

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
