export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type GatewayEventType =
  | "connected"
  | "message"
  | "message_start"
  | "message_delta"
  | "message_done"
  | "thought"
  | "action"
  | "observation"
  | "error"
  | "done"
  | "status";

export type GatewayEvent = {
  type: GatewayEventType;
  sessionId: string;
  messageId?: string;
  seq: number;
  ts: number;
  payload: Record<string, unknown>;
};

export type ImageAttachment = {
  uri: string;
  width: number;
  height: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  localStatus?: "sending" | "failed";
  thinking?: string;
  thinkingSummary?: string;
  streaming?: boolean;
  images?: ImageAttachment[];
  createdAt: number;
};

export type ExecutionLog = {
  id: string;
  messageId?: string;
  level: "thought" | "action" | "observation" | "error" | "done" | "status";
  text: string;
  detail?: string;
  toolName?: string;
  createdAt: number;
};

export type StreamItem =
  | { kind: "message"; data: ChatMessage }
  | { kind: "log"; data: ExecutionLog }
  | { kind: "typing"; id: string };

export type SessionInfo = {
  id: string;
  agentId: string;
  sessionKey?: string;
  jsonlPath: string;
  createdAt: string;
  title?: string;
};

export type AgentInfo = {
  id: string;
  sessionCount: number;
  model?: string;
  workspace?: string;
};

export type GatewayConfig = {
  id: string;
  label: string;
  url: string;
  createdAt: number;
};

export type SessionContext = {
  usedTokens: number;
  maxTokens: number;
  percent: number;
  model: string;
  lastInput: number;
  lastOutput: number;
  cacheRead: number;
  totalCost: number;
};
