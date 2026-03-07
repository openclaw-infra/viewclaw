import { randomUUID } from "node:crypto";

type ReplyCallback = (payload: unknown) => Promise<void>;

type DispatchParams = {
  content: string;
  agentId: string;
  sessionKey?: string;
  forceNewSession?: boolean;
  replyToId?: string;
  replyToBody?: string;
  replyToSender?: string;
  threadId?: string | number;
  onReply: ReplyCallback;
};

type RuntimeAdapterParams = {
  runtime: any;
  config?: any;
};

const buildUntrustedMetadataBlock = (
  label: string,
  value: Record<string, unknown>,
): string | undefined => {
  const entries = Object.entries(value).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return undefined;
  return `${label} (untrusted metadata):\n${JSON.stringify(Object.fromEntries(entries), null, 2)}`;
};

const appendPayloadText = (chunks: string[], payload: unknown) => {
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

export const createRuntimeAdapter = ({ runtime, config }: RuntimeAdapterParams) => {
  const replyRuntime = runtime?.channel?.reply;
  const keys = replyRuntime && typeof replyRuntime === "object" ? Object.keys(replyRuntime) : [];
  const hasHandleInboundMessage = typeof replyRuntime?.handleInboundMessage === "function";
  const hasDispatcherPair =
    typeof replyRuntime?.dispatchReplyFromConfig === "function" &&
    typeof replyRuntime?.createReplyDispatcherWithTyping === "function";

  return {
    inspectReplyApi() {
      return {
        keys,
        hasHandleInboundMessage,
        hasDispatcherPair,
      };
    },

    async dispatchInboundMessage(params: DispatchParams): Promise<{ content: string }> {
      const chunks: string[] = [];
      const chatId =
        params.sessionKey ??
        `clawflow-${params.agentId}-${params.forceNewSession ? randomUUID() : "main"}`;
      const conversationLabel = params.threadId != null ? `mobile thread:${params.threadId}` : "mobile";
      const untrustedContext = [
        buildUntrustedMetadataBlock("Conversation info", {
          sender_id: "mobile",
          sender: "mobile",
          thread_id: params.threadId ?? undefined,
        }),
        buildUntrustedMetadataBlock("Sender", {
          label: "mobile",
          id: "mobile",
          name: "mobile",
        }),
      ].filter((entry): entry is string => Boolean(entry));

      const onReply: ReplyCallback = async (payload) => {
        appendPayloadText(chunks, payload);
        await params.onReply(payload);
      };

      if (hasHandleInboundMessage) {
        await replyRuntime.handleInboundMessage({
          channel: "clawflow",
          accountId: "mobile",
          senderId: "mobile",
          chatType: "direct",
          chatId,
          conversationLabel,
          text: params.content,
          agentId: params.agentId,
          ...(params.sessionKey ? { sessionKey: params.sessionKey } : {}),
          ...(params.replyToId ? { replyToId: params.replyToId } : {}),
          ...(params.replyToBody ? { replyToBody: params.replyToBody } : {}),
          ...(params.replyToSender ? { replyToSender: params.replyToSender } : {}),
          ...(params.threadId != null ? { messageThreadId: params.threadId } : {}),
          ...(untrustedContext.length > 0 ? { untrustedContext } : {}),
          reply: onReply,
        });
        return { content: chunks.join("") };
      }

      if (hasDispatcherPair) {
        const cfg = runtime?.config?.loadConfig?.() ?? config ?? {};
        const msgContext: Record<string, unknown> = {
          Body: params.content,
          BodyForAgent: params.content,
          RawBody: params.content,
          CommandBody: params.content,
          BodyForCommands: params.content,
          ...(params.sessionKey ? { SessionKey: params.sessionKey } : {}),
          From: "clawflow-mobile",
          To: chatId,
          Provider: "clawflow",
          Surface: "clawflow",
          ChatType: "direct",
          ConversationLabel: conversationLabel,
          SenderId: "mobile",
          SenderName: "mobile",
          ...(params.replyToId ? { ReplyToId: params.replyToId } : {}),
          ...(params.replyToBody ? { ReplyToBody: params.replyToBody } : {}),
          ...(params.replyToSender ? { ReplyToSender: params.replyToSender } : {}),
          ...(params.threadId != null ? { MessageThreadId: params.threadId } : {}),
          ...(untrustedContext.length > 0 ? { UntrustedContext: untrustedContext } : {}),
          CommandAuthorized: true,
        };

        const dispatchState = replyRuntime.createReplyDispatcherWithTyping({
          deliver: onReply,
        }) ?? {};
        const dispatcher = (dispatchState as { dispatcher?: unknown }).dispatcher;
        if (!dispatcher) {
          throw new Error("createReplyDispatcherWithTyping returned no dispatcher");
        }

        await replyRuntime.dispatchReplyFromConfig({
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
        return { content: chunks.join("") };
      }

      throw new Error(`No supported reply runtime API. availableKeys=${JSON.stringify(keys)}`);
    },
  };
};
