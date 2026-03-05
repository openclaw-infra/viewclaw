import { describe, expect, it } from "bun:test";
import { createRuntimeAdapter } from "./runtime-adapter";

describe("runtime-adapter", () => {
  it("dispatches via handleInboundMessage when available", async () => {
    const runtime = {
      channel: {
        reply: {
          handleInboundMessage: async ({ reply }: any) => {
            await reply({ text: "hello" });
          },
        },
      },
    };
    const adapter = createRuntimeAdapter({ runtime });
    const result = await adapter.dispatchInboundMessage({
      content: "ping",
      agentId: "main",
      onReply: async () => {},
    });
    expect(result.content).toBe("hello");
  });

  it("falls back to dispatchReplyFromConfig when handler is unavailable", async () => {
    let deliverFn: ((payload: unknown) => Promise<void>) | null = null;
    const runtime = {
      config: {
        loadConfig: () => ({ ok: true }),
      },
      channel: {
        reply: {
          createReplyDispatcherWithTyping: ({ deliver }: any) => {
            deliverFn = deliver;
            return {
              dispatcher: {
                waitForIdle: async () => {},
                markComplete: () => {},
              },
              replyOptions: {},
              markDispatchIdle: () => {},
            };
          },
          dispatchReplyFromConfig: async () => {
            await deliverFn?.({ text: "world" });
          },
        },
      },
    };
    const adapter = createRuntimeAdapter({ runtime });
    const result = await adapter.dispatchInboundMessage({
      content: "ping",
      agentId: "main",
      onReply: async () => {},
    });
    expect(result.content).toBe("world");
  });
});
