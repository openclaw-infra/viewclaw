export type ThemeMode = "light" | "dark" | "system";

export type ColorPalette = {
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    elevated: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  accent: {
    blue: string;
    blueDim: string;
    green: string;
    yellow: string;
    red: string;
    purple: string;
    cyan: string;
  };
  border: {
    subtle: string;
    medium: string;
  };
  bubble: {
    user: string;
    userBorder: string;
    assistant: string;
    assistantBorder: string;
  };
  status: {
    connecting: string;
    connected: string;
    disconnected: string;
  };
  log: {
    thought: string;
    action: string;
    observation: string;
    error: string;
    done: string;
    status: string;
  };
};

export const darkPalette: ColorPalette = {
  bg: {
    primary: "#000000",
    secondary: "#0A0F14",
    tertiary: "#111820",
    elevated: "#161E28",
  },
  text: {
    primary: "#F1F5F9",
    secondary: "#94A3B8",
    muted: "#64748B",
    inverse: "#0F172A",
  },
  accent: {
    blue: "#3B82F6",
    blueDim: "#2563EB",
    green: "#22C55E",
    yellow: "#FBBF24",
    red: "#EF4444",
    purple: "#A78BFA",
    cyan: "#22D3EE",
  },
  border: {
    subtle: "#1E293B",
    medium: "#334155",
  },
  bubble: {
    user: "#1D4ED8",
    userBorder: "#3B82F6",
    assistant: "#111820",
    assistantBorder: "#1E293B",
  },
  status: {
    connecting: "#FBBF24",
    connected: "#22C55E",
    disconnected: "#EF4444",
  },
  log: {
    thought: "#FBBF24",
    action: "#22C55E",
    observation: "#22D3EE",
    error: "#EF4444",
    done: "#A78BFA",
    status: "#64748B",
  },
};

export const lightPalette: ColorPalette = {
  bg: {
    primary: "#FFFFFF",
    secondary: "#F8FAFC",
    tertiary: "#F1F5F9",
    elevated: "#E2E8F0",
  },
  text: {
    primary: "#0F172A",
    secondary: "#475569",
    muted: "#94A3B8",
    inverse: "#F1F5F9",
  },
  accent: {
    blue: "#2563EB",
    blueDim: "#1D4ED8",
    green: "#16A34A",
    yellow: "#D97706",
    red: "#DC2626",
    purple: "#7C3AED",
    cyan: "#0891B2",
  },
  border: {
    subtle: "#E2E8F0",
    medium: "#CBD5E1",
  },
  bubble: {
    user: "#2563EB",
    userBorder: "#3B82F6",
    assistant: "#F1F5F9",
    assistantBorder: "#E2E8F0",
  },
  status: {
    connecting: "#D97706",
    connected: "#16A34A",
    disconnected: "#DC2626",
  },
  log: {
    thought: "#D97706",
    action: "#16A34A",
    observation: "#0891B2",
    error: "#DC2626",
    done: "#7C3AED",
    status: "#94A3B8",
  },
};

// Backward-compatible default export for existing code
export const colors = darkPalette;
