import { useColorScheme } from 'react-native';

/** Tokens from docs/DESIGN.md. */
const light = {
  bg: '#FFFFFF',
  surface: '#F4F5F1',
  text: '#1C1F1A',
  muted: '#5A6155',
  primary: '#2F6B2F',
  onPrimary: '#FFFFFF',
  warn: '#9A5B00',
  danger: '#A3271F',
  border: '#D9D8CF',
};

const dark: typeof light = {
  bg: '#141613',
  surface: '#1D201B',
  text: '#ECEDE8',
  muted: '#A6AD9F',
  primary: '#7FBF6E',
  onPrimary: '#0E1A0C',
  warn: '#E0A040',
  danger: '#EF8A80',
  border: '#33372F',
};

export type Colors = typeof light;

export const RADIUS = 6;
export const BUTTON_HEIGHT = 56;
export const FONT = { body: 18, small: 16, heading: 26 };

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
