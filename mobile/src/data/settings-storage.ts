import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeMode } from "../theme/colors";

const KEYS = {
  themeMode: "@viewclaw/theme-mode",
} as const;

let cachedThemeMode: ThemeMode = "dark";

export const settingsStorage = {
  async load() {
    const raw = await AsyncStorage.getItem(KEYS.themeMode);
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
