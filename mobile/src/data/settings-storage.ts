import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeMode } from "../theme/colors";

export type AppLanguage = "en" | "zh" | "system";

const KEYS = {
  themeMode: "@clawflow/theme-mode",
  legacyThemeMode: "@viewclaw/theme-mode",
  language: "@clawflow/language",
} as const;

let cachedThemeMode: ThemeMode = "dark";
let cachedLanguage: AppLanguage = "system";

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

    const langRaw = await AsyncStorage.getItem(KEYS.language);
    if (langRaw === "en" || langRaw === "zh" || langRaw === "system") {
      cachedLanguage = langRaw;
    }
  },

  getThemeMode(): ThemeMode {
    return cachedThemeMode;
  },

  async setThemeMode(mode: ThemeMode) {
    cachedThemeMode = mode;
    await AsyncStorage.setItem(KEYS.themeMode, mode);
  },

  getLanguage(): AppLanguage {
    return cachedLanguage;
  },

  async setLanguage(lang: AppLanguage) {
    cachedLanguage = lang;
    await AsyncStorage.setItem(KEYS.language, lang);
  },
};
