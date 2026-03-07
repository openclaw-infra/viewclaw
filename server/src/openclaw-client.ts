import { readdir, stat, readFile, access } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { OPENCLAW_BASE_URL, OPENCLAW_HOME, getGatewayToken, normalizeToken } from "./config";
import { isPluginMode, getWorkspaceDirFromKernel, getLoadedConfig } from "./kernel";
import { sendBridgeRequest } from "./plugin-bridge";
import type { SessionInfo, AgentInfo } from "./types";

const sessionKeyCache = new Map<string, string>();

const looksLikeSessionKey = (value: string): boolean =>
  value === "main" || value.startsWith("agent:") || value.startsWith("cron:") || value.startsWith("hook:") || value.startsWith("node-");

export const getWorkspaceDir = async (): Promise<string> => {
  if (isPluginMode()) {
    const ws = getWorkspaceDirFromKernel();
    if (ws) return ws;
  }
  try {
    const configPath = join(OPENCLAW_HOME, "openclaw.json");
    const raw = await readFile(configPath, "utf8");
    const config = JSON.parse(raw);
    return config?.agents?.defaults?.workspace ?? join(OPENCLAW_HOME, "workspace");
  } catch {
    return join(OPENCLAW_HOME, "workspace");
  }
};

const buildAuthHeaders = async (overrideToken?: string): Promise<Record<string, string>> => {
  const token = normalizeToken(overrideToken) || (await getGatewayToken());
  if (!token) return {};
  return { authorization: `Bearer ${token}` };
};

export type StreamCallback = (event: {
  type: "message_start" | "message_delta" | "message_done";
  messageId: string;
  delta?: string;
  content?: string;
}) => void;

export const sendMessage = async (body: {
  content: string;
  imagePaths?: string[];
  agentId?: string;
  sessionKey?: string;
  replyToId?: string;
  replyToBody?: string;
  replyToSender?: string;
  threadId?: string;
  overrideToken?: string;
  onStream?: StreamCallback;
  signal?: AbortSignal;
}): Promise<{
  ok: boolean;
  status?: number;
  responseId?: string;
  error?: string;
  aborted?: boolean;
}> => {
  const url = `${OPENCLAW_BASE_URL}/v1/responses`;
  const authHeaders = await buildAuthHeaders(body.overrideToken);
  const agentId = body.agentId ?? "main";
  const streaming = !!body.onStream;

  let finalContent = body.content;
  if (body.imagePaths?.length) {
    const fileRefs = body.imagePaths
      .map((p) => `[Attached image: ${p}]`)
      .join("\n");
    finalContent = finalContent
      ? `${fileRefs}\n\n${finalContent}`
      : fileRefs;
  }

  const requestBody: Record<string, unknown> = {
    model: `openclaw:${agentId}`,
    input: finalContent,
    stream: streaming,
  };

  if (process.env.CLAWFLOW_PLUGIN_MODE === "1") {
    if (body.signal?.aborted) return { ok: true, aborted: true };
    try {
      const run = sendBridgeRequest<{ content?: string; responseId?: string }>("send_message", {
        content: finalContent,
        agentId,
        sessionKey: body.sessionKey ?? null,
        forceNewSession: !body.sessionKey,
        replyToId: body.replyToId ?? null,
        replyToBody: body.replyToBody ?? null,
        replyToSender: body.replyToSender ?? null,
        threadId: body.threadId ?? null,
      });
      const result = body.signal
        ? await Promise.race([
            run,
            new Promise<never>((_, reject) => {
              body.signal!.addEventListener("abort", () => reject(new Error("AbortError")), { once: true });
            }),
          ])
        : await run;

      if (streaming) {
        const msgId = `stream-msg-${Date.now()}`;
        body.onStream!({ type: "message_start", messageId: msgId });
        if (result.content) {
          body.onStream!({ type: "message_delta", messageId: msgId, delta: result.content });
        }
        body.onStream!({ type: "message_done", messageId: msgId, content: result.content ?? "" });
      }
      return { ok: true, status: 200, responseId: result.responseId };
    } catch (error) {
      const message = (error as Error).message;
      if (message === "AbortError" || body.signal?.aborted) return { ok: true, aborted: true };
      return { ok: false, error: message };
    }
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders,
        "x-openclaw-agent-id": agentId,
        ...(body.sessionKey ? { "x-openclaw-session-key": body.sessionKey } : {}),
      },
      body: JSON.stringify(requestBody),
      signal: body.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, status: response.status, error: text };
    }

    if (!streaming) {
      const data = await response.json() as { id?: string };
      return { ok: true, status: response.status, responseId: data.id };
    }

    let responseId = "";
    let currentMsgId = "";
    let fullText = "";

    const reader = response.body?.getReader();
    if (!reader) return { ok: false, error: "No response body" };

    const decoder = new TextDecoder();
    let remainder = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        remainder += decoder.decode(value, { stream: true });
        const lines = remainder.split("\n");
        remainder = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;

            try {
              const evt = JSON.parse(raw);

              if (evt.type === "response.created") {
                responseId = evt.response?.id ?? "";
              }

              if (evt.type === "response.output_item.added" && evt.item?.role === "assistant") {
                currentMsgId = evt.item.id ?? `stream-msg-${Date.now()}`;
                body.onStream!({ type: "message_start", messageId: currentMsgId });
              }

              if (evt.type === "response.output_text.delta" && evt.delta) {
                fullText += evt.delta;
                body.onStream!({ type: "message_delta", messageId: currentMsgId, delta: evt.delta });
              }

              if (evt.type === "response.completed") {
                body.onStream!({ type: "message_done", messageId: currentMsgId, content: fullText });
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { ok: true, status: response.status, responseId };
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "AbortError" || body.signal?.aborted) {
      return { ok: true, aborted: true };
    }
    return { ok: false, error: (error as Error).message };
  }
};

export const checkHealth = async (): Promise<{
  ok: boolean;
  reachable: boolean;
  status?: number;
  error?: string;
}> => {
  if (isPluginMode()) {
    return { ok: true, reachable: true, status: 200 };
  }
  try {
    const response = await fetch(`${OPENCLAW_BASE_URL}/`, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return { ok: true, reachable: true, status: response.status };
  } catch (error) {
    return { ok: false, reachable: false, error: (error as Error).message };
  }
};

const readAgentConfig = async (agentDir: string): Promise<{
  model?: string;
  workspace?: string;
  instructions?: string;
}> => {
  const candidates = ["agent.json", "config.json", "openclaw-agent.json"];
  for (const filename of candidates) {
    try {
      const configPath = join(agentDir, filename);
      await access(configPath);
      const raw = await readFile(configPath, "utf8");
      const config = JSON.parse(raw);
      return {
        model: config.model ?? config.defaultModel ?? undefined,
        workspace: config.workspace ?? config.cwd ?? undefined,
        instructions: typeof config.instructions === "string"
          ? config.instructions.slice(0, 500)
          : typeof config.systemPrompt === "string"
            ? config.systemPrompt.slice(0, 500)
            : undefined,
      };
    } catch { /* try next */ }
  }

  try {
    const mdPath = join(agentDir, "AGENTS.md");
    await access(mdPath);
    const raw = await readFile(mdPath, "utf8");
    return { instructions: raw.slice(0, 500) };
  } catch { /* no config */ }

  return {};
};

export const listAgents = async (): Promise<AgentInfo[]> => {
  const agentsDir = join(OPENCLAW_HOME, "agents");
  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    const agents: AgentInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const agentDir = join(agentsDir, entry.name);
      const sessionsDir = join(agentDir, "sessions");
      let sessionCount = 0;
      try {
        const sessionFiles = await readdir(sessionsDir);
        sessionCount = sessionFiles.filter((f) => f.endsWith(".jsonl")).length;
      } catch { /* no sessions dir */ }

      const config = await readAgentConfig(agentDir);

      agents.push({
        id: entry.name,
        sessionsDir,
        sessionCount,
        ...config,
      });
    }

    return agents;
  } catch {
    return [];
  }
};

const extractSessionTitle = async (jsonlPath: string): Promise<string | undefined> => {
  try {
    const raw = await readFile(jsonlPath, "utf8");
    const lines = raw.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed);
        if (entry.type !== "message" || !entry.message) continue;
        if (entry.message.role !== "user") continue;
        const contents = entry.message.content ?? [];
        const text = contents
          .filter((c: any) => c.type === "text" && c.text)
          .map((c: any) => c.text)
          .join(" ")
          .replace(/\[Attached image:[^\]]*\]/g, "")
          .trim();
        if (text) return text.length > 50 ? text.slice(0, 50) + "..." : text;
      } catch { /* skip malformed */ }
    }
  } catch { /* file not readable */ }
  return undefined;
};

const populateTitles = async (sessions: SessionInfo[]): Promise<SessionInfo[]> => {
  const results = await Promise.all(
    sessions.map(async (s) => {
      const title = await extractSessionTitle(s.jsonlPath);
      return title ? { ...s, title } : s;
    }),
  );
  return results;
};

type SessionStoreEntry = {
  sessionId?: string;
  updatedAt?: number;
  sessionFile?: string;
};

const getKnownAgentIds = async (): Promise<string[]> => {
  const configured = getLoadedConfig()?.agents?.list;
  if (Array.isArray(configured) && configured.length > 0) {
    return configured
      .map((a) => (typeof a?.id === "string" ? a.id : ""))
      .filter((id) => id.length > 0);
  }

  try {
    const entries = await readdir(join(OPENCLAW_HOME, "agents"), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
};

const readSessionStore = async (agentId: string): Promise<Record<string, SessionStoreEntry>> => {
  try {
    const raw = await readFile(join(OPENCLAW_HOME, "agents", agentId, "sessions", "sessions.json"), "utf8");
    return JSON.parse(raw) as Record<string, SessionStoreEntry>;
  } catch {
    return {};
  }
};

const resolveStoreJsonlPath = async (
  agentId: string,
  sessionId: string,
  sessionFile?: string,
): Promise<string | null> => {
  const fallback = join(OPENCLAW_HOME, "agents", agentId, "sessions", `${sessionId}.jsonl`);
  if (sessionFile && sessionFile.trim().length > 0) {
    const candidate = isAbsolute(sessionFile) ? sessionFile : join(OPENCLAW_HOME, sessionFile);
    const exists = await access(candidate).then(() => true, () => false);
    if (exists) return candidate;
  }
  const fallbackExists = await access(fallback).then(() => true, () => false);
  return fallbackExists ? fallback : null;
};

export const listSessions = async (agentId: string = "main"): Promise<SessionInfo[]> => {
  const store = await readSessionStore(agentId);
  const sessionsFromStore: SessionInfo[] = [];
  for (const [key, value] of Object.entries(store)) {
    if (!value?.sessionId) continue;
    const jsonlPath = await resolveStoreJsonlPath(agentId, value.sessionId, value.sessionFile);
    if (!jsonlPath) continue;
    sessionKeyCache.set(value.sessionId, key);
    sessionsFromStore.push({
      id: value.sessionId,
      agentId,
      sessionKey: key,
      jsonlPath,
      createdAt: value.updatedAt ? new Date(value.updatedAt).toISOString() : "",
    });
  }
  if (sessionsFromStore.length > 0) {
    sessionsFromStore.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return populateTitles(sessionsFromStore);
  }

  const sessionsDir = join(OPENCLAW_HOME, "agents", agentId, "sessions");
  try {
    const files = await readdir(sessionsDir);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl") && f !== "sessions.json");
    const sessions: SessionInfo[] = [];
    for (const file of jsonlFiles) {
      const filePath = join(sessionsDir, file);
      const fileStat = await stat(filePath).catch(() => null);
      sessions.push({
        id: file.replace(".jsonl", ""),
        agentId,
        jsonlPath: filePath,
        createdAt: fileStat?.birthtime?.toISOString() ?? "",
      });
    }
    sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return populateTitles(sessions);
  } catch {
    return [];
  }
};

export const getSessionJsonlPath = async (agentId: string, sessionId: string): Promise<string> => {
  const sessions = await listSessions(agentId);
  const match = sessions.find((s) => s.id === sessionId);
  if (match?.jsonlPath) {
    const exists = await stat(match.jsonlPath).catch(() => null);
    if (exists) return match.jsonlPath;
  }
  return join(OPENCLAW_HOME, "agents", agentId, "sessions", `${sessionId}.jsonl`);
};

const resolveSessionKeyFromStore = async (sessionId: string, agentId?: string): Promise<string | null> => {
  const candidateAgentIds = agentId ? [agentId] : await getKnownAgentIds();

  for (const aid of candidateAgentIds) {
    const parsed = await readSessionStore(aid);
    for (const [key, value] of Object.entries(parsed)) {
      if (value?.sessionId === sessionId) {
        return key;
      }
    }
  }

  return null;
};

export const resolveSessionKey = async (sessionIdOrKey: string, agentId?: string): Promise<string | null> => {
  if (!sessionIdOrKey) return null;
  if (looksLikeSessionKey(sessionIdOrKey)) return sessionIdOrKey;

  const cached = sessionKeyCache.get(sessionIdOrKey);
  if (cached) return cached;

  const fromStore = await resolveSessionKeyFromStore(sessionIdOrKey, agentId);
  if (fromStore) {
    sessionKeyCache.set(sessionIdOrKey, fromStore);
    return fromStore;
  }

  return null;
};

export const getActiveSessionId = async (agentId: string = "main"): Promise<string | null> => {
  const store = await readSessionStore(agentId);
  let active: { id: string; updatedAt: number } | null = null;
  for (const value of Object.values(store)) {
    if (!value?.sessionId) continue;
    const ts = typeof value.updatedAt === "number" ? value.updatedAt : 0;
    if (!active || ts > active.updatedAt) {
      active = { id: value.sessionId, updatedAt: ts };
    }
  }
  if (active?.id) return active.id;
  const sessions = await listSessions(agentId);
  return sessions.length > 0 ? sessions[0].id : null;
};

type MatchCreatedSessionParams = {
  agentId?: string;
  baselineSessionIds?: Iterable<string>;
  responseId?: string;
  notBeforeMs?: number;
};

export const matchCreatedSession = async ({
  agentId = "main",
  baselineSessionIds,
  responseId,
  notBeforeMs,
}: MatchCreatedSessionParams): Promise<SessionInfo | null> => {
  const sessions = await listSessions(agentId);
  const baseline = new Set(baselineSessionIds ?? []);

  const byBaseline = sessions.filter((s) => !baseline.has(s.id));
  if (byBaseline.length === 1) return byBaseline[0];

  let candidates = byBaseline;
  if (candidates.length === 0 && typeof notBeforeMs === "number") {
    candidates = sessions.filter((s) => {
      const t = Date.parse(s.createdAt);
      return Number.isFinite(t) && t >= notBeforeMs - 2_000;
    });
    if (candidates.length === 1) return candidates[0];
  }

  if (responseId && candidates.length > 0) {
    const matched: SessionInfo[] = [];
    for (const candidate of candidates) {
      try {
        const raw = await readFile(candidate.jsonlPath, "utf8");
        if (raw.includes(responseId)) matched.push(candidate);
      } catch {
        // ignore unreadable candidate
      }
    }
    if (matched.length === 1) return matched[0];
  }

  return null;
};

export const createSession = async (body: {
  agentId?: string;
  initialMessage?: string;
  overrideToken?: string;
}): Promise<{
  ok: boolean;
  sessionId?: string;
  sessionKey?: string;
  error?: string;
}> => {
  const agentId = body.agentId ?? "main";
  const input = body.initialMessage || "hello";
  const startedAt = Date.now();
  const before = await listSessions(agentId);
  const beforeIds = new Set(before.map((s) => s.id));

  try {
    const data = await sendMessage({
      content: input,
      agentId,
      signal: undefined,
    });
    if (!data.ok) {
      return { ok: false, error: data.error ?? "Failed to create session" };
    }
    const created = await matchCreatedSession({
      agentId,
      baselineSessionIds: beforeIds,
      responseId: data.responseId,
      notBeforeMs: startedAt,
    });
    if (created) {
      return { ok: true, sessionId: created.id, sessionKey: created.sessionKey };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
};
