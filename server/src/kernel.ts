/**
 * Kernel adapter — bridges OpenClaw plugin API with ClawFlow server modules.
 *
 * In plugin mode: the OpenClawPluginApi is injected via `bindPluginApi()`.
 * In standalone mode: all helpers return null/fallback values.
 */

import type { PluginLogger, AgentEvent } from "./plugin-types";
import { emitEvent } from "./ws-manager";

// The actual OpenClawPluginApi — typed as `any` here to avoid hard
// dependency on the SDK package (it only exists inside OpenClaw runtime).
let pluginApi: any = null;

export const isPluginMode = () => pluginApi !== null;

export const bindPluginApi = (api: any) => {
  pluginApi = api;
};

export const getPluginApi = () => pluginApi;

// ── Config ──────────────────────────────────────────────────────────

export const getLoadedConfig = (): any | null => {
  if (!pluginApi) return null;
  try {
    return pluginApi.runtime.config.loadConfig();
  } catch {
    return pluginApi.config ?? null;
  }
};

export const getWorkspaceDirFromKernel = (): string | null => {
  const config = getLoadedConfig();
  return config?.agents?.defaults?.workspace ?? null;
};

export const getPortFromKernel = (): number | null => {
  const config = getLoadedConfig();
  return config?.gateway?.port ?? null;
};

export const getTokenFromKernel = (): string | null => {
  const config = getLoadedConfig();
  return config?.gateway?.auth?.token ?? null;
};

// ── Session ─────────────────────────────────────────────────────────

export const resolveSessionStorePath = (): string | null => {
  if (!pluginApi) return null;
  try {
    return pluginApi.runtime.channel.session.resolveStorePath();
  } catch {
    return null;
  }
};

// ── Event broadcast (plugin hooks → WebSocket clients) ──────────────

export const broadcastAgentEvent = (evt: AgentEvent) => {
  const sessionId = evt.sessionId ?? evt.sessionKey;
  if (!sessionId) return;

  emitEvent({
    type: evt.type as any,
    sessionId,
    messageId: (evt.data as any)?.messageId,
    payload: evt.data ?? {},
  });
};

// ── Logger ──────────────────────────────────────────────────────────

export const log = {
  info: (...args: unknown[]) => {
    if (pluginApi?.logger) pluginApi.logger.info(`[viewclaw] ${args.join(" ")}`);
    else console.log("[viewclaw]", ...args);
  },
  warn: (...args: unknown[]) => {
    if (pluginApi?.logger) pluginApi.logger.warn(`[viewclaw] ${args.join(" ")}`);
    else console.warn("[viewclaw]", ...args);
  },
  error: (...args: unknown[]) => {
    if (pluginApi?.logger) pluginApi.logger.error(`[viewclaw] ${args.join(" ")}`);
    else console.error("[viewclaw]", ...args);
  },
  debug: (...args: unknown[]) => {
    if (pluginApi?.logger?.debug) pluginApi.logger.debug(`[viewclaw] ${args.join(" ")}`);
    else console.debug("[viewclaw]", ...args);
  },
};
