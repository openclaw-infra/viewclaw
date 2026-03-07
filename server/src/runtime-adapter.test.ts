import { describe, expect, it } from "bun:test";
import { createRuntimeAdapter } from "./runtime-adapter";

describe("runtime-adapter", () => {
  it("dispatches via handleInboundMessage when available", async () => {
    let seenParams: any = null;
    const runtime = {
      channel: {
        reply: {
          handleInboundMessage: async (params: any) => {
            seenParams = params;
            const { reply } = params;
            await reply({ text: "hello" });
          },
        },
      },
    };
    const adapter = createRuntimeAdapter({ runtime });
    const result = await adapter.dispatchInboundMessage({
      content: "ping",
      agentId: "main",
      replyToId: "msg-1",
      replyToBody: "quoted",
      replyToSender: "Alice",
      threadId: "thread-1",
      onReply: async () => {},
    });
    expect(result.content).toBe("hello");
    expect(seenParams.replyToId).toBe("msg-1");
    expect(seenParams.replyToBody).toBe("quoted");
    expect(seenParams.replyToSender).toBe("Alice");
    expect(seenParams.messageThreadId).toBe("thread-1");
    expect(seenParams.conversationLabel).toBe("mobile thread:thread-1");
    expect(Array.isArray(seenParams.untrustedContext)).toBe(true);
  });

  it("falls back to dispatchReplyFromConfig when handler is unavailable", async () => {
    let deliverFn: ((payload: unknown) => Promise<void>) | null = null;
    let seenCtx: any = null;
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
          dispatchReplyFromConfig: async ({ ctx }: any) => {
            seenCtx = ctx;
            await deliverFn?.({ text: "world" });
          },
        },
      },
    };
    const adapter = createRuntimeAdapter({ runtime });
    const result = await adapter.dispatchInboundMessage({
      content: "ping",
      agentId: "main",
      replyToId: "msg-2",
      replyToBody: "quoted-2",
      replyToSender: "Bob",
      threadId: "thread-2",
      onReply: async () => {},
    });
    expect(result.content).toBe("world");
    expect(seenCtx.ReplyToId).toBe("msg-2");
    expect(seenCtx.ReplyToBody).toBe("quoted-2");
    expect(seenCtx.ReplyToSender).toBe("Bob");
    expect(seenCtx.MessageThreadId).toBe("thread-2");
    expect(seenCtx.ConversationLabel).toBe("mobile thread:thread-2");
    expect(Array.isArray(seenCtx.UntrustedContext)).toBe(true);
  });
});
