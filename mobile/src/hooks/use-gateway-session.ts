import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentInfo,
  ChatMessage,
  ConnectionStatus,
  ExecutionLog,
  GatewayEvent,
  ImageAttachment,
  ReplyPreview,
  SessionInfo,
  StreamItem,
} from "../types/gateway";

const FALLBACK_WS = "ws://127.0.0.1:3000";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const ACK_TIMEOUT_MS = 12_000;

type Options = {
  sessionId?: string;
  wsUrl?: string;
  httpUrl?: string;
  onMessageDone?: () => void;
};

type WsIncoming =
  | GatewayEvent
  | {
      type:
        | "pong"
        | "ack"
        | "connected"
        | "subscribed"
        | "unsubscribed"
        | "unknown_message"
        | "session_created";
      [k: string]: unknown;
    };

const DEFAULT_AGENT_ID = "main";
const PENDING_PREFIX = "pending-";
const isPendingSession = (id: string) => id.startsWith(PENDING_PREFIX);
const isSessionKeyNotFoundError = (msg: string) =>
  msg.includes("Session key not found");

export const useGatewaySession = ({
  sessionId: initialSessionId,
  wsUrl: externalWsUrl,
  onMessageDone,
  httpUrl: externalHttpUrl,
}: Options) => {
  const wsUrl = externalWsUrl || FALLBACK_WS;
  const httpUrl = externalHttpUrl || wsUrl.replace(/^ws(s?)/, "http$1");

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [stream, setStream] = useState<StreamItem[]>([]);
  const [sending, setSending] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(
    initialSessionId ?? "",
  );
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const lastSeqRef = useRef(0);
  const currentSessionRef = useRef(currentSessionId);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  const getAgentId = useCallback((sessionId?: string) => {
    const sid = sessionId ?? currentSessionRef.current;
    const s = sessionsRef.current.find((x) => x.id === sid);
    return s?.agentId ?? DEFAULT_AGENT_ID;
  }, []);
  const typingIdRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const wsUrlRef = useRef(wsUrl);
  const httpUrlRef = useRef(httpUrl);
  const onMessageDoneRef = useRef(onMessageDone);
  const pendingAckRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const blockAutoFallbackRef = useRef(false);

  currentSessionRef.current = currentSessionId;
  wsUrlRef.current = wsUrl;
  httpUrlRef.current = httpUrl;
  onMessageDoneRef.current = onMessageDone;

  const bufferRef = useRef<StreamItem[]>([]);

  const flush = useCallback(() => {
    const buf = bufferRef.current;
    if (buf.length === 0) return;
    bufferRef.current = [];
    setStream((prev) => {
      const typingIdx = prev.findIndex((item) => item.kind === "typing");
      if (typingIdx !== -1) {
        const before = prev.slice(0, typingIdx);
        const typing = prev[typingIdx];
        return [...before, ...buf, typing].slice(-500);
      }

      const streamingIdx = prev.findIndex(
        (item) => item.kind === "message" && item.data.streaming,
      );
      if (streamingIdx !== -1) {
        const before = prev.slice(0, streamingIdx);
        const after = prev.slice(streamingIdx);
        return [...before, ...buf, ...after].slice(-500);
      }

      return [...prev, ...buf].slice(-500);
    });
  }, []);

  useEffect(() => {
    const t = setInterval(flush, 160);
    return () => clearInterval(t);
  }, [flush]);

  const appendMessage = useCallback((msg: ChatMessage) => {
    if (seenRef.current.has(msg.id)) return;
    seenRef.current.add(msg.id);
    bufferRef.current.push({ kind: "message", data: msg });
  }, []);

  const appendLog = useCallback((log: ExecutionLog) => {
    if (seenRef.current.has(log.id)) return;
    seenRef.current.add(log.id);
    bufferRef.current.push({ kind: "log", data: log });
  }, []);

  const removeTyping = useCallback(() => {
    if (!typingIdRef.current) return;
    const tid = typingIdRef.current;
    typingIdRef.current = null;
    setStream((prev) =>
      prev.filter((item) => !(item.kind === "typing" && item.id === tid)),
    );
  }, []);

  const streamingMsgRef = useRef<string | null>(null);
  const streamedDoneRef = useRef(false);

  const updateStreamingMessage = useCallback(
    (messageId: string, delta: string) => {
      setStream((prev) => {
        const idx = prev.findIndex(
          (item) => item.kind === "message" && item.data.id === messageId,
        );
        if (idx === -1) return prev;
        const item = prev[idx] as { kind: "message"; data: ChatMessage };
        const updated: StreamItem = {
          kind: "message",
          data: { ...item.data, content: item.data.content + delta },
        };
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    },
    [],
  );

  const finalizeStreamingMessage = useCallback(
    (messageId: string, content?: string, replyTo?: ReplyPreview) => {
      streamingMsgRef.current = null;
      streamedDoneRef.current = true;
      setStream((prev) =>
        prev.map((item) => {
          if (item.kind === "message" && item.data.id === messageId) {
            const finalContent = content ?? item.data.content;
            return {
              kind: "message" as const,
              data: {
                ...item.data,
                content: finalContent,
                replyTo,
                streaming: false,
              },
            };
          }
          return item;
        }),
      );
    },
    [],
  );

  const markLocalMessageStatus = useCallback(
    (messageId: string, localStatus?: ChatMessage["localStatus"]) => {
      setStream((prev) =>
        prev.map((item) =>
          item.kind === "message" && item.data.id === messageId
            ? { kind: "message" as const, data: { ...item.data, localStatus } }
            : item,
        ),
      );
    },
    [],
  );

  const parseEvent = useCallback(
    (event: GatewayEvent) => {
      const p = event.payload;

      if (event.type === "message_start") {
        const msgId = event.messageId ?? `stream-msg-${event.seq}`;
        streamingMsgRef.current = msgId;
        seenRef.current.add(msgId);
        return;
      }

      if (event.type === "message_delta") {
        const delta = typeof p.delta === "string" ? p.delta : "";
        const msgId = event.messageId ?? streamingMsgRef.current;
        if (!delta || !msgId) return;

        setStream((prev) => {
          const exists = prev.some(
            (item) => item.kind === "message" && item.data.id === msgId,
          );
          if (exists) {
            return prev.map((item) => {
              if (item.kind === "message" && item.data.id === msgId) {
                return {
                  kind: "message" as const,
                  data: { ...item.data, content: item.data.content + delta },
                };
              }
              return item;
            });
          }

          removeTyping();
          const msg: ChatMessage = {
            id: msgId,
            role: "assistant",
            content: delta,
            streaming: true,
            createdAt: event.ts,
          };
          return [
            ...prev.filter((i) => i.kind !== "typing"),
            { kind: "message" as const, data: msg },
          ];
        });
        return;
      }

      if (event.type === "message_done") {
        const steered = p.steered === true;
        if (steered) {
          // Server aborted the previous run; Mobile sendMessage already finalized
          // the streaming message, so just reset refs to avoid stale state.
          streamingMsgRef.current = null;
          return;
        }
        const msgId = event.messageId ?? streamingMsgRef.current;
        const content = typeof p.content === "string" ? p.content : undefined;
        const replyToBody = typeof p.replyToBody === "string" ? p.replyToBody : undefined;
        const replyToSender = typeof p.replyToSender === "string" ? p.replyToSender : undefined;
        if (msgId) {
          finalizeStreamingMessage(
            msgId,
            content,
            replyToBody
              ? {
                  messageId: typeof p.replyToId === "string" ? p.replyToId : undefined,
                  body: replyToBody,
                  senderName: replyToSender,
                }
              : undefined,
          );
        }
        onMessageDoneRef.current?.();
        return;
      }

      if (event.type === "message") {
        const role = p.role === "assistant" ? "assistant" : "user";
        const content = String(p.content ?? "");
        const imagePaths = Array.isArray(p.imagePaths)
          ? (p.imagePaths as string[]).filter(
              (x) => typeof x === "string" && x.length > 0,
            )
          : [];
        const images: ImageAttachment[] | undefined =
          imagePaths.length > 0
            ? imagePaths.map((path) => {
                const normalized = path.startsWith("/") ? path : `/${path}`;
                return {
                  uri: `${httpUrlRef.current}/api/images${normalized}`,
                  width: 200,
                  height: 200,
                };
              })
            : undefined;
        if (!content && !images?.length) return;

        if (role === "assistant") {
          if (streamingMsgRef.current || streamedDoneRef.current) return;
          removeTyping();
        }

        const cleanContent = content;

        const incomingId = event.messageId ?? `msg-${event.seq}`;
        // Sender side already inserted local user bubble. Upgrade its status instead of duplicating.
        if (role === "user" && seenRef.current.has(incomingId)) {
          const pending = pendingAckRef.current.get(incomingId);
          if (pending) {
            clearTimeout(pending);
            pendingAckRef.current.delete(incomingId);
          }
          markLocalMessageStatus(incomingId, undefined);
          return;
        }

        appendMessage({
          id: incomingId,
          role,
          content: cleanContent,
          replyTo:
            typeof p.replyToBody === "string"
              ? {
                  messageId:
                    typeof p.replyToId === "string" ? p.replyToId : undefined,
                  body: p.replyToBody,
                  senderName:
                    typeof p.replyToSender === "string"
                      ? p.replyToSender
                      : undefined,
                }
              : undefined,
          images,
          thinking: typeof p.thinking === "string" ? p.thinking : undefined,
          thinkingSummary:
            typeof p.thinkingSummary === "string"
              ? p.thinkingSummary
              : undefined,
          createdAt: event.ts,
        });
        return;
      }

      if (event.type === "thought") {
        const summary =
          typeof p.thinkingSummary === "string" ? p.thinkingSummary : "";
        const thinking = typeof p.thinking === "string" ? p.thinking : "";
        appendLog({
          id: `log-${event.sessionId}-${event.seq}`,
          messageId: event.messageId,
          level: "thought",
          text: summary || thinking || "Thinking...",
          createdAt: event.ts,
        });
        return;
      }

      if (event.type === "action") {
        const toolCalls = p.toolCalls as
          | Array<{ name?: string; arguments?: unknown }>
          | undefined;
        if (toolCalls && toolCalls.length > 0) {
          for (const tc of toolCalls) {
            const args = tc.arguments ? JSON.stringify(tc.arguments) : "";
            appendLog({
              id: `log-${event.sessionId}-${event.seq}-${tc.name}`,
              messageId: event.messageId,
              level: "action",
              text: tc.name ?? "tool_call",
              detail: args.length > 200 ? args.slice(0, 200) + "..." : args,
              toolName: tc.name,
              createdAt: event.ts,
            });
          }
        } else {
          appendLog({
            id: `log-${event.sessionId}-${event.seq}`,
            messageId: event.messageId,
            level: "action",
            text: typeof p.text === "string" ? p.text : "Action",
            createdAt: event.ts,
          });
        }
        return;
      }

      if (event.type === "observation") {
        const content = typeof p.content === "string" ? p.content : "";
        const toolName = typeof p.toolName === "string" ? p.toolName : "";
        appendLog({
          id: `log-${event.sessionId}-${event.seq}`,
          messageId: event.messageId,
          level: "observation",
          text: toolName
            ? `${toolName} returned`
            : content.slice(0, 200) || "Observation",
          detail:
            content.length > 200 ? content.slice(0, 500) + "..." : content,
          toolName,
          createdAt: event.ts,
        });
        return;
      }

      if (event.type === "error") {
        const errorText = typeof p.message === "string" ? p.message : "Error";
        if (isSessionKeyNotFoundError(errorText)) {
          blockAutoFallbackRef.current = true;
        }
        if (event.messageId) {
          const pending = pendingAckRef.current.get(event.messageId);
          if (pending) {
            clearTimeout(pending);
            pendingAckRef.current.delete(event.messageId);
          }
          markLocalMessageStatus(event.messageId, "failed");
          removeTyping();
          setSending(false);
        }
        appendLog({
          id: `log-${event.sessionId}-${event.seq}`,
          level: "error",
          text: errorText,
          createdAt: event.ts,
        });
        return;
      }

      if (event.type === "status") {
        return;
      }

      if (event.type === "done") {
        removeTyping();
        appendLog({
          id: `log-${event.sessionId}-${event.seq}`,
          level: "done",
          text: "Done",
          createdAt: event.ts,
        });
      }
    },
    [
      appendMessage,
      appendLog,
      removeTyping,
      updateStreamingMessage,
      finalizeStreamingMessage,
      markLocalMessageStatus,
    ],
  );

  const wsSend = useCallback((data: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const subscribeToSession = useCallback(
    (sessionId: string) => {
      if (!sessionId) return;
      wsSend({
        type: "subscribe_session",
        sessionId,
        agentId: getAgentId(sessionId),
      });
    },
    [wsSend, getAgentId],
  );

  const unsubscribeFromSession = useCallback(
    (sessionId: string) => {
      if (!sessionId) return;
      wsSend({
        type: "unsubscribe_session",
        sessionId,
        agentId: getAgentId(sessionId),
      });
    },
    [wsSend, getAgentId],
  );

  const scheduleReconnect = useCallback((connectFn: () => void) => {
    if (isUnmountedRef.current) return;
    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
    reconnectAttemptRef.current = attempt + 1;
    reconnectRef.current = setTimeout(connectFn, delay);
  }, []);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus("connecting");

    const ws = new WebSocket(`${wsUrlRef.current}/stream`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setConnectionStatus("connected");

      if (pingRef.current) clearInterval(pingRef.current);
      pingRef.current = setInterval(() => {
        ws.send(JSON.stringify({ type: "ping" }));
      }, 20_000);

      const sid = currentSessionRef.current;
      if (sid) {
        ws.send(
          JSON.stringify({
            type: "subscribe_session",
            sessionId: sid,
            agentId: getAgentId(sid),
          }),
        );
      }
    };

    ws.onmessage = (e) => {
      let parsed: WsIncoming;
      try {
        parsed = JSON.parse(e.data as string);
      } catch {
        return;
      }

      if (parsed.type === "pong") return;

      if (parsed.type === "ack") {
        const ackMessageId =
          typeof parsed.messageId === "string" ? parsed.messageId : "";
        if (ackMessageId) {
          const pending = pendingAckRef.current.get(ackMessageId);
          if (pending) {
            clearTimeout(pending);
            pendingAckRef.current.delete(ackMessageId);
          }
          markLocalMessageStatus(ackMessageId, undefined);
          setSending(false);
        }
        return;
      }

      if (parsed.type === "subscribed") {
        return;
      }

      if (parsed.type === "connected") return;

      if (parsed.type === "session_created") {
        const pendingId = parsed.pendingSessionId as string;
        const realId = parsed.sessionId as string;
        const realAgent = (parsed.agentId as string) ?? DEFAULT_AGENT_ID;
        if (pendingId && realId) {
          blockAutoFallbackRef.current = false;
          const title =
            sessionsRef.current.find((s) => s.id === pendingId)?.title || "";
          setSessions((prev) =>
            prev.map((s) =>
              s.id === pendingId
                ? { ...s, id: realId, agentId: realAgent, title }
                : s,
            ),
          );
          sessionsRef.current = sessionsRef.current.map((s) =>
            s.id === pendingId
              ? { ...s, id: realId, agentId: realAgent, title }
              : s,
          );
          if (currentSessionRef.current === pendingId) {
            setCurrentSessionId(realId);
            currentSessionRef.current = realId;
            setStream([]);
            seenRef.current.clear();
            bufferRef.current = [];
            loadHistory(realId);
          }
          fetchSessions();
        }
        return;
      }

      const evt = parsed as GatewayEvent;
      if (
        evt.sessionId &&
        currentSessionRef.current &&
        evt.sessionId !== currentSessionRef.current
      ) {
        if (!isPendingSession(currentSessionRef.current)) return;
      }
      if (evt.seq != null && evt.seq <= lastSeqRef.current) return;
      if (evt.seq != null) lastSeqRef.current = evt.seq;
      parseEvent(evt);
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      if (pingRef.current) clearInterval(pingRef.current);
      scheduleReconnect(connect);
    };

    ws.onerror = () => setConnectionStatus("disconnected");
  }, [appendLog, parseEvent, scheduleReconnect, markLocalMessageStatus]);

  const loadHistory = useCallback(async (sessionId: string) => {
    try {
      const baseUrl = httpUrlRef.current;
      const res = await fetch(
        `${baseUrl}/api/sessions/${sessionId}/history?agentId=${getAgentId(sessionId)}&limit=100`,
      );
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.messages)) return;

      const toImageUrl = (path: string) => {
        const normalized = path.startsWith("/") ? path : `/${path}`;
        return `${baseUrl}/api/images${normalized}`;
      };

      const items: StreamItem[] = [];
      for (const m of data.messages) {
        if (seenRef.current.has(m.id)) continue;
        seenRef.current.add(m.id);

        if (m.type === "message" && m.role) {
          const images: ImageAttachment[] | undefined = m.imagePaths?.length
            ? (m.imagePaths as string[]).map((p: string) => ({
                uri: toImageUrl(p),
                width: 200,
                height: 200,
              }))
            : undefined;

          const msg: ChatMessage = {
            id: m.id,
            role: m.role === "user" ? "user" : "assistant",
            content: m.content ?? "",
            replyTo: m.replyToBody
              ? {
                  messageId:
                    typeof m.replyToId === "string" ? m.replyToId : undefined,
                  body: m.replyToBody,
                  senderName:
                    typeof m.replyToSender === "string"
                      ? m.replyToSender
                      : undefined,
                }
              : undefined,
            thinking: m.thinking,
            thinkingSummary: m.thinkingSummary,
            images,
            createdAt: m.ts ? new Date(m.ts).getTime() : 0,
          };
          items.push({ kind: "message", data: msg });
        } else if (
          m.type === "thought" ||
          m.type === "action" ||
          m.type === "observation" ||
          m.type === "error"
        ) {
          let text = "";
          if (m.type === "thought") {
            text = m.thinkingSummary || m.thinking || "Thinking...";
          } else if (m.type === "action") {
            const tc = m.toolCalls as Array<{ name?: string }> | undefined;
            text = tc?.[0]?.name ?? m.content ?? "Action";
          } else if (m.type === "observation") {
            text = m.toolName
              ? `${m.toolName} returned`
              : m.content?.slice(0, 200) || "Observation";
          } else {
            text = m.content ?? "Error";
          }

          const log: ExecutionLog = {
            id: m.id,
            level: m.type as ExecutionLog["level"],
            text,
            detail: m.type === "observation" ? m.content : undefined,
            toolName: m.toolName,
            createdAt: m.ts ? new Date(m.ts).getTime() : 0,
          };
          items.push({ kind: "log", data: log });
        }
      }

      if (items.length > 0) {
        setStream((prev) => [...items, ...prev]);
      }
    } catch {
      /* offline */
    }
  }, []);

  const fetchAgents = useCallback(async (): Promise<AgentInfo[]> => {
    try {
      const res = await fetch(`${httpUrlRef.current}/api/agents`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.agents)) {
        setAgents(data.agents);
        agentsRef.current = data.agents;
        return data.agents;
      }
    } catch {
      /* offline */
    }
    return agentsRef.current;
  }, []);

  const fetchSessions = useCallback(
    async (agentsList?: AgentInfo[]) => {
      try {
        const known = agentsList ?? agentsRef.current;
        const agentIds =
          known.length > 0 ? known.map((a) => a.id) : [DEFAULT_AGENT_ID];

        const allRes = await Promise.all(
          agentIds.map((aid) =>
            fetch(`${httpUrlRef.current}/api/sessions?agentId=${aid}`)
              .then((r) => r.json())
              .then((d) => ({ data: d, agentId: aid }))
              .catch(() => null),
          ),
        );

        const seen = new Set<string>();
        let allSessions: SessionInfo[] = [];
        let firstActive: string | undefined;

        for (const item of allRes) {
          if (!item || !item.data.ok || !Array.isArray(item.data.sessions))
            continue;
          for (const s of item.data.sessions as SessionInfo[]) {
            if (seen.has(s.id)) continue;
            seen.add(s.id);
            allSessions.push(s);
          }
          if (!firstActive && item.data.activeSessionId) {
            firstActive = item.data.activeSessionId;
          }
        }

        allSessions.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setSessions(allSessions);
        sessionsRef.current = allSessions;

        if (
          !currentSessionRef.current &&
          allSessions.length > 0 &&
          !blockAutoFallbackRef.current
        ) {
          const active = firstActive ?? allSessions[0]?.id;
          if (active) {
            setCurrentSessionId(active);
            subscribeToSession(active);
            loadHistory(active);
          }
        }
      } catch {
        /* offline */
      }
    },
    [subscribeToSession, loadHistory],
  );

  useEffect(() => {
    isUnmountedRef.current = false;
    reconnectAttemptRef.current = 0;
    connect();
    return () => {
      isUnmountedRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      pendingAckRef.current.forEach((timer) => clearTimeout(timer));
      pendingAckRef.current.clear();
      wsRef.current?.close();
    };
    // reconnect when wsUrl changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  useEffect(() => {
    if (connectionStatus === "connected") {
      fetchAgents().then((a) => fetchSessions(a));
    }
  }, [connectionStatus, fetchSessions, fetchAgents]);

  const uploadImage = useCallback(
    async (img: ImageAttachment): Promise<string | null> => {
      try {
        const uri = img.uri;
        const filename = uri.split("/").pop() ?? "image.jpg";
        const formData = new FormData();
        formData.append("file", {
          uri,
          name: filename,
          type: "image/jpeg",
        } as any);

        const res = await fetch(`${httpUrlRef.current}/api/upload-image`, {
          method: "POST",
          body: formData,
        });
        const data = (await res.json()) as {
          ok: boolean;
          path?: string;
          error?: string;
        };
        return data.ok ? (data.path ?? null) : null;
      } catch {
        return null;
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      content: string,
      images?: ImageAttachment[],
      reply?: ReplyPreview | null,
    ) => {
      const text = content.trim();
      if (
        (!text && !images?.length) ||
        !wsRef.current ||
        wsRef.current.readyState !== WebSocket.OPEN
      )
        return;

      if (streamingMsgRef.current) {
        finalizeStreamingMessage(streamingMsgRef.current);
      }
      removeTyping();

      const messageId = `local-${Date.now()}`;
      const msg: ChatMessage = {
        id: messageId,
        role: "user",
        content: text,
        localStatus: "sending",
        replyTo: reply ?? undefined,
        images: images?.length ? images : undefined,
        createdAt: Date.now(),
      };
      seenRef.current.add(messageId);

      streamedDoneRef.current = false;
      const typingId = `typing-${Date.now()}`;
      typingIdRef.current = typingId;
      setStream((prev) => [
        ...prev,
        { kind: "message" as const, data: msg },
        { kind: "typing" as const, id: typingId },
      ]);

      setSending(true);

      const currentSid = currentSessionRef.current;
      const isNew = isPendingSession(currentSid);

      if (isNew) {
        const pendingSession = sessionsRef.current.find(
          (s) => s.id === currentSid,
        );
        const titleText = text.length > 50 ? text.slice(0, 50) + "..." : text;
        if (pendingSession) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSid ? { ...s, title: titleText } : s,
            ),
          );
          sessionsRef.current = sessionsRef.current.map((s) =>
            s.id === currentSid ? { ...s, title: titleText } : s,
          );
        }
      }

      let imagePaths: string[] | undefined;
      if (images?.length) {
        const results = await Promise.all(images.map(uploadImage));
        imagePaths = results.filter((p): p is string => p !== null);
      }

      const wsPayload: Record<string, unknown> = {
        type: "send_message",
        sessionId: currentSid,
        messageId,
        content: text,
        agentId: isNew ? getAgentId(currentSid) : getAgentId(),
      };
      if (isNew) {
        wsPayload.newSession = true;
      }
      if (imagePaths?.length) {
        wsPayload.imagePaths = imagePaths;
      }
      if (reply?.messageId) {
        wsPayload.replyToId = reply.messageId;
      }
      if (reply?.body) {
        wsPayload.replyToBody = reply.body;
      }
      if (reply?.senderName) {
        wsPayload.replyToSender = reply.senderName;
      }

      wsRef.current.send(JSON.stringify(wsPayload));
      const ackTimer = setTimeout(() => {
        pendingAckRef.current.delete(messageId);
        markLocalMessageStatus(messageId, "failed");
        removeTyping();
        setSending(false);
      }, ACK_TIMEOUT_MS);
      pendingAckRef.current.set(messageId, ackTimer);
      setTimeout(() => setSending(false), 80);
    },
    [
      uploadImage,
      finalizeStreamingMessage,
      removeTyping,
      getAgentId,
      markLocalMessageStatus,
    ],
  );

  const forwardMessage = useCallback(
    (targetSessionId: string, content: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !content.trim()) return;
      ws.send(
        JSON.stringify({
          type: "send_message",
          sessionId: targetSessionId,
          messageId: `forward-${Date.now()}`,
          content: content.trim(),
          agentId: getAgentId(targetSessionId),
        }),
      );
    },
    [getAgentId],
  );

  const switchSession = useCallback(
    (newSessionId: string) => {
      blockAutoFallbackRef.current = false;
      const oldSessionId = currentSessionRef.current;
      if (oldSessionId && !isPendingSession(oldSessionId)) {
        unsubscribeFromSession(oldSessionId);
      }

      setStream([]);
      seenRef.current.clear();
      bufferRef.current = [];
      streamingMsgRef.current = null;
      streamedDoneRef.current = false;
      typingIdRef.current = null;
      pendingAckRef.current.forEach((timer) => clearTimeout(timer));
      pendingAckRef.current.clear();
      lastSeqRef.current = 0;
      setCurrentSessionId(newSessionId);

      if (!isPendingSession(newSessionId)) {
        subscribeToSession(newSessionId);
        loadHistory(newSessionId);
      }
    },
    [subscribeToSession, unsubscribeFromSession, loadHistory],
  );

  const refreshSessions = useCallback(async () => {
    await fetchSessions();
  }, [fetchSessions]);

  const createNewSession = useCallback(
    async (agentId?: string) => {
      blockAutoFallbackRef.current = false;
      const resolvedAgent = agentId ?? getAgentId();
      const pendingId = `${PENDING_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const pendingSession: SessionInfo = {
        id: pendingId,
        agentId: resolvedAgent,
        jsonlPath: "",
        createdAt: new Date().toISOString(),
        title: "",
      };

      setSessions((prev) => [pendingSession, ...prev]);
      sessionsRef.current = [pendingSession, ...sessionsRef.current];

      setStream([]);
      seenRef.current.clear();
      bufferRef.current = [];
      streamingMsgRef.current = null;
      streamedDoneRef.current = false;
      typingIdRef.current = null;
      pendingAckRef.current.forEach((timer) => clearTimeout(timer));
      pendingAckRef.current.clear();
      lastSeqRef.current = 0;

      const oldSessionId = currentSessionRef.current;
      if (oldSessionId && !isPendingSession(oldSessionId)) {
        unsubscribeFromSession(oldSessionId);
      }
      setCurrentSessionId(pendingId);

      return pendingId;
    },
    [getAgentId, unsubscribeFromSession],
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      if (
        currentSessionRef.current === sessionId &&
        !isPendingSession(sessionId)
      ) {
        unsubscribeFromSession(sessionId);
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      sessionsRef.current = sessionsRef.current.filter(
        (s) => s.id !== sessionId,
      );

      if (currentSessionRef.current === sessionId) {
        setSessions((prev) => {
          const remaining = prev.filter((s) => s.id !== sessionId);
          if (remaining.length > 0) {
            switchSession(remaining[0].id);
          } else {
            setStream([]);
            seenRef.current.clear();
            bufferRef.current = [];
            setCurrentSessionId("");
          }
          return remaining;
        });
      }
    },
    [switchSession, unsubscribeFromSession],
  );

  return useMemo(
    () => ({
      connectionStatus,
      currentSessionId,
      sessions,
      agents,
      stream,
      sending,
      sendMessage,
      forwardMessage,
      switchSession,
      createNewSession,
      deleteSession,
      refreshSessions,
      gatewayHttpUrl: httpUrl,
    }),
    [
      connectionStatus,
      currentSessionId,
      sessions,
      agents,
      stream,
      sending,
      sendMessage,
      forwardMessage,
      switchSession,
      createNewSession,
      deleteSession,
      refreshSessions,
      httpUrl,
    ],
  );
};
