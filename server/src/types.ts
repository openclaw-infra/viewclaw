export type EventType =
  | "connected"
  | "message"
  | "message_delta"
  | "message_start"
  | "message_done"
  | "thought"
  | "action"
  | "observation"
  | "error"
  | "done"
  | "status";

export type StreamEvent = {
  type: EventType;
  sessionId: string;
  messageId?: string;
  seq: number;
  ts: number;
  payload: Record<string, unknown>;
};

export type ClientMessage =
  | { type: "ping" }
  | {
      type: "send_message";
      sessionId: string;
      messageId?: string;
      content: string;
      imagePaths?: string[];
      agentId?: string;
    }
  | {
      type: "subscribe_session";
      sessionId: string;
      agentId?: string;
    }
  | {
      type: "unsubscribe_session";
      sessionId: string;
    };

export type OpenClawJsonlEntry = {
  type: string;
  id: string;
  parentId?: string | null;
  timestamp: string;
  [key: string]: unknown;
};

export type OpenClawMessage = OpenClawJsonlEntry & {
  type: "message";
  message: {
    role: "user" | "assistant" | "toolResult";
    content?: Array<{
      type: string;
      text?: string;
      thinking?: string;
      id?: string;
      name?: string;
      arguments?: Record<string, unknown>;
      [key: string]: unknown;
    }>;
    toolCallId?: string;
    toolName?: string;
    usage?: Record<string, unknown>;
    stopReason?: string;
    [key: string]: unknown;
  };
};

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
  sessionsDir: string;
  sessionCount: number;
  model?: string;
  workspace?: string;
  instructions?: string;
};
