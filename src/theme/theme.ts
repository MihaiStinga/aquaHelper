import { useColorScheme } from 'react-native';
import type { Status } from '@/domain/types';

// Colours sampled from the reference screenshots (light) with a matching dark set.

export interface StatusColors {
  text: string;
  bg: string;
  bar: string;
}

export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  border: string;
  separator: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  iconCircle: string;
  tabBar: string;
  overlay: string;
  status: Record<Status, StatusColors>;
  chart: { line: string; point: string; grid: string; band: string };
}

const light: Theme = {
  dark: false,
  bg: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E2E2E2',
  separator: '#ECECEC',
  text: '#1B1B1B',
  textSecondary: '#5F6368',
  textMuted: '#9AA0A6',
  primary: '#1A73D9',
  onPrimary: '#FFFFFF',
  primarySoft: '#EAF2FD',
  iconCircle: '#F1F3F4',
  tabBar: '#FAFAFA',
  overlay: 'rgba(0,0,0,0.45)',
  status: {
    low: { text: '#F39200', bg: '#FFF1DC', bar: '#FDDDB0' },
    ideal: { text: '#22976A', bg: '#DDF3EA', bar: '#A3DFCC' },
    high: { text: '#E53935', bg: '#FDE4E4', bar: '#F8D3D3' },
    none: { text: '#9AA0A6', bg: '#EFEFEF', bar: '#E6E6E6' },
  },
  chart: { line: '#9EC5F0', point: '#2F7FE0', grid: '#DADADA', band: 'rgba(163,223,204,0.35)' },
};

const dark: Theme = {
  dark: true,
  bg: '#121212',
  card: '#1C1C1E',
  border: '#2E2E30',
  separator: '#2A2A2C',
  text: '#EDEDED',
  textSecondary: '#B0B3B8',
  textMuted: '#7D8187',
  primary: '#5B9EF0',
  onPrimary: '#0B1A2C',
  primarySoft: '#1A2738',
  iconCircle: '#2A2A2C',
  tabBar: '#18181A',
  overlay: 'rgba(0,0,0,0.6)',
  status: {
    low: { text: '#FFB547', bg: '#3A2A10', bar: '#6B4A17' },
    ideal: { text: '#4FD1A1', bg: '#123227', bar: '#1F6B53' },
    high: { text: '#FF6B66', bg: '#3A1615', bar: '#6E2826' },
    none: { text: '#7D8187', bg: '#2A2A2C', bar: '#333336' },
  },
  chart: { line: '#3C6EA8', point: '#5B9EF0', grid: '#333336', band: 'rgba(79,209,161,0.15)' },
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const STATUS_LABEL: Record<Status, string> = { low: 'Low', ideal: 'Ideal', high: 'High', none: '-' };
