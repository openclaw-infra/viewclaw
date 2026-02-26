import { Elysia, t } from "elysia";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { PORT, OPENCLAW_BASE_URL, OPENCLAW_HOME, WHISPER_API_URL, WHISPER_API_KEY, WHISPER_MODEL } from "./config";
import { emitEvent, subscribeSession, unsubscribeAll, getSessionSubscriberCount } from "./ws-manager";
import { startWatcher, stopWatcher, isWatching, getActiveWatchers, classifyEntry } from "./jsonl-watcher";
import type { OpenClawJsonlEntry, OpenClawMessage } from "./types";
import {
  sendMessage,
  checkHealth,
  listAgents,
  listSessions,
  getSessionJsonlPath,
  getActiveSessionId,
  resolveSessionKey,
  createSession,
  getWorkspaceDir,
} from "./openclaw-client";
import type { ClientMessage } from "./types";

export const app = new Elysia()
  .get("/", () => ({
    name: "ViewClaw Gateway",
    version: "2.0.0",
    ok: true,
  }))

  .get("/healthz", async () => {
    const upstream = await checkHealth();
    return {
      ok: true,
      now: Date.now(),
      openclawHome: OPENCLAW_HOME,
      upstream: {
        url: OPENCLAW_BASE_URL,
        ...upstream,
      },
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
              const item: HistoryItem = {
                id: entry.id,
                type: "message",
                role: "user",
                content: clean,
                ts: entry.timestamp,
              };
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
            item.content = content;
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

  .post(
    "/api/message",
    async ({ body }) => {
      const messageId = crypto.randomUUID();
      const sessionId = body.sessionId ?? "default";

      const sessionKey = await resolveSessionKey(sessionId);
      const result = await sendMessage({
        content: body.content,
        agentId: body.agentId,
        sessionKey,
        onStream: (evt) => {
          emitEvent({
            type: evt.type,
            sessionId,
            messageId: evt.messageId,
            payload: {
              ...(evt.delta != null ? { delta: evt.delta } : {}),
              ...(evt.content != null ? { content: evt.content } : {}),
            },
          });
        },
      });

      return { ok: true, accepted: true, messageId, forwarded: result };
    },
    {
      body: t.Object({
        sessionId: t.Optional(t.String()),
        content: t.String(),
        agentId: t.Optional(t.String()),
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
        const workspace = await getWorkspaceDir();
        const uploadDir = join(workspace, ".viewclaw-uploads");
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
      emitEvent({
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
      }),
      t.Object({
        type: t.Literal("subscribe_session"),
        sessionId: t.String(),
        agentId: t.Optional(t.String()),
      }),
      t.Object({
        type: t.Literal("unsubscribe_session"),
        sessionId: t.String(),
      }),
    ]),

    async open(ws) {
      ws.send(
        JSON.stringify({
          type: "connected",
          ts: Date.now(),
          payload: { message: "ViewClaw Gateway connected" },
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
        subscribeSession(body.sessionId, ws);

        const jsonlPath = await getSessionJsonlPath(agentId, body.sessionId);
        if (!isWatching(body.sessionId)) {
          await startWatcher(body.sessionId, jsonlPath);
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
        const { unsubscribeSession } = await import("./ws-manager");
        unsubscribeSession(body.sessionId, ws);

        if (getSessionSubscriberCount(body.sessionId) === 0) {
          stopWatcher(body.sessionId);
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
        const messageId = body.messageId ?? crypto.randomUUID();
        const sessionId = body.sessionId ?? "default";

        ws.send(JSON.stringify({ type: "ack", sessionId, messageId, ts: Date.now() }));

        const sessionKey = await resolveSessionKey(sessionId);
        sendMessage({
          content: body.content,
          imagePaths: body.imagePaths,
          agentId: body.agentId,
          sessionKey,
          onStream: (evt) => {
            emitEvent({
              type: evt.type,
              sessionId,
              messageId: evt.messageId,
              payload: {
                ...(evt.delta != null ? { delta: evt.delta } : {}),
                ...(evt.content != null ? { content: evt.content } : {}),
              },
            });
          },
        }).catch(() => {});
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

if (import.meta.main) {
  app.listen(PORT);
  console.log(`ViewClaw Gateway running on http://${app.server?.hostname}:${app.server?.port}`);
  console.log(`  OpenClaw home: ${OPENCLAW_HOME}`);
  console.log(`  OpenClaw upstream: ${OPENCLAW_BASE_URL}`);
}
