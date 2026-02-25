import { Elysia, t } from "elysia";
import { PORT, OPENCLAW_BASE_URL, OPENCLAW_HOME } from "./config";
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
    "/api/message",
    async ({ body }) => {
      const messageId = crypto.randomUUID();
      const sessionId = body.sessionId ?? "default";

      const sessionKey = await resolveSessionKey(sessionId);
      const result = await sendMessage({
        content: body.content,
        agentId: body.agentId,
        sessionKey,
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

        const sessionKey = await resolveSessionKey(sessionId);
        const result = await sendMessage({
          content: body.content,
          agentId: body.agentId,
          sessionKey,
        });

        ws.send(
          JSON.stringify({
            type: "ack",
            sessionId,
            messageId,
            forwarded: result,
            ts: Date.now(),
          })
        );
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
