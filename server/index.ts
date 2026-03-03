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
let cachedGetReplyFromConfig: null | ((ctx: any, opts?: any, configOverride?: any) => Promise<any>) = null;

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
    const chatId = runtimeSessionKey ?? `clawflow-${agentId}-${forceNewSession ? randomUUID() : "main"}`;
    const runtimeReply = (api.runtime?.channel?.reply as { handleInboundMessage?: (params: unknown) => Promise<unknown> } | undefined)?.handleInboundMessage;
    if (typeof runtimeReply === "function") {
      await runtimeReply({
        channel: "clawflow",
        accountId: "mobile",
        senderId: "mobile",
        chatType: "direct",
        chatId,
        text: content,
        agentId,
        ...(sessionKey ? { sessionKey } : {}),
        reply: async (text: string) => {
          chunks.push(text);
        },
      });
    } else {
      if (!cachedGetReplyFromConfig) {
        const entry = process.argv[1];
        if (!entry) throw new Error("Unable to locate OpenClaw runtime entry");
        const mod = await import(`file://${entry}`) as Record<string, unknown>;
        const fn = mod.getReplyFromConfig;
        if (typeof fn !== "function") throw new Error("getReplyFromConfig is unavailable");
        cachedGetReplyFromConfig = fn as (ctx: any, opts?: any, configOverride?: any) => Promise<any>;
      }

      const cfg = api.runtime?.config?.loadConfig?.() ?? api.config;
      const msgContext = {
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
      const appendPayloadText = (payload: any) => {
        if (typeof payload?.text === "string" && payload.text.length > 0) {
          chunks.push(payload.text);
        }
      };

      const reply = await cachedGetReplyFromConfig(
        msgContext,
        {
          runId: randomUUID(),
          onPartialReply: async (payload: any) => appendPayloadText(payload),
          onReasoningStream: async (_payload: any) => {},
          onBlockReply: async (payload: any) => appendPayloadText(payload),
          onToolResult: async (_payload: any) => {},
        },
        cfg,
      );

      if (Array.isArray(reply)) {
        for (const payload of reply) appendPayloadText(payload);
      } else {
        appendPayloadText(reply);
      }
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
