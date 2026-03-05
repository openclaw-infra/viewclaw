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
import { buildClawflowChannelPlugin } from "./src/channel-plugin";
import { createRuntimeAdapter } from "./src/runtime-adapter";

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
let gatewayLastStartAt: number | null = null;
let gatewayLastStopAt: number | null = null;
let gatewayLastError: string | null = null;

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
    const runtimeAdapter = createRuntimeAdapter({
      runtime: api.runtime,
      config: api.config,
    });
    const result = await runtimeAdapter.dispatchInboundMessage({
      content,
      agentId,
      sessionKey: runtimeSessionKey,
      forceNewSession,
      onReply: async () => {},
    });

    sendBridgeResponse(reqId, true, { content: result.content });
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

    const channelPlugin = buildClawflowChannelPlugin({
      getGatewayState: () => ({
        running: child !== null,
        port: gatewayPort,
        lastStartAt: gatewayLastStartAt,
        lastStopAt: gatewayLastStopAt,
        lastError: gatewayLastError,
      }),
      getLogger: () => api.logger ?? null,
      notifyPairingApproved: async ({ id }) => {
        await postEvent({
          type: "status",
          payload: {
            subtype: "pairing_approved",
            channel: "clawflow",
            senderId: id,
          },
        });
      },
      sendOutbound: async ({ to, text, mediaUrl, accountId, replyToId, threadId }) => {
        const messageId = randomUUID();
        await postEvent({
          type: "message",
          sessionId: to,
          messageId,
          payload: {
            role: "assistant",
            content: text,
            channel: "clawflow",
            accountId: accountId ?? undefined,
            mediaUrl: mediaUrl ?? undefined,
            replyToId: replyToId ?? undefined,
            threadId: threadId ?? undefined,
          },
        });
        return { id: messageId };
      },
    });
    if (typeof (api as any).registerChannel === "function") {
      try {
        (api as any).registerChannel({ plugin: channelPlugin });
        api.logger.info("[clawflow] ChannelPlugin facade registered (hybrid service+channel mode)");
      } catch (error) {
        api.logger.warn(`[clawflow] ChannelPlugin registration skipped: ${(error as Error).message}`);
      }
    } else {
      api.logger.info("[clawflow] registerChannel() unavailable; running service mode only");
    }

    api.registerService({
      id: "clawflow-gateway",

      async start(ctx) {
        const entryScript = resolve(__dirname, "src", "index.ts");
        try {
          const runtimeAdapter = createRuntimeAdapter({
            runtime: api.runtime,
            config: api.config,
          });
          const inspected = runtimeAdapter.inspectReplyApi();
          ctx.logger.info(
            `[clawflow] runtime.channel.reply keys=${JSON.stringify(inspected.keys)} handleInboundMessage=${inspected.hasHandleInboundMessage ? "function" : "none"} dispatcherPair=${inspected.hasDispatcherPair}`,
          );
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
        gatewayLastStartAt = Date.now();
        gatewayLastError = null;

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
            gatewayLastError = `bun process exited with code ${code}`;
            ctx.logger.error(
              `[clawflow] Bun process exited with code ${code}`
            );
          }
          gatewayLastStopAt = Date.now();
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
          gatewayLastStopAt = Date.now();
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
