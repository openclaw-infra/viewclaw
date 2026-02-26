export type SlashCommand = {
  id: string;
  command: string;
  label: string;
  description: string;
  category: "openclaw" | "custom";
  /** If set, selecting this command fills the input with this text instead of the command */
  fillText?: string;
  /** If true, command is sent immediately on selection (no further input needed) */
  immediate?: boolean;
};

type SlashCommandDef = Omit<SlashCommand, "description"> & {
  descKey: string;
};

const COMMAND_DEFS: SlashCommandDef[] = [
  { id: "oc-status", command: "/status", label: "Status", descKey: "slashCommand.statusDesc", category: "openclaw", immediate: true },
  { id: "oc-model", command: "/model", label: "Model", descKey: "slashCommand.modelDesc", category: "openclaw", fillText: "/model " },
  { id: "oc-restart", command: "/restart", label: "Restart", descKey: "slashCommand.restartDesc", category: "openclaw", immediate: true },
  { id: "oc-clear", command: "/clear", label: "Clear", descKey: "slashCommand.clearDesc", category: "openclaw", immediate: true },
  { id: "oc-help", command: "/help", label: "Help", descKey: "slashCommand.helpDesc", category: "openclaw", immediate: true },
  { id: "oc-compact", command: "/compact", label: "Compact", descKey: "slashCommand.compactDesc", category: "openclaw", immediate: true },
  { id: "oc-cost", command: "/cost", label: "Cost", descKey: "slashCommand.costDesc", category: "openclaw", immediate: true },
  { id: "cu-fix", command: "/fix", label: "Fix", descKey: "slashCommand.fixDesc", category: "custom", fillText: "/fix " },
  { id: "cu-explain", command: "/explain", label: "Explain", descKey: "slashCommand.explainDesc", category: "custom", fillText: "/explain " },
  { id: "cu-review", command: "/review", label: "Review", descKey: "slashCommand.reviewDesc", category: "custom", fillText: "/review " },
  { id: "cu-test", command: "/test", label: "Test", descKey: "slashCommand.testDesc", category: "custom", fillText: "/test " },
  { id: "cu-refactor", command: "/refactor", label: "Refactor", descKey: "slashCommand.refactorDesc", category: "custom", fillText: "/refactor " },
];

export const getSlashCommands = (t: (key: string) => string): SlashCommand[] =>
  COMMAND_DEFS.map((def) => ({
    ...def,
    description: t(def.descKey),
  }));
