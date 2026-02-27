import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatMessage,
  ConnectionStatus,
  ExecutionLog,
  GatewayEvent,
  ImageAttachment,
  SessionInfo,
  StreamItem,
} from "../types/gateway";

const FALLBACK_WS = "ws://127.0.0.1:3000";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

type Options = {
  sessionId?: string;
  wsUrl?: string;
  httpUrl?: string;
  onMessageDone?: () => void;
};

type WsIncoming =
  | GatewayEvent
  | { type: "pong" | "ack" | "connected" | "subscribed" | "unsubscribed" | "unknown_message"; [k: string]: unknown };

const AGENT_ID = "main";

export const useGatewaySession = ({
  sessionId: initialSessionId,
  wsUrl: externalWsUrl,
  onMessageDone,
  httpUrl: externalHttpUrl,
}: Options) => {
  const wsUrl = externalWsUrl || FALLBACK_WS;
  const httpUrl = externalHttpUrl || wsUrl.replace(/^ws(s?)/, "http$1");

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [stream, setStream] = useState<StreamItem[]>([]);
  const [sending, setSending] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(initialSessionId ?? "");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const lastSeqRef = useRef(0);
  const currentSessionRef = useRef(currentSessionId);
  const typingIdRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const wsUrlRef = useRef(wsUrl);
  const httpUrlRef = useRef(httpUrl);
  const onMessageDoneRef = useRef(onMessageDone);

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
        (item) => item.kind === "message" && item.data.streaming
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
    setStream((prev) => prev.filter((item) => !(item.kind === "typing" && item.id === tid)));
  }, []);

  const streamingMsgRef = useRef<string | null>(null);
  const streamedDoneRef = useRef(false);

  const updateStreamingMessage = useCallback((messageId: string, delta: string) => {
    setStream((prev) => {
      const idx = prev.findIndex(
        (item) => item.kind === "message" && item.data.id === messageId
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
  }, []);

  const finalizeStreamingMessage = useCallback((messageId: string, content?: string) => {
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
              content: finalContent.replace(/^\[\[reply_to_current\]\]\s*/i, ""),
              streaming: false,
            },
          };
        }
        return item;
      })
    );
  }, []);

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
            (item) => item.kind === "message" && item.data.id === msgId
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
          return [...prev.filter((i) => i.kind !== "typing"), { kind: "message" as const, data: msg }];
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
        if (msgId) {
          finalizeStreamingMessage(msgId, content);
        }
        onMessageDoneRef.current?.();
        return;
      }

      if (event.type === "message") {
        const role = p.role === "assistant" ? "assistant" : "user";
        const content = String(p.content ?? "");
        if (!content) return;

        if (role === "assistant") {
          if (streamingMsgRef.current || streamedDoneRef.current) return;
          removeTyping();
        }

        let cleanContent = content;
        if (role === "assistant") {
          cleanContent = content.replace(/^\[\[reply_to_current\]\]\s*/i, "");
        }

        appendMessage({
          id: event.messageId ?? `msg-${event.seq}`,
          role,
          content: cleanContent,
          thinking: typeof p.thinking === "string" ? p.thinking : undefined,
          thinkingSummary: typeof p.thinkingSummary === "string" ? p.thinkingSummary : undefined,
          createdAt: event.ts,
        });
        return;
      }

      if (event.type === "thought") {
        const summary = typeof p.thinkingSummary === "string" ? p.thinkingSummary : "";
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
        const toolCalls = p.toolCalls as Array<{ name?: string; arguments?: unknown }> | undefined;
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
          text: toolName ? `${toolName} returned` : content.slice(0, 200) || "Observation",
          detail: content.length > 200 ? content.slice(0, 500) + "..." : content,
          toolName,
          createdAt: event.ts,
        });
        return;
      }

      if (event.type === "error") {
        appendLog({
          id: `log-${event.sessionId}-${event.seq}`,
          level: "error",
          text: typeof p.message === "string" ? p.message : "Error",
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
    [appendMessage, appendLog, removeTyping, updateStreamingMessage, finalizeStreamingMessage]
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
      wsSend({ type: "subscribe_session", sessionId, agentId: AGENT_ID });
    },
    [wsSend]
  );

  const unsubscribeFromSession = useCallback(
    (sessionId: string) => {
      if (!sessionId) return;
      wsSend({ type: "unsubscribe_session", sessionId });
    },
    [wsSend]
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
            agentId: AGENT_ID,
          })
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

      if (parsed.type === "pong" || parsed.type === "ack") return;

      if (parsed.type === "subscribed") {
        return;
      }

      if (parsed.type === "connected") return;

      const evt = parsed as GatewayEvent;
      if (evt.sessionId && currentSessionRef.current && evt.sessionId !== currentSessionRef.current) {
        return;
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
  }, [appendLog, parseEvent, scheduleReconnect]);

  const loadHistory = useCallback(async (sessionId: string) => {
    try {
      const baseUrl = httpUrlRef.current;
      const res = await fetch(
        `${baseUrl}/api/sessions/${sessionId}/history?agentId=${AGENT_ID}&limit=100`
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
          const images: ImageAttachment[] | undefined =
            m.imagePaths?.length
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
            thinking: m.thinking,
            thinkingSummary: m.thinkingSummary,
            images,
            createdAt: m.ts ? new Date(m.ts).getTime() : 0,
          };
          items.push({ kind: "message", data: msg });
        } else if (m.type === "thought" || m.type === "action" || m.type === "observation" || m.type === "error") {
          let text = "";
          if (m.type === "thought") {
            text = m.thinkingSummary || m.thinking || "Thinking...";
          } else if (m.type === "action") {
            const tc = m.toolCalls as Array<{ name?: string }> | undefined;
            text = tc?.[0]?.name ?? m.content ?? "Action";
          } else if (m.type === "observation") {
            text = m.toolName ? `${m.toolName} returned` : (m.content?.slice(0, 200) || "Observation");
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
    } catch { /* offline */ }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${httpUrlRef.current}/api/sessions?agentId=${AGENT_ID}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        if (!currentSessionRef.current && data.sessions.length > 0) {
          const active = data.activeSessionId ?? data.sessions[0]?.id;
          if (active) {
            setCurrentSessionId(active);
            subscribeToSession(active);
            loadHistory(active);
          }
        }
      }
    } catch { /* offline */ }
  }, [subscribeToSession, loadHistory]);

  useEffect(() => {
    isUnmountedRef.current = false;
    reconnectAttemptRef.current = 0;
    connect();
    return () => {
      isUnmountedRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
    // reconnect when wsUrl changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  useEffect(() => {
    if (connectionStatus === "connected") {
      fetchSessions();
    }
  }, [connectionStatus, fetchSessions]);

  const uploadImage = useCallback(
    async (img: ImageAttachment): Promise<string | null> => {
      try {
        const uri = img.uri;
        const filename = uri.split("/").pop() ?? "image.jpg";
        const formData = new FormData();
        formData.append("file", { uri, name: filename, type: "image/jpeg" } as any);

        const res = await fetch(`${httpUrlRef.current}/api/upload-image`, {
          method: "POST",
          body: formData,
        });
        const data = (await res.json()) as { ok: boolean; path?: string; error?: string };
        return data.ok ? (data.path ?? null) : null;
      } catch {
        return null;
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (content: string, images?: ImageAttachment[]) => {
      const text = content.trim();
      if ((!text && !images?.length) || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      if (streamingMsgRef.current) {
        finalizeStreamingMessage(streamingMsgRef.current);
      }
      removeTyping();

      const messageId = `local-${Date.now()}`;
      const msg: ChatMessage = {
        id: messageId,
        role: "user",
        content: text,
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

      let imagePaths: string[] | undefined;
      if (images?.length) {
        const results = await Promise.all(images.map(uploadImage));
        imagePaths = results.filter((p): p is string => p !== null);
      }

      const wsPayload: Record<string, unknown> = {
        type: "send_message",
        sessionId: currentSessionRef.current,
        messageId,
        content: text,
        agentId: AGENT_ID,
      };
      if (imagePaths?.length) {
        wsPayload.imagePaths = imagePaths;
      }

      wsRef.current.send(JSON.stringify(wsPayload));
      setTimeout(() => setSending(false), 80);
    },
    [uploadImage, finalizeStreamingMessage, removeTyping],
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
          agentId: AGENT_ID,
        }),
      );
    },
    [],
  );

  const switchSession = useCallback(
    (newSessionId: string) => {
      const oldSessionId = currentSessionRef.current;
      if (oldSessionId) {
        unsubscribeFromSession(oldSessionId);
      }

      setStream([]);
      seenRef.current.clear();
      bufferRef.current = [];
      streamingMsgRef.current = null;
      streamedDoneRef.current = false;
      typingIdRef.current = null;
      lastSeqRef.current = 0;
      setCurrentSessionId(newSessionId);
      subscribeToSession(newSessionId);
      loadHistory(newSessionId);
    },
    [subscribeToSession, unsubscribeFromSession, loadHistory]
  );

  const refreshSessions = useCallback(async () => {
    await fetchSessions();
  }, [fetchSessions]);

  const createNewSession = useCallback(async () => {
    try {
      const res = await fetch(`${httpUrlRef.current}/api/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: AGENT_ID }),
      });
      const data = await res.json();
      if (data.ok && data.sessionId) {
        await fetchSessions();
        switchSession(data.sessionId);
        return data.sessionId as string;
      }
    } catch { /* offline */ }
    return null;
  }, [fetchSessions, switchSession]);

  const deleteSession = useCallback(
    (sessionId: string) => {
      if (currentSessionRef.current === sessionId) {
        unsubscribeFromSession(sessionId);
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

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
    [switchSession, unsubscribeFromSession]
  );

  return useMemo(
    () => ({
      connectionStatus,
      currentSessionId,
      sessions,
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
    [connectionStatus, currentSessionId, sessions, stream, sending, sendMessage, forwardMessage, switchSession, createNewSession, deleteSession, refreshSessions, httpUrl]
  );
};
