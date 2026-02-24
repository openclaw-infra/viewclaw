import { createTamagui, createTokens } from 'tamagui';

const tokens = createTokens({
  size: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 36, 9: 44, 10: 52, true: 16 },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48, 10: 64, true: 16 },
  radius: { 0: 0, 1: 6, 2: 10, 3: 14, 4: 18, 5: 24, pill: 9999 },
  zIndex: { 0: 0, 1: 100, 2: 200 },
  color: {
    background: '#09090b', card: '#18181b', cardHover: '#27272a', border: '#27272a',
    text: '#fafafa', textMuted: '#a1a1aa', textSubtle: '#52525b',
    primary: '#6366f1', primaryHover: '#4f46e5', primaryText: '#e0e7ff', primaryBg: '#312e81',
    success: '#22c55e', successBg: '#14532d', successText: '#dcfce7',
    danger: '#ef4444', dangerBg: '#7f1d1d', dangerText: '#fee2e2',
    warning: '#f59e0b', warningBg: '#78350f', warningText: '#fef3c7'
  }
});

const config = createTamagui({
  tokens,
  themes: {
    dark: {
      background: '#09090b',
      card: '#18181b',
      border: '#27272a',
      text: '#fafafa',
      textMuted: '#a1a1aa',
      textSubtle: '#52525b',
      primary: '#6366f1',
      primaryBg: '#312e81',
      primaryText: '#e0e7ff',
      success: '#22c55e',
      successBg: '#14532d',
      successText: '#dcfce7',
      danger: '#ef4444',
      dangerBg: '#7f1d1d',
      dangerText: '#fee2e2',
      warningBg: '#78350f',
      warningText: '#fef3c7'
    }
  },
  defaultTheme: 'dark',
  shorthands: {
    p: 'padding', px: 'paddingHorizontal', py: 'paddingVertical', m: 'margin', mx: 'marginHorizontal', my: 'marginVertical',
    f: 'flex', bg: 'backgroundColor', br: 'borderRadius', bw: 'borderWidth', bc: 'borderColor',
    fs: 'fontSize', fw: 'fontWeight', gap: 'gap', w: 'width', h: 'height', ai: 'alignItems', jc: 'justifyContent', fd: 'flexDirection'
  }
});

export default config;
