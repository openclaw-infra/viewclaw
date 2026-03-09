export type ThemeMode = "light" | "dark" | "system";

export type ColorPalette = {
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    elevated: string;
    codeBlock: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  brand: {
    blue: string;
    purple: string;
    gradient: [string, string];
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
  state: {
    running: string;
    success: string;
    warning: string;
    error: string;
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
    primary: "#0F1115",
    secondary: "#1C1F26",
    tertiary: "#272A30",
    elevated: "#2F3338",
    codeBlock: "#000000",
  },
  text: {
    primary: "#F1F5F9",
    secondary: "#94A3B8",
    muted: "#64748B",
    inverse: "#0F172A",
  },
  brand: {
    blue: "#2CB5E8",
    purple: "#8E2DE2",
    gradient: ["#2CB5E8", "#8E2DE2"],
  },
  accent: {
    blue: "#3B82F6",
    blueDim: "#2563EB",
    green: "#10B981",
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
    user: "#1A3A6E",
    userBorder: "#2CB5E8",
    assistant: "#1C1F26",
    assistantBorder: "#272A30",
  },
  status: {
    connecting: "#F59E0B",
    connected: "#10B981",
    disconnected: "#EF4444",
  },
  state: {
    running: "#3B82F6",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
  },
  log: {
    thought: "#F59E0B",
    action: "#10B981",
    observation: "#22D3EE",
    error: "#EF4444",
    done: "#A78BFA",
    status: "#64748B",
  },
};

export const lightPalette: ColorPalette = {
  bg: {
    primary: "#F9FAFB",
    secondary: "#FFFFFF",
    tertiary: "#F3F4F6",
    elevated: "#E5E7EB",
    codeBlock: "#E5E7EB",
  },
  text: {
    primary: "#0F172A",
    secondary: "#475569",
    muted: "#94A3B8",
    inverse: "#F1F5F9",
  },
  brand: {
    blue: "#2CB5E8",
    purple: "#8E2DE2",
    gradient: ["#2CB5E8", "#8E2DE2"],
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
    assistant: "#FFFFFF",
    assistantBorder: "#E2E8F0",
  },
  status: {
    connecting: "#D97706",
    connected: "#16A34A",
    disconnected: "#DC2626",
  },
  state: {
    running: "#3B82F6",
    success: "#16A34A",
    warning: "#D97706",
    error: "#DC2626",
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

export const colors = darkPalette;
