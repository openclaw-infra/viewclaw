/**
 * Lightweight type stubs for the OpenClaw plugin SDK.
 *
 * These are used internally so that `server/src/*.ts` files can reference
 * plugin concepts without importing the full SDK (which is only available
 * when running inside OpenClaw).
 */

export interface PluginLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug?: (message: string) => void;
}

export interface AgentEvent {
  type: string;
  sessionKey: string;
  sessionId?: string;
  agentId?: string;
  data?: Record<string, unknown>;
}
