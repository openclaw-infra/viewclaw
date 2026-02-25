export const colors = {
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
} as const;
