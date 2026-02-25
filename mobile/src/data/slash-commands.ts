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

export const SLASH_COMMANDS: SlashCommand[] = [
  // --- OpenClaw built-in ---
  {
    id: "oc-status",
    command: "/status",
    label: "Status",
    description: "查看当前 Agent 运行状态",
    category: "openclaw",
    immediate: true,
  },
  {
    id: "oc-model",
    command: "/model",
    label: "Model",
    description: "查看或切换当前使用的模型",
    category: "openclaw",
    fillText: "/model ",
  },
  {
    id: "oc-restart",
    command: "/restart",
    label: "Restart",
    description: "重启当前 Agent 会话",
    category: "openclaw",
    immediate: true,
  },
  {
    id: "oc-clear",
    command: "/clear",
    label: "Clear",
    description: "清除当前会话上下文",
    category: "openclaw",
    immediate: true,
  },
  {
    id: "oc-help",
    command: "/help",
    label: "Help",
    description: "显示可用指令列表",
    category: "openclaw",
    immediate: true,
  },
  {
    id: "oc-compact",
    command: "/compact",
    label: "Compact",
    description: "压缩对话历史以节省上下文窗口",
    category: "openclaw",
    immediate: true,
  },
  {
    id: "oc-cost",
    command: "/cost",
    label: "Cost",
    description: "查看当前会话的 Token 用量和费用",
    category: "openclaw",
    immediate: true,
  },
  // --- Custom ---
  {
    id: "cu-fix",
    command: "/fix",
    label: "Fix",
    description: "修复上一次操作中出现的问题",
    category: "custom",
    fillText: "/fix ",
  },
  {
    id: "cu-explain",
    command: "/explain",
    label: "Explain",
    description: "解释选中的代码或最近的操作",
    category: "custom",
    fillText: "/explain ",
  },
  {
    id: "cu-review",
    command: "/review",
    label: "Review",
    description: "审查最近的代码变更",
    category: "custom",
    fillText: "/review ",
  },
  {
    id: "cu-test",
    command: "/test",
    label: "Test",
    description: "为指定功能生成测试用例",
    category: "custom",
    fillText: "/test ",
  },
  {
    id: "cu-refactor",
    command: "/refactor",
    label: "Refactor",
    description: "重构指定的代码片段",
    category: "custom",
    fillText: "/refactor ",
  },
];
