/**
 * OpenClaw plugin entry point for ClawFlow.
 *
 * OpenClaw runs plugins in Node.js, but Elysia requires Bun for
 * .listen() and WebSocket support. This entry spawns a Bun child
 * process running src/index.ts and bridges plugin/runtime events via
 * stdio JSON lines.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type PluginApi = {
  pluginConfig?: Record<string, unknown>;
  config?: any;
  runtime: any;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  registerService: (svc: {
    id: string;
    start: (ctx: any) => Promise<void>;
    stop?: (ctx: any) => Promise<void>;
  }) => void;
  on: (hook: string, handler: (...args: any[]) => any, opts?: any) => void;
};

let child: ChildProcess | null = null;
let gatewayPort = 3000;
let childStdoutBuffer = "";

const REQ_PREFIX = "__CF_REQ__";
const RES_PREFIX = "__CF_RES__";
const EVT_PREFIX = "__CF_EVT__";

const writeChildLine = (line: string) => {
  if (!child?.stdin || child.stdin.destroyed) return;
  child.stdin.write(`${line}\n`);
};

async function postEvent(payload: Record<string, unknown>) {
  writeChildLine(`${EVT_PREFIX}${JSON.stringify(payload)}`);
}

const sendBridgeResponse = (reqId: string, ok: boolean, result?: unknown, error?: string) => {
  writeChildLine(`${RES_PREFIX}${JSON.stringify({ reqId, ok, result, error })}`);
};

const handleBridgeRequest = async (
  api: PluginApi,
  req: { reqId?: string; method?: string; payload?: Record<string, unknown> },
) => {
  const reqId = req.reqId;
  if (!reqId || !req.method) return;

  if (req.method !== "send_message") {
    sendBridgeResponse(reqId, false, undefined, `Unknown bridge method: ${req.method}`);
    return;
  }

  try {
    const content = typeof req.payload?.content === "string" ? req.payload.content : "";
    const agentId = typeof req.payload?.agentId === "string" ? req.payload.agentId : "main";
    const sessionKey = typeof req.payload?.sessionKey === "string" ? req.payload.sessionKey : undefined;
    const forceNewSession = req.payload?.forceNewSession === true;
    const runtimeSessionKey = sessionKey ?? (forceNewSession ? `agent:${agentId}:${randomUUID()}` : undefined);

    const chunks: string[] = [];
    const appendPayloadText = (payload: unknown) => {
      if (typeof payload === "string" && payload.length > 0) {
        chunks.push(payload);
        return;
      }
      if (!payload || typeof payload !== "object") return;

      const obj = payload as Record<string, unknown>;
      const directText = obj.text;
      if (typeof directText === "string" && directText.length > 0) {
        chunks.push(directText);
      }

      const message = obj.message;
      if (message && typeof message === "object") {
        const messageText = (message as Record<string, unknown>).text;
        if (typeof messageText === "string" && messageText.length > 0) {
          chunks.push(messageText);
        }
      }

      const contentField = obj.content;
      if (typeof contentField === "string" && contentField.length > 0) {
        chunks.push(contentField);
        return;
      }
      if (Array.isArray(contentField)) {
        for (const item of contentField) {
          if (!item || typeof item !== "object") continue;
          const textValue = (item as Record<string, unknown>).text;
          if (typeof textValue === "string" && textValue.length > 0) {
            chunks.push(textValue);
          }
        }
      }
    };
    const chatId = runtimeSessionKey ?? `clawflow-${agentId}-${forceNewSession ? randomUUID() : "main"}`;
    const runtimeReply = api.runtime?.channel?.reply as {
      handleInboundMessage?: (params: unknown) => Promise<unknown>;
      createReplyDispatcherWithTyping?: (params: unknown) => {
        dispatcher: {
          waitForIdle: () => Promise<void>;
          markComplete: () => void;
        };
        replyOptions?: Record<string, unknown>;
        markDispatchIdle?: () => void;
      };
      dispatchReplyFromConfig?: (params: {
        ctx: Record<string, unknown>;
        cfg: Record<string, unknown>;
        dispatcher: unknown;
        replyOptions?: Record<string, unknown>;
      }) => Promise<unknown>;
    } | undefined;
    if (typeof runtimeReply?.handleInboundMessage === "function") {
      await runtimeReply.handleInboundMessage({
        channel: "clawflow",
        accountId: "mobile",
        senderId: "mobile",
        chatType: "direct",
        chatId,
        text: content,
        agentId,
        ...(sessionKey ? { sessionKey } : {}),
        reply: async (payload: unknown) => {
          appendPayloadText(payload);
        },
      });
    } else if (
      typeof runtimeReply?.dispatchReplyFromConfig === "function"
      && typeof runtimeReply?.createReplyDispatcherWithTyping === "function"
    ) {
      const cfg = api.runtime?.config?.loadConfig?.() ?? api.config ?? {};
      const msgContext: Record<string, unknown> = {
        Body: content,
        BodyForAgent: content,
        RawBody: content,
        CommandBody: content,
        BodyForCommands: content,
        ...(runtimeSessionKey ? { SessionKey: runtimeSessionKey } : {}),
        From: "clawflow-mobile",
        To: chatId,
        Provider: "clawflow",
        Surface: "clawflow",
        ChatType: "direct",
        SenderId: "mobile",
        SenderName: "mobile",
        CommandAuthorized: true,
      };
      const dispatchState = runtimeReply.createReplyDispatcherWithTyping({
        deliver: async (payload: unknown) => {
          appendPayloadText(payload);
        },
      }) ?? {};
      const dispatcher = (dispatchState as { dispatcher?: unknown }).dispatcher;
      if (!dispatcher) {
        throw new Error("createReplyDispatcherWithTyping returned no dispatcher");
      }

      await runtimeReply.dispatchReplyFromConfig({
        ctx: msgContext,
        cfg,
        dispatcher,
        replyOptions: {
          ...((dispatchState as { replyOptions?: Record<string, unknown> }).replyOptions ?? {}),
          runId: randomUUID(),
        },
      });

      (dispatchState as { markDispatchIdle?: () => void }).markDispatchIdle?.();
      await (dispatcher as { waitForIdle?: () => Promise<void> }).waitForIdle?.();
      (dispatcher as { markComplete?: () => void }).markComplete?.();
    } else {
      const keys = runtimeReply && typeof runtimeReply === "object" ? Object.keys(runtimeReply) : [];
      throw new Error(
        `No supported reply runtime API. availableKeys=${JSON.stringify(keys)}`
      );
    }

    sendBridgeResponse(reqId, true, { content: chunks.join("") });
  } catch (error) {
    sendBridgeResponse(reqId, false, undefined, (error as Error).message);
  }
};

const handleChildStdoutData = (api: PluginApi, ctx: { logger: { info: (msg: string) => void; error: (msg: string) => void } }, data: Buffer) => {
  childStdoutBuffer += data.toString();
  const lines = childStdoutBuffer.split("\n");
  childStdoutBuffer = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith(REQ_PREFIX)) {
      try {
        const parsed = JSON.parse(trimmed.slice(REQ_PREFIX.length)) as { reqId?: string; method?: string; payload?: Record<string, unknown> };
        void handleBridgeRequest(api, parsed);
      } catch {
        ctx.logger.error("[clawflow] Failed to parse bridge request");
      }
      continue;
    }
    ctx.logger.info(`[clawflow] ${trimmed}`);
  }
}

const plugin = {
  id: "clawflow",
  name: "ClawFlow",
  description:
    "ClawFlow mobile companion — Elysia WebSocket/HTTP gateway for iOS app.",

  register(api: PluginApi) {
    const pluginCfg = api.pluginConfig ?? {};
    gatewayPort =
      (pluginCfg as any).port ?? Number(process.env.PORT ?? 3000);

    api.registerService({
      id: "clawflow-gateway",

      async start(ctx) {
        const entryScript = resolve(__dirname, "src", "index.ts");
        try {
          const replyRuntime = api.runtime?.channel?.reply;
          const keys = replyRuntime && typeof replyRuntime === "object" ? Object.keys(replyRuntime) : [];
          const handleType = typeof (replyRuntime as { handleInboundMessage?: unknown } | undefined)?.handleInboundMessage;
          ctx.logger.info(`[clawflow] runtime.channel.reply keys=${JSON.stringify(keys)} handleInboundMessage=${handleType}`);
        } catch (error) {
          ctx.logger.warn(`[clawflow] failed to inspect runtime.channel.reply: ${(error as Error).message}`);
        }

        const env: Record<string, string> = {
          ...process.env as any,
          CLAWFLOW_PORT: String(gatewayPort),
          CLAWFLOW_PLUGIN_MODE: "1",
        };

        try {
          const config = api.runtime.config.loadConfig();
          if (config?.gateway?.auth?.token) {
            env.OPENCLAW_TOKEN = config.gateway.auth.token;
          }
        } catch {}

        child = spawn("bun", ["run", entryScript], {
          cwd: __dirname,
          env,
          stdio: ["pipe", "pipe", "pipe"],
        });

        child.stdout?.on("data", (data: Buffer) => {
          handleChildStdoutData(api, ctx, data);
        });

        child.stderr?.on("data", (data: Buffer) => {
          for (const line of data.toString().split("\n").filter(Boolean)) {
            ctx.logger.error(`[clawflow] ${line}`);
          }
        });

        child.on("exit", (code) => {
          if (code !== null && code !== 0) {
            ctx.logger.error(
              `[clawflow] Bun process exited with code ${code}`
            );
          }
          child = null;
        });

        await new Promise<void>((resolve) => setTimeout(resolve, 1500));
        ctx.logger.info(
          `ClawFlow Gateway spawned on port ${gatewayPort} (bun)`
        );
      },

      async stop() {
        if (child) {
          child.kill("SIGTERM");
          await new Promise<void>((res) => {
            const timeout = setTimeout(() => {
              child?.kill("SIGKILL");
              res();
            }, 5000);
            child?.on("exit", () => {
              clearTimeout(timeout);
              res();
            });
          });
          child = null;
        }
      },
    });

    api.on("after_tool_call", (event: any, ctx: any) => {
      postEvent({
        type: "observation",
        sessionId: ctx.sessionKey ?? "",
        payload: {
          toolName: event.toolName,
          result: event.result,
          error: event.error,
          durationMs: event.durationMs,
          agentId: ctx.agentId,
        },
      });
    });

    api.on("session_start", (event: any, ctx: any) => {
      postEvent({
        type: "status",
        sessionId: ctx.sessionId ?? "",
        payload: {
          subtype: "session_start",
          sessionId: event.sessionId,
          agentId: ctx.agentId,
        },
      });
    });

    api.on("session_end", (event: any, ctx: any) => {
      postEvent({
        type: "status",
        sessionId: ctx.sessionId ?? "",
        payload: {
          subtype: "session_end",
          sessionId: event.sessionId,
          messageCount: event.messageCount,
          agentId: ctx.agentId,
        },
      });
    });
  },
};

export default plugin;
