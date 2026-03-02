/**
 * OpenClaw plugin entry point for ClawFlow.
 *
 * This file is loaded by the OpenClaw plugin registry. It must export
 * a default object conforming to OpenClawPluginDefinition.
 *
 * We avoid importing `openclaw/plugin-sdk` directly since this plugin
 * lives outside the OpenClaw node_modules tree. The `api` parameter
 * is injected at runtime by the OpenClaw loader.
 */

type PluginApi = {
  pluginConfig?: Record<string, unknown>;
  runtime: { config: { loadConfig: () => any } };
  logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
  registerService: (svc: { id: string; start: (ctx: any) => Promise<void>; stop?: (ctx: any) => Promise<void> }) => void;
  on: (hook: string, handler: (...args: any[]) => any, opts?: any) => void;
};

const plugin = {
  id: "clawflow",
  name: "ClawFlow",
  description: "ClawFlow mobile companion — Elysia WebSocket/HTTP gateway for iOS app.",

  register(api: PluginApi) {
    const pluginCfg = api.pluginConfig ?? {};
    const port = (pluginCfg as any).port ?? Number(process.env.PORT ?? 3000);

    api.registerService({
      id: "viewclaw-gateway",

      async start(ctx) {
        const { bindPluginApi } = await import("./src/kernel.js");
        bindPluginApi(api);

        const { app } = await import("./src/index.js");
        app.listen(port);
        ctx.logger.info(`ClawFlow Gateway listening on port ${port}`);

        const { startEventBusBridge } = await import("./src/jsonl-watcher.js");
        startEventBusBridge();

        const { startUploadCleaner } = await import("./src/upload-cleaner.js");
        startUploadCleaner();
      },

      async stop() {
        const { stopEventBusBridge } = await import("./src/jsonl-watcher.js");
        stopEventBusBridge();

        const { stopUploadCleaner } = await import("./src/upload-cleaner.js");
        stopUploadCleaner();

        const { app } = await import("./src/index.js");
        app.stop();
      },
    });

    api.on("after_tool_call", (event: any, ctx: any) => {
      import("./src/kernel.js").then(({ broadcastAgentEvent }) => {
        broadcastAgentEvent({
          type: "observation",
          sessionKey: ctx.sessionKey ?? "",
          agentId: ctx.agentId,
          data: {
            toolName: event.toolName,
            result: event.result,
            error: event.error,
            durationMs: event.durationMs,
          },
        });
      });
    });

    api.on("session_start", (event: any, ctx: any) => {
      import("./src/kernel.js").then(({ broadcastAgentEvent }) => {
        broadcastAgentEvent({
          type: "status",
          sessionKey: ctx.sessionId ?? "",
          agentId: ctx.agentId,
          data: { subtype: "session_start", sessionId: event.sessionId },
        });
      });
    });

    api.on("session_end", (event: any, ctx: any) => {
      import("./src/kernel.js").then(({ broadcastAgentEvent }) => {
        broadcastAgentEvent({
          type: "status",
          sessionKey: ctx.sessionId ?? "",
          agentId: ctx.agentId,
          data: { subtype: "session_end", sessionId: event.sessionId, messageCount: event.messageCount },
        });
      });
    });
  },
};

export default plugin;
