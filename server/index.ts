/**
 * OpenClaw plugin entry point for ClawFlow.
 *
 * OpenClaw runs plugins in Node.js, but Elysia requires Bun for
 * .listen() and WebSocket support. This entry spawns a Bun child
 * process running src/index.ts and bridges plugin hook events via
 * an internal HTTP endpoint on the Elysia server.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type PluginApi = {
  pluginConfig?: Record<string, unknown>;
  runtime: { config: { loadConfig: () => any } };
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

async function postEvent(payload: Record<string, unknown>) {
  try {
    await fetch(`http://127.0.0.1:${gatewayPort}/_internal/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Server may not be ready yet or shutting down — silently ignore
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
          stdio: ["ignore", "pipe", "pipe"],
        });

        child.stdout?.on("data", (data: Buffer) => {
          for (const line of data.toString().split("\n").filter(Boolean)) {
            ctx.logger.info(`[clawflow] ${line}`);
          }
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
