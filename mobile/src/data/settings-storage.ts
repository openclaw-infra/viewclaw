import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeMode } from "../theme/colors";

const KEYS = {
  themeMode: "@clawflow/theme-mode",
  legacyThemeMode: "@viewclaw/theme-mode",
} as const;

let cachedThemeMode: ThemeMode = "dark";

export const settingsStorage = {
  async load() {
    let raw = await AsyncStorage.getItem(KEYS.themeMode);
    if (!raw) {
      const legacy = await AsyncStorage.getItem(KEYS.legacyThemeMode);
      if (legacy) {
        raw = legacy;
        await AsyncStorage.setItem(KEYS.themeMode, legacy);
        await AsyncStorage.removeItem(KEYS.legacyThemeMode);
      }
    }
    if (raw === "light" || raw === "dark" || raw === "system") {
      cachedThemeMode = raw;
    }
  },

  getThemeMode(): ThemeMode {
    return cachedThemeMode;
  },

  async setThemeMode(mode: ThemeMode) {
    cachedThemeMode = mode;
    await AsyncStorage.setItem(KEYS.themeMode, mode);
  },
};
