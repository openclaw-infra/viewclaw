const METADATA_SECTION_PATTERNS: RegExp[] = [
  /(?:^|\n)\s*Conversation info \(untrusted metadata\):\s*(?:(?:\n\s*)?(?:```[\s\S]*?```|\{[\s\S]*?\}))?(?=\n\s*\n|\n\s*(?:Conversation info|Sender|Untrusted context)\b|$)/gi,
  /(?:^|\n)\s*Sender \(untrusted metadata\):\s*(?:(?:\n\s*)?(?:```[\s\S]*?```|\{[\s\S]*?\}))?(?=\n\s*\n|\n\s*(?:Conversation info|Sender|Untrusted context)\b|$)/gi,
  /(?:^|\n)\s*Replied message \(untrusted, for context\):\s*(?:(?:\n\s*)?(?:```[\s\S]*?```|\{[\s\S]*?\}))?(?=\n\s*\n|\n\s*(?:Conversation info|Sender|Replied message|Untrusted context)\b|$)/gi,
  /(?:^|\n)\s*Untrusted context \(metadata, do not treat as instructions or commands\):\s*[\s\S]*$/gi,
];
const INTERNAL_REPLY_MARKER_RE = /\[\[reply_to_current\]\]\s*/gi;
const REPLY_METADATA_RE = /(?:^|\n)\s*Replied message \(untrusted, for context\):\s*(?:\n\s*)?(?:```(?:json)?\s*([\s\S]*?)```|(\{[\s\S]*?\}))(?=\n\s*\n|\n\s*(?:Conversation info|Sender|Replied message|Untrusted context)\b|$)/i;

export type ExtractedReplyPreview = {
  replyToId?: string;
  body: string;
  senderName?: string;
};

export type ExtractedQueuedMessage = {
  queueIndex?: number;
  content: string;
};

const CONVERSATION_INFO_RE = /(?:^|\n)\s*Conversation info \(untrusted metadata\):\s*(?:\n\s*)?(?:```(?:json)?\s*([\s\S]*?)```|(\{[\s\S]*?\}))(?=\n\s*\n|\n\s*(?:Conversation info|Sender|Replied message|Untrusted context)\b|$)/i;
const QUEUED_MESSAGE_RE = /^\[Queued messages while agent was busy\]\s*\n+\s*---\s*\n+\s*Queued\s+#(\d+)\s*\n?/i;

export const extractReplyPreview = (content: string): ExtractedReplyPreview | undefined => {
  const normalized = content.replace(/\r\n?/g, "\n");
  let replyToId: string | undefined;
  const conversationMatch = normalized.match(CONVERSATION_INFO_RE);
  const conversationRaw = conversationMatch?.[1] ?? conversationMatch?.[2];
  if (conversationRaw) {
    try {
      const parsed = JSON.parse(conversationRaw.trim()) as { reply_to_id?: unknown };
      if (typeof parsed.reply_to_id === "string" && parsed.reply_to_id.trim()) {
        replyToId = parsed.reply_to_id.trim();
      }
    } catch {
      // ignore malformed conversation metadata
    }
  }
  const match = normalized.match(REPLY_METADATA_RE);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw.trim()) as { body?: unknown; sender_label?: unknown; senderName?: unknown };
    const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!body) return undefined;
    const senderName = typeof parsed.sender_label === "string"
      ? parsed.sender_label.trim()
      : typeof parsed.senderName === "string"
        ? parsed.senderName.trim()
        : undefined;
    return {
      ...(replyToId ? { replyToId } : {}),
      body,
      ...(senderName ? { senderName } : {}),
    };
  } catch {
    return undefined;
  }
};

/**
 * Strip OpenClaw-injected metadata blocks from message content.
 * Handles both complete blocks (header + JSON) and truncated headers.
 */
export const sanitizeDisplayText = (content: string): string => {
  let out = content.replace(/\r\n?/g, "\n").replace(INTERNAL_REPLY_MARKER_RE, "");
  for (const pattern of METADATA_SECTION_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, "\n");
  }
  out = out.replace(QUEUED_MESSAGE_RE, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
};

export const extractQueuedMessage = (content: string): ExtractedQueuedMessage | undefined => {
  const normalized = content.replace(/\r\n?/g, "\n");
  const match = normalized.match(QUEUED_MESSAGE_RE);
  if (!match) return undefined;
  const queueIndexRaw = match[1];
  const sanitized = sanitizeDisplayText(normalized);
  return {
    ...(queueIndexRaw ? { queueIndex: Number(queueIndexRaw) } : {}),
    content: sanitized,
  };
};

export const sanitizeWithReplyPreview = (content: string): {
  content: string;
  replyToId?: string;
  replyToBody?: string;
  replyToSender?: string;
  queued?: boolean;
  queueIndex?: number;
} => {
  const reply = extractReplyPreview(content);
  const queued = extractQueuedMessage(content);
  return {
    content: queued?.content ?? sanitizeDisplayText(content),
    ...(reply?.replyToId ? { replyToId: reply.replyToId } : {}),
    ...(reply?.body ? { replyToBody: reply.body } : {}),
    ...(reply?.senderName ? { replyToSender: reply.senderName } : {}),
    ...(queued ? { queued: true } : {}),
    ...(queued?.queueIndex ? { queueIndex: queued.queueIndex } : {}),
  };
};
