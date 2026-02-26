import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { darkPalette, lightPalette } from "./colors";
import type { ColorPalette, ThemeMode } from "./colors";
import { settingsStorage } from "../data/settings-storage";

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ColorPalette;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  isDark: true,
  colors: darkPalette,
  setMode: () => {},
});

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    settingsStorage.load().then(() => {
      setModeState(settingsStorage.getThemeMode());
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    settingsStorage.setThemeMode(m);
  }, []);

  const isDark = mode === "dark" || (mode === "system" && systemScheme !== "light");

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark,
      colors: isDark ? darkPalette : lightPalette,
      setMode,
    }),
    [mode, isDark, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
