import { useAppStore } from './store/useAppStore';

const palettes = {
  dark: {
    bg: '#07111a',
    panel: '#0f1d2ed9',
    panelBorder: '#1e344e',
    card: '#091423',
    cardBorder: '#1b324d',
    text: '#f8fbff',
    muted: '#88a1b8',
    subtle: '#9fb4c8',
    primary: '#155e75',
    primaryText: '#ecfeff',
    info: '#1d4ed8',
    infoText: '#dbeafe',
    success: '#0f766e',
    successText: '#ccfbf1',
    danger: '#b91c1c',
    dangerText: '#fee2e2',
    tabBg: '#0d1b2ad9',
    tabBorder: '#1f344f',
    tabActiveBorder: '#1f7d97',
    tabInactiveText: '#8ea7bf',
    brand: '#6b8aa7',
  },
  light: {
    bg: '#eef4fa',
    panel: '#f7fbff',
    panelBorder: '#d1dfef',
    card: '#ffffff',
    cardBorder: '#dbe7f5',
    text: '#0b1726',
    muted: '#4f647a',
    subtle: '#5d758c',
    primary: '#0f766e',
    primaryText: '#ecfeff',
    info: '#1d4ed8',
    infoText: '#e5ecff',
    success: '#0f766e',
    successText: '#ccfbf1',
    danger: '#b91c1c',
    dangerText: '#fee2e2',
    tabBg: '#e3edf8',
    tabBorder: '#c8d9eb',
    tabActiveBorder: '#0f766e',
    tabInactiveText: '#46617c',
    brand: '#5f7994',
  },
};

export function usePalette() {
  const mode = useAppStore((s) => s.themeMode);
  return palettes[mode] || palettes.dark;
}

export function useThemeMode() {
  return useAppStore((s) => s.themeMode);
}

export const colors = palettes.dark;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
};

export const spacing = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
};
