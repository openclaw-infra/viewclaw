const { createTamagui } = require('tamagui');
const { config: defaultConfig } = require('@tamagui/config/v3');

const config = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    light_app: {
      ...defaultConfig.themes.light,
      background: '#eef4fa',
      color: '#0b1726',
      primary: '#0f766e',
      secondary: '#d7e6f6',
    },
    dark_app: {
      ...defaultConfig.themes.dark,
      background: '#07111a',
      color: '#f8fbff',
      primary: '#155e75',
      secondary: '#0f1d2e',
    },
  },
});

module.exports = config;
