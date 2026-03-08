const THREAD_SEGMENT_RE = /:thread:[^:]+$/i;

export const normalizeAgentId = (agentId?: string | null): string => {
  const value = agentId?.trim();
  return value || "main";
};

export const normalizeThreadId = (threadId?: string | number | null): string | undefined => {
  if (threadId == null) return undefined;
  const value = String(threadId).trim();
  return value || undefined;
};

export const buildRoutingKey = (params: { sessionId: string; agentId?: string | null }): string => {
  return `${normalizeAgentId(params.agentId)}::${params.sessionId}`;
};

export const bindSessionKeyToThread = (
  sessionKey: string | undefined,
  threadId?: string | number | null,
): string | undefined => {
  if (!sessionKey) return sessionKey;
  const normalizedThreadId = normalizeThreadId(threadId);
  if (!normalizedThreadId) return sessionKey;
  if (sessionKey.endsWith(`:thread:${normalizedThreadId}`)) return sessionKey;
  const base = sessionKey.replace(THREAD_SEGMENT_RE, "");
  return `${base}:thread:${normalizedThreadId}`;
};

export const buildConversationLabel = (threadId?: string | number | null): string => {
  const normalizedThreadId = normalizeThreadId(threadId);
  return normalizedThreadId ? `ClawFlow Mobile / Thread ${normalizedThreadId}` : "ClawFlow Mobile";
};

export const buildThreadLabel = (threadId?: string | number | null): string | undefined => {
  const normalizedThreadId = normalizeThreadId(threadId);
  return normalizedThreadId ? `Thread ${normalizedThreadId}` : undefined;
};
