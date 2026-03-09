import { Elysia, t } from "elysia";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { PORT, OPENCLAW_BASE_URL, OPENCLAW_HOME, WHISPER_API_URL, WHISPER_API_KEY, WHISPER_MODEL } from "./config";
import { emitEventTo, subscribeSession, unsubscribeAll, getSessionSubscriberCount, unsubscribeSession } from "./ws-manager";
import { startWatcher, stopWatcher, isWatching, getActiveWatchers, classifyEntry, muteWatcher, unmuteWatcher, isEventBusBridgeActive, startEventBusBridge } from "./jsonl-watcher";
import type { OpenClawJsonlEntry, OpenClawMessage, EventType } from "./types";
import { initPluginBridge } from "./plugin-bridge";
import {
  sendMessage,
  checkHealth,
  listAgents,
  listSessions,
  getSessionJsonlPath,
  getActiveSessionId,
  resolveSessionKey,
  createSession,
  matchCreatedSession,
} from "./openclaw-client";
import type { ClientMessage } from "./types";
import { isPluginMode } from "./kernel";
import { buildRoutingKey, normalizeAgentId } from "./routing";
import { sanitizeDisplayText, sanitizeWithReplyPreview } from "./sanitize";

const activeRuns = new Map<string, Set<AbortController>>();
const pendingSessionCreates = new Map<string, { agentId: string; startedAt: number }>();

const addActiveRun = (routingKey: string, controller: AbortController) => {
  const set = activeRuns.get(routingKey) ?? new Set<AbortController>();
  set.add(controller);
  activeRuns.set(routingKey, set);
};

const removeActiveRun = (routingKey: string, controller: AbortController) => {
  const set = activeRuns.get(routingKey);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) activeRuns.delete(routingKey);
};
const NEW_SESSION_PENDING_TTL_MS = Number(process.env.CLAWFLOW_NEW_SESSION_PENDING_TTL_MS ?? 45_000);
const NEW_SESSION_MATCH_RETRIES = Number(process.env.CLAWFLOW_NEW_SESSION_MATCH_RETRIES ?? 12);
const NEW_SESSION_MATCH_RETRY_DELAY_MS = Number(process.env.CLAWFLOW_NEW_SESSION_MATCH_RETRY_DELAY_MS ?? 750);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const pruneStalePendingSessionCreates = () => {
  const now = Date.now();
  for (const [sessionId, pending] of pendingSessionCreates) {
    if (now - pending.startedAt > NEW_SESSION_PENDING_TTL_MS) {
      pendingSessionCreates.delete(sessionId);
    }
  }
};

if (process.env.CLAWFLOW_PLUGIN_MODE === "1") {
  initPluginBridge((evt) => {
    const payload = evt.payload ?? evt.data ?? {};
    const routingKey = buildRoutingKey({
      sessionId: evt.sessionId ?? evt.sessionKey ?? "",
      agentId: typeof payload.agentId === "string" ? payload.agentId : undefined,
    });
    emitEventTo(routingKey, {
      type: (evt.type ?? "status") as EventType,
      sessionId: evt.sessionId ?? evt.sessionKey ?? "",
      messageId: evt.messageId,
      payload,
    });
  });
}

const CONTEXT_WINDOWS: Record<string, number> = {
  "gpt-5.3-codex": 200_000,
  "gpt-4.1": 1_000_000,
  "gpt-4.1-mini": 1_000_000,
  "gpt-4.1-nano": 1_000_000,
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "o3": 200_000,
  "o3-mini": 200_000,
  "o4-mini": 200_000,
  "claude-sonnet-4-20250514": 200_000,
  "claude-opus-4-20250514": 200_000,
  "claude-4.6-opus": 200_000,
  "claude-4-sonnet": 200_000,
  "claude-3.5-sonnet": 200_000,
  "claude-3-opus": 200_000,
  "claude-3-haiku": 200_000,
};

const resolveContextWindow = (model?: string): number => {
  if (!model) return 200_000;
  const exact = CONTEXT_WINDOWS[model];
  if (exact) return exact;
  for (const [key, val] of Object.entries(CONTEXT_WINDOWS)) {
    if (model.includes(key)) return val;
  }
  if (model.includes("gpt-4")) return 128_000;
  if (model.includes("gpt-5")) return 200_000;
  if (model.includes("claude")) return 200_000;
  if (model.includes("o3") || model.includes("o4")) return 200_000;
  return 200_000;
};

export const app = new Elysia()
  .get("/", () => ({
    name: "ClawFlow Gateway",
    version: "2.0.0",
    ok: true,
  }))

  .get("/healthz", async () => {
    const upstream = await checkHealth();
    return {
      ok: true,
      now: Date.now(),
      mode: isPluginMode() ? "plugin" : "standalone",
      openclawHome: OPENCLAW_HOME,
      upstream: isPluginMode()
        ? undefined
        : {
            url: OPENCLAW_BASE_URL,
            ...upstream,
          },
      eventBusBridge: isEventBusBridgeActive(),
      activeWatchers: getActiveWatchers(),
    };
  })

  .get("/api/agents", async () => {
    const agents = await listAgents();
    return { ok: true, agents };
  })

  .get(
    "/api/images/*",
    async ({ params }) => {
      const filePath = "/" + (params as Record<string, string>)["*"];
      try {
        await stat(filePath);
      } catch {
        return new Response("Not found", { status: 404 });
      }

      const ext = extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif",
        ".webp": "image/webp", ".heic": "image/heic",
        ".heif": "image/heif", ".svg": "image/svg+xml",
      };
      const mime = mimeMap[ext] ?? "application/octet-stream";

      const data = await readFile(filePath);
      return new Response(data, {
        headers: {
          "content-type": mime,
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }
  )

  .get(
    "/api/sessions",
    async ({ query }) => {
      const agentId = query.agentId ?? "main";
      const sessions = await listSessions(agentId);
      const activeSessionId = await getActiveSessionId(agentId);
      return { ok: true, agentId, activeSessionId, sessions };
    },
    {
      query: t.Object({
        agentId: t.Optional(t.String()),
      }),
    }
  )

  .post(
    "/api/sessions",
    async ({ body }) => {
      const result = await createSession({
        agentId: body.agentId,
        initialMessage: body.initialMessage,
      });
      return result;
    },
    {
      body: t.Object({
        agentId: t.Optional(t.String()),
        initialMessage: t.Optional(t.String()),
      }),
    }
  )

  .delete(
    "/api/sessions/:sessionId",
    async ({ params, query }) => {
      const agentId = query.agentId ?? "main";
      const jsonlPath = await getSessionJsonlPath(agentId, params.sessionId);
      try {
        await unlink(jsonlPath);
        return { ok: true, deleted: params.sessionId };
      } catch (error) {
        return { ok: false, error: (error as Error).message };
      }
    },
    {
      params: t.Object({ sessionId: t.String() }),
      query: t.Object({
        agentId: t.Optional(t.String()),
      }),
    }
  )

  .get(
    "/api/sessions/:sessionId/history",
    async ({ params, query }) => {
      const agentId = query.agentId ?? "main";
      const jsonlPath = await getSessionJsonlPath(agentId, params.sessionId);

      let raw: string;
      try {
        raw = await readFile(jsonlPath, "utf8");
      } catch {
        return { ok: true, messages: [] };
      }

      const lines = raw.split("\n").filter((l) => l.trim());
      const limit = Number(query.limit) || 100;
      const recent = lines.slice(-limit);

      type HistoryItem = {
        id: string;
        type: string;
        role?: string;
        content?: string;
        queued?: boolean;
        queueIndex?: number;
        replyToId?: string;
        replyToBody?: string;
        replyToSender?: string;
        thinking?: string;
        thinkingSummary?: string;
        toolName?: string;
        toolCalls?: unknown[];
        imagePaths?: string[];
        ts: string;
      };

      const IMAGE_REF_RE = /\[Attached image:\s*([^\]]+)\]/g;
      const REPLY_PREFIX_RE = /^\[\[reply_to_current\]\]\s*/i;

      const extractImages = (text: string): { clean: string; images: string[] } => {
        const images: string[] = [];
        const clean = text.replace(IMAGE_REF_RE, (_, path) => {
          images.push(path.trim());
          return "";
        }).trim();
        return { clean, images };
      };

      const messages: HistoryItem[] = [];

      for (const line of recent) {
        try {
          const entry = JSON.parse(line) as OpenClawJsonlEntry;

          if (entry.type === "message") {
            const msg = (entry as OpenClawMessage).message;
            if (!msg) continue;

            if (msg.role === "user") {
              const contents = msg.content ?? [];
              const rawText = contents
                .filter((c) => c.type === "text" && c.text)
                .map((c) => c.text!)
                .join("\n");
              if (!rawText) continue;

              const { clean, images } = extractImages(rawText);
              const cleaned = sanitizeWithReplyPreview(clean);
              const item: HistoryItem = {
                id: entry.id,
                type: "message",
                role: "user",
                content: cleaned.content,
                ts: entry.timestamp,
              };
              if (cleaned.replyToId) item.replyToId = cleaned.replyToId;
              if (cleaned.replyToBody) item.replyToBody = cleaned.replyToBody;
              if (cleaned.replyToSender) item.replyToSender = cleaned.replyToSender;
              if (cleaned.queued) item.queued = true;
              if (cleaned.queueIndex) item.queueIndex = cleaned.queueIndex;
              if (images.length > 0) item.imagePaths = images;
              messages.push(item);
              continue;
            }
          }

          const classified = classifyEntry(entry);
          if (!classified) continue;

          const p = classified.payload;
          const item: HistoryItem = {
            id: entry.id,
            type: classified.eventType,
            ts: entry.timestamp,
          };

          if (classified.eventType === "message") {
            item.role = String(p.role ?? "assistant");
            let content = String(p.content ?? "");
            content = content.replace(REPLY_PREFIX_RE, "");
            const cleaned = sanitizeWithReplyPreview(content);
            item.content = cleaned.content;
            if (cleaned.replyToId) item.replyToId = cleaned.replyToId;
            if (cleaned.replyToBody) item.replyToBody = cleaned.replyToBody;
            if (cleaned.replyToSender) item.replyToSender = cleaned.replyToSender;
            if (cleaned.queued) item.queued = true;
            if (cleaned.queueIndex) item.queueIndex = cleaned.queueIndex;
            if (p.thinking) item.thinking = String(p.thinking);
            if (p.thinkingSummary) item.thinkingSummary = String(p.thinkingSummary);
          } else if (classified.eventType === "thought") {
            if (p.thinkingSummary) item.thinkingSummary = String(p.thinkingSummary);
            if (p.thinking) item.thinking = String(p.thinking);
          } else if (classified.eventType === "action") {
            if (p.toolCalls) item.toolCalls = p.toolCalls as unknown[];
            if (p.text) item.content = String(p.text);
          } else if (classified.eventType === "observation") {
            item.toolName = p.toolName ? String(p.toolName) : undefined;
            item.content = p.content ? String(p.content) : undefined;
          } else if (classified.eventType === "error") {
            item.content = p.message ? String(p.message) : undefined;
          }

          messages.push(item);
        } catch { /* skip malformed */ }
      }

      return { ok: true, messages };
    },
    {
      params: t.Object({ sessionId: t.String() }),
      query: t.Object({
        agentId: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )

  .get(
    "/api/sessions/:sessionId/context",
    async ({ params, query }) => {
      const agentId = query.agentId ?? "main";
      const jsonlPath = await getSessionJsonlPath(agentId, params.sessionId);

      let raw: string;
      try {
        raw = await readFile(jsonlPath, "utf8");
      } catch {
        return { ok: true, context: null };
      }

      const lines = raw.split("\n");
      let model: string | undefined;
      let lastUsage: { input: number; output: number; cacheRead: number; totalTokens: number } | undefined;
      let totalCost = 0;

      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type === "message" && entry.message?.usage) {
            const u = entry.message.usage;
            if (!lastUsage) {
              lastUsage = {
                input: u.input ?? 0,
                output: u.output ?? 0,
                cacheRead: u.cacheRead ?? 0,
                totalTokens: u.totalTokens ?? 0,
              };
            }
            totalCost += u.cost?.total ?? 0;
            if (!model && entry.message.model) {
              model = entry.message.model;
            }
          }
          if (!model && (entry.type === "model_change" || entry.type === "custom") && entry.modelId) {
            model = entry.modelId;
          }
        } catch { /* skip */ }
      }

      const contextWindow = resolveContextWindow(model);

      return {
        ok: true,
        context: lastUsage ? {
          usedTokens: lastUsage.totalTokens,
          maxTokens: contextWindow,
          percent: contextWindow > 0 ? Math.round((lastUsage.totalTokens / contextWindow) * 1000) / 10 : 0,
          model: model ?? "unknown",
          lastInput: lastUsage.input,
          lastOutput: lastUsage.output,
          cacheRead: lastUsage.cacheRead,
          totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
        } : null,
      };
    },
    {
      params: t.Object({ sessionId: t.String() }),
      query: t.Object({
        agentId: t.Optional(t.String()),
      }),
    }
  )

  .post(
    "/api/message",
    async ({ body }) => {
      const messageId = crypto.randomUUID();
      const sessionId = body.sessionId ?? "default";
      const agentId = normalizeAgentId(body.agentId);
      const routingKey = buildRoutingKey({ sessionId, agentId });
      const sessionKey = await resolveSessionKey(sessionId, agentId);
      if (!sessionKey) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Session key not found for sessionId=${sessionId}. Please refresh sessions or create a new session.`,
          }),
          { status: 404, headers: { "content-type": "application/json" } },
        );
      }

      const abortController = new AbortController();
      addActiveRun(routingKey, abortController);

      if (body.content.trim() || body.imagePaths?.length) {
        emitEventTo(routingKey, {
          type: "message",
          sessionId,
          messageId,
          payload: {
            role: "user",
            content: body.content,
            ...(body.replyToId ? { replyToId: body.replyToId } : {}),
            ...(body.replyToBody ? { replyToBody: body.replyToBody } : {}),
            ...(body.replyToSender ? { replyToSender: body.replyToSender } : {}),
            ...(body.imagePaths?.length ? { imagePaths: body.imagePaths } : {}),
          },
        });
      }

      muteWatcher(routingKey);

      const result = await sendMessage({
        content: body.content,
        imagePaths: body.imagePaths,
        agentId,
        sessionId,
        sessionKey,
        replyToId: body.replyToId,
        replyToBody: body.replyToBody,
        replyToSender: body.replyToSender,
        threadId: body.threadId,
        signal: abortController.signal,
        onStream: (evt) => {
            emitEventTo(routingKey, {
              type: evt.type,
              sessionId,
              messageId: evt.messageId,
            payload: {
              ...(evt.delta != null ? { delta: evt.delta } : {}),
              ...(evt.content != null ? { content: evt.content } : {}),
              ...(evt.replyToBody ? { replyToBody: evt.replyToBody } : {}),
              ...(evt.replyToSender ? { replyToSender: evt.replyToSender } : {}),
            },
          });
        },
      });

      removeActiveRun(routingKey, abortController);
      unmuteWatcher(routingKey);

      return { ok: true, accepted: true, messageId, forwarded: result };
    },
    {
      body: t.Object({
        sessionId: t.Optional(t.String()),
        content: t.String(),
        imagePaths: t.Optional(t.Array(t.String())),
        agentId: t.Optional(t.String()),
        replyToId: t.Optional(t.String()),
        replyToBody: t.Optional(t.String()),
        replyToSender: t.Optional(t.String()),
        threadId: t.Optional(t.String()),
      }),
    }
  )

  .post(
    "/api/transcribe",
    async ({ body }) => {
      if (!WHISPER_API_KEY) {
        return new Response(
          JSON.stringify({ ok: false, error: "OPENAI_API_KEY not configured on server" }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }

      const file = body.file;
      if (!file || !(file instanceof Blob)) {
        return new Response(
          JSON.stringify({ ok: false, error: "No audio file provided" }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }

      try {
        const formData = new FormData();
        formData.append("file", file, (file as File).name || "recording.m4a");
        formData.append("model", WHISPER_MODEL);

        const res = await fetch(WHISPER_API_URL, {
          method: "POST",
          headers: { authorization: `Bearer ${WHISPER_API_KEY}` },
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text();
          return new Response(
            JSON.stringify({ ok: false, error: errText }),
            { status: res.status, headers: { "content-type": "application/json" } },
          );
        }

        const data = await res.json() as { text?: string };
        return { ok: true, text: data.text ?? "" };
      } catch (error) {
        return new Response(
          JSON.stringify({ ok: false, error: (error as Error).message }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    }
  )

  .post(
    "/api/upload-image",
    async ({ body }) => {
      const file = body.file;
      if (!file || !(file instanceof Blob)) {
        return new Response(
          JSON.stringify({ ok: false, error: "No image file provided" }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }

      try {
        const { getUploadDir } = await import("./upload-cleaner");
        const uploadDir = await getUploadDir();
        await mkdir(uploadDir, { recursive: true });

        const origName = (file as File).name ?? "image";
        const ext = origName.split(".").pop() ?? "jpg";
        const filename = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filePath = join(uploadDir, filename);

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);

        return { ok: true, path: filePath };
      } catch (error) {
        return new Response(
          JSON.stringify({ ok: false, error: (error as Error).message }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    }
  )

  .post(
    "/api/dev/emit",
    ({ body }) => {
      emitEventTo(buildRoutingKey({
        sessionId: body.sessionId,
        agentId: typeof body.payload.agentId === "string" ? body.payload.agentId : undefined,
      }), {
        type: body.type,
        sessionId: body.sessionId,
        messageId: body.messageId,
        payload: body.payload,
      });
      return { ok: true };
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal("message"),
          t.Literal("message_delta"),
          t.Literal("message_start"),
          t.Literal("message_done"),
          t.Literal("thought"),
          t.Literal("action"),
          t.Literal("observation"),
          t.Literal("error"),
          t.Literal("done"),
          t.Literal("status"),
        ]),
        sessionId: t.String(),
        messageId: t.Optional(t.String()),
        payload: t.Record(t.String(), t.Unknown()),
      }),
    }
  )

  .post("/_internal/event", async ({ body }) => {
    if (isEventBusBridgeActive()) {
      return { ok: true, ignored: true, reason: "event_bus_bridge_active" };
    }
    const evt = body as any;
    const payload = evt.payload ?? evt.data ?? {};
    emitEventTo(buildRoutingKey({
      sessionId: evt.sessionId ?? evt.sessionKey ?? "",
      agentId: typeof payload.agentId === "string" ? payload.agentId : undefined,
    }), {
      type: evt.type ?? "status",
      sessionId: evt.sessionId ?? evt.sessionKey ?? "",
      messageId: evt.messageId,
      payload,
    });
    return { ok: true };
  })

  .ws("/stream", {
    body: t.Union([
      t.Object({ type: t.Literal("ping") }),
      t.Object({
        type: t.Literal("send_message"),
        sessionId: t.Optional(t.String()),
        messageId: t.Optional(t.String()),
        content: t.String(),
        imagePaths: t.Optional(t.Array(t.String())),
        agentId: t.Optional(t.String()),
        newSession: t.Optional(t.Boolean()),
        replyToId: t.Optional(t.String()),
        replyToBody: t.Optional(t.String()),
        replyToSender: t.Optional(t.String()),
        threadId: t.Optional(t.String()),
      }),
      t.Object({
        type: t.Literal("subscribe_session"),
        sessionId: t.String(),
        agentId: t.Optional(t.String()),
      }),
      t.Object({
        type: t.Literal("unsubscribe_session"),
        sessionId: t.String(),
        agentId: t.Optional(t.String()),
      }),
    ]),

    async open(ws) {
      ws.send(
        JSON.stringify({
          type: "connected",
          ts: Date.now(),
          payload: { message: "ClawFlow Gateway connected" },
        })
      );
    },

    async message(ws, incoming) {
      const body = incoming as ClientMessage;

      if (body.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        return;
      }

      if (body.type === "subscribe_session") {
        const agentId = body.agentId ?? "main";
        const routingKey = buildRoutingKey({ sessionId: body.sessionId, agentId });
        subscribeSession(body.sessionId, ws);
        subscribeSession(routingKey, ws);
        let jsonlPath = "";

        if (!isEventBusBridgeActive()) {
          jsonlPath = await getSessionJsonlPath(agentId, body.sessionId);
          if (!isWatching(routingKey)) {
            await startWatcher(body.sessionId, jsonlPath, routingKey);
          }
        }

        ws.send(
          JSON.stringify({
            type: "subscribed",
            sessionId: body.sessionId,
            agentId,
            jsonlPath,
            ts: Date.now(),
          })
        );
        return;
      }

      if (body.type === "unsubscribe_session") {
        const routingKey = buildRoutingKey({ sessionId: body.sessionId, agentId: body.agentId });
        unsubscribeSession(body.sessionId, ws);
        unsubscribeSession(routingKey, ws);

        if (getSessionSubscriberCount(body.sessionId) === 0 && getSessionSubscriberCount(routingKey) === 0) {
          stopWatcher(routingKey);
        }

        ws.send(
          JSON.stringify({
            type: "unsubscribed",
            sessionId: body.sessionId,
            ts: Date.now(),
          })
        );
        return;
      }

      if (body.type === "send_message") {
        pruneStalePendingSessionCreates();
        const messageId = body.messageId ?? crypto.randomUUID();
        const sessionId = body.sessionId ?? "default";
        const isNewSession = !!body.newSession;
        const agentId = normalizeAgentId(body.agentId);
        const routingKey = buildRoutingKey({ sessionId, agentId });
        if (isNewSession) {
          const pending = pendingSessionCreates.get(routingKey);
          if (pending) {
            const age = Date.now() - pending.startedAt;
            const ttlLeft = Math.max(0, Math.ceil((NEW_SESSION_PENDING_TTL_MS - age) / 1000));
            ws.send(JSON.stringify({
              type: "error",
              sessionId,
              messageId,
              payload: {
                message: `New session is still initializing (${Math.floor(age / 1000)}s elapsed, ~${ttlLeft}s before auto-timeout). Please retry shortly.`,
              },
              ts: Date.now(),
            }));
            return;
          }
          pendingSessionCreates.set(routingKey, { agentId, startedAt: Date.now() });
        }
        const sessionLookupStartedAt = Date.now();
        let baselineSessionIds: Set<string> | null = null;
        if (isNewSession) {
          try {
            baselineSessionIds = new Set((await listSessions(agentId)).map((s) => s.id));
          } catch {
            baselineSessionIds = null;
          }
        }
        const sessionKey = isNewSession ? undefined : await resolveSessionKey(sessionId, agentId);
        if (!isNewSession && !sessionKey) {
          ws.send(JSON.stringify({
            type: "error",
            sessionId,
            messageId,
            payload: {
              message: `Session key not found for sessionId=${sessionId}. Please refresh sessions or create a new session.`,
            },
            ts: Date.now(),
          }));
          return;
        }

        let streamSeq = 0;
        const emitStream = isNewSession
          ? (packet: { type: EventType; sessionId: string; messageId?: string; payload: Record<string, unknown> }) => {
              ws.send(JSON.stringify({ ...packet, seq: ++streamSeq, ts: Date.now() }));
            }
          : (packet: { type: EventType; sessionId: string; messageId?: string; payload: Record<string, unknown> }) => {
              emitEventTo(routingKey, packet);
            };

        ws.send(JSON.stringify({ type: "ack", sessionId, messageId, ts: Date.now() }));

        if (body.content.trim() || body.imagePaths?.length) {
          emitStream({
            type: "message",
            sessionId,
            messageId,
            payload: {
              role: "user",
              content: body.content,
              ...(body.replyToId ? { replyToId: body.replyToId } : {}),
              ...(body.replyToBody ? { replyToBody: body.replyToBody } : {}),
              ...(body.replyToSender ? { replyToSender: body.replyToSender } : {}),
              ...(body.imagePaths?.length ? { imagePaths: body.imagePaths } : {}),
            },
          });
        }

        const abortController = new AbortController();
        addActiveRun(routingKey, abortController);

        if (!isNewSession) muteWatcher(routingKey);

        sendMessage({
          content: body.content,
          imagePaths: body.imagePaths,
          agentId,
          sessionId,
          sessionKey: sessionKey ?? undefined,
          replyToId: body.replyToId,
          replyToBody: body.replyToBody,
          replyToSender: body.replyToSender,
          threadId: body.threadId,
          signal: abortController.signal,
          onStream: (evt) => {
            emitStream({
              type: evt.type,
              sessionId,
              messageId: evt.messageId,
              payload: {
                ...(evt.delta != null ? { delta: evt.delta } : {}),
                ...(evt.content != null ? { content: evt.content } : {}),
                ...(evt.replyToBody ? { replyToBody: evt.replyToBody } : {}),
                ...(evt.replyToSender ? { replyToSender: evt.replyToSender } : {}),
              },
            });
          },
        })
          .then(async (result) => {
            if (isNewSession) {
              if (!result.ok || result.aborted) {
                pendingSessionCreates.delete(routingKey);
                return;
              }
              try {
                let created = null;
                for (let i = 0; i < NEW_SESSION_MATCH_RETRIES; i++) {
                  created = await matchCreatedSession({
                    agentId,
                    baselineSessionIds: baselineSessionIds ?? undefined,
                    responseId: result.responseId,
                    notBeforeMs: sessionLookupStartedAt,
                  });
                  if (created) break;
                  await sleep(NEW_SESSION_MATCH_RETRY_DELAY_MS);
                }
                if (created) {
                  ws.send(JSON.stringify({
                    type: "session_created",
                    pendingSessionId: sessionId,
                    sessionId: created.id,
                    agentId,
                    ts: Date.now(),
                  }));

                  const createdRoutingKey = buildRoutingKey({ sessionId: created.id, agentId });
                  subscribeSession(created.id, ws);
                  subscribeSession(createdRoutingKey, ws);
                  const jsonlPath = await getSessionJsonlPath(agentId, created.id);
                  if (!isWatching(createdRoutingKey)) {
                    await startWatcher(created.id, jsonlPath, createdRoutingKey);
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: "error",
                    sessionId,
                    messageId,
                    payload: {
                      message: `New session was accepted but mapping is delayed after ${NEW_SESSION_MATCH_RETRIES} retries. Refresh sessions and reselect this chat.`,
                    },
                    ts: Date.now(),
                  }));
                }
              } catch { /* ignore */ }
              finally {
                pendingSessionCreates.delete(routingKey);
              }
            }
          })
          .catch(() => {})
          .finally(() => {
            removeActiveRun(routingKey, abortController);
            if (!isNewSession) unmuteWatcher(routingKey);
          });
        return;
      }

      ws.send(JSON.stringify({ type: "unknown_message", ts: Date.now() }));
    },

    close(ws) {
      const sessions = unsubscribeAll(ws);
      for (const sessionId of sessions) {
        if (getSessionSubscriberCount(sessionId) === 0) {
          stopWatcher(sessionId);
        }
      }
    },
  });

// ── Standalone mode (direct `bun run`) ──────────────────────────────

if (import.meta.main) {
  startEventBusBridge();
  const listenPort = Number(process.env.CLAWFLOW_PORT ?? PORT);
  app.listen(listenPort);
  console.log(`ClawFlow Gateway running on http://${app.server?.hostname}:${app.server?.port}`);
  console.log(`  OpenClaw home: ${OPENCLAW_HOME}`);
  console.log(`  OpenClaw upstream: ${OPENCLAW_BASE_URL}`);
}
