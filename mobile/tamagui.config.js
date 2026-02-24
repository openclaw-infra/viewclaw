import { createTamagui, createTokens } from 'tamagui';

const tokens = createTokens({
  size: {
    0: 0,
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 22,
    6: 28,
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
  },
  radius: {
    0: 0,
    1: 6,
    2: 10,
    3: 14,
  },
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
  },
  color: {
    background: '#0b1020',
    panel: '#11182d',
    card: '#1b2540',
    text: '#ffffff',
    muted: '#9ca3af',
    primary: '#3b82f6',
    success: '#22c55e',
    danger: '#ef4444',
  },
});

const config = createTamagui({
  tokens,
  themes: {
    dark: {
      background: '#0b1020',
      color: '#ffffff',
      primary: '#3b82f6',
      secondary: '#1b2540',
    },
  },
  defaultTheme: 'dark',
});

export default config;
