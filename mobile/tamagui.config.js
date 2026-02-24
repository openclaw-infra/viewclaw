import { createTamagui, createTokens } from 'tamagui';

const tokens = createTokens({
  size: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 36, 9: 44, 10: 52, true: 16 },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48, 10: 64, true: 16 },
  radius: { 
    0: 0, 
    1: 4, 
    2: 8, 
    3: 12, 
    4: 16, 
    5: 20, 
    pill: 9999,
    true: 8 
  },
  zIndex: { 0: 0, 1: 100, 2: 200 },
  color: {
    // Ant Design inspired palette
    background: '#f5f5f5', // Light background for light mode
    card: '#ffffff',
    cardHover: '#fafafa',
    border: '#f0f0f0',
    text: '#262626',
    textMuted: '#8c8c8c',
    textSubtle: '#bfbfbf',
    primary: '#1677ff', // AntD Blue
    primaryHover: '#4096ff',
    primaryBg: '#e6f4ff',
    primaryText: '#1677ff',
    success: '#52c41a',
    successBg: '#f6ffed',
    successText: '#389e0d',
    danger: '#ff4d4f',
    dangerBg: '#fff1f0',
    dangerText: '#cf1322',
    warning: '#faad14',
    warningBg: '#fffbe6',
    warningText: '#d48806'
  }
});

const config = createTamagui({
  tokens,
  themes: {
    light: {
      background: '#f5f5f5',
      card: '#ffffff',
      border: '#f0f0f0',
      text: '#262626',
      textMuted: '#8c8c8c',
      textSubtle: '#bfbfbf',
      primary: '#1677ff',
      primaryBg: '#e6f4ff',
      primaryText: '#1677ff',
      success: '#52c41a',
      successBg: '#f6ffed',
      successText: '#389e0d',
      danger: '#ff4d4f',
      dangerBg: '#fff1f0',
      dangerText: '#cf1322',
      warningBg: '#fffbe6',
      warningText: '#d48806'
    },
    dark: {
      background: '#000000',
      card: '#141414',
      border: '#303030',
      text: 'rgba(255, 255, 255, 0.85)',
      textMuted: 'rgba(255, 255, 255, 0.45)',
      textSubtle: 'rgba(255, 255, 255, 0.25)',
      primary: '#1668dc',
      primaryBg: '#111a2c',
      primaryText: '#1668dc',
      success: '#49aa19',
      successBg: '#162312',
      successText: '#49aa19',
      danger: '#a61d24',
      dangerBg: '#2a1215',
      dangerText: '#a61d24',
      warningBg: '#2b2111',
      warningText: '#d89614'
    }
  },
  defaultTheme: 'dark', // Keep default as dark but updated to AntD Dark
  shorthands: {
    p: 'padding', px: 'paddingHorizontal', py: 'paddingVertical', m: 'margin', mx: 'marginHorizontal', my: 'marginVertical',
    f: 'flex', bg: 'backgroundColor', br: 'borderRadius', bw: 'borderWidth', bc: 'borderColor',
    fs: 'fontSize', fw: 'fontWeight', gap: 'gap', w: 'width', h: 'height', ai: 'alignItems', jc: 'justifyContent', fd: 'flexDirection'
  }
});

export default config;
