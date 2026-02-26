import { Elysia, t } from "elysia";
import { PORT, OPENCLAW_BASE_URL, OPENCLAW_HOME, WHISPER_API_URL, WHISPER_API_KEY, WHISPER_MODEL } from "./config";
import { emitEvent, subscribeSession, unsubscribeAll, getSessionSubscriberCount } from "./ws-manager";
import { startWatcher, stopWatcher, isWatching, getActiveWatchers } from "./jsonl-watcher";
import {
  sendMessage,
  checkHealth,
  listAgents,
  listSessions,
  getSessionJsonlPath,
  getActiveSessionId,
  resolveSessionKey,
  createSession,
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
