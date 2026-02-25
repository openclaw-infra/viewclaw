import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { OPENCLAW_BASE_URL, OPENCLAW_HOME, getGatewayToken, normalizeToken } from "./config";
import type { SessionInfo, AgentInfo } from "./types";

const sessionKeyCache = new Map<string, string>();

const buildAuthHeaders = async (overrideToken?: string): Promise<Record<string, string>> => {
  const token = normalizeToken(overrideToken) || (await getGatewayToken());
  if (!token) return {};
  return { authorization: `Bearer ${token}` };
};

export const sendMessage = async (body: {
  content: string;
  agentId?: string;
  sessionKey?: string;
  overrideToken?: string;
}): Promise<{
  ok: boolean;
  status?: number;
  responseId?: string;
  error?: string;
}> => {
  const url = `${OPENCLAW_BASE_URL}/v1/responses`;
  const authHeaders = await buildAuthHeaders(body.overrideToken);
  const agentId = body.agentId ?? "main";

  const requestBody: Record<string, unknown> = {
    model: `openclaw:${agentId}`,
    input: body.content,
    stream: false,
  };

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
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, status: response.status, error: text };
    }

    const data = await response.json() as { id?: string };
    return { ok: true, status: response.status, responseId: data.id };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
};

export const checkHealth = async (): Promise<{
  ok: boolean;
  reachable: boolean;
  status?: number;
  error?: string;
}> => {
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

export const listAgents = async (): Promise<AgentInfo[]> => {
  const agentsDir = join(OPENCLAW_HOME, "agents");
  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    const agents: AgentInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const sessionsDir = join(agentsDir, entry.name, "sessions");
      let sessionCount = 0;
      try {
        const sessionFiles = await readdir(sessionsDir);
        sessionCount = sessionFiles.filter((f) => f.endsWith(".jsonl")).length;
      } catch { /* no sessions dir */ }

      agents.push({
        id: entry.name,
        sessionsDir,
        sessionCount,
      });
    }

    return agents;
  } catch {
    return [];
  }
};

export const listSessions = async (agentId: string = "main"): Promise<SessionInfo[]> => {
  try {
    const authHeaders = await buildAuthHeaders();
    const res = await fetch(`${OPENCLAW_BASE_URL}/tools/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({ tool: "sessions_list", action: "json", args: {} }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json() as {
        ok: boolean;
        result?: {
          details?: {
            sessions?: Array<{
              key: string;
              sessionId: string;
              updatedAt?: number;
              transcriptPath?: string;
              channel?: string;
            }>;
          };
        };
      };
      const raw = data.result?.details?.sessions ?? [];
      const sessions: SessionInfo[] = [];
      for (const s of raw) {
        if (!s.sessionId) continue;
        sessionKeyCache.set(s.sessionId, s.key);
        const defaultPath = join(OPENCLAW_HOME, "agents", agentId, "sessions", `${s.sessionId}.jsonl`);
        sessions.push({
          id: s.sessionId,
          agentId,
          sessionKey: s.key,
          jsonlPath: defaultPath,
          createdAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : "",
        });
      }
      sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (sessions.length > 0) return sessions;
    }
  } catch { /* fallback to filesystem */ }

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
    return sessions;
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

export const resolveSessionKey = async (sessionId: string): Promise<string> => {
  const cached = sessionKeyCache.get(sessionId);
  if (cached) return cached;

  try {
    const authHeaders = await buildAuthHeaders();
    const res = await fetch(`${OPENCLAW_BASE_URL}/tools/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({ tool: "sessions_list", action: "json", args: {} }),
    });
    if (res.ok) {
      const data = await res.json() as {
        ok: boolean;
        result?: { details?: { sessions?: Array<{ sessionId: string; key: string }> } };
      };
      const sessions = data.result?.details?.sessions ?? [];
      for (const s of sessions) {
        if (s.sessionId) sessionKeyCache.set(s.sessionId, s.key);
      }
    }
  } catch { /* ignore */ }

  return sessionKeyCache.get(sessionId) ?? "main";
};

export const getActiveSessionId = async (agentId: string = "main"): Promise<string | null> => {
  const sessions = await listSessions(agentId);
  return sessions.length > 0 ? sessions[0].id : null;
};
