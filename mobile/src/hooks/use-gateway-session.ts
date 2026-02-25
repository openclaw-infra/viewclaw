import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatMessage,
  ConnectionStatus,
  ExecutionLog,
  GatewayEvent,
  SessionInfo,
  StreamItem,
} from "../types/gateway";

const DEFAULT_WS_URL = process.env.EXPO_PUBLIC_GATEWAY_WS_URL ?? "ws://127.0.0.1:3000";
const DEFAULT_HTTP_URL =
  process.env.EXPO_PUBLIC_GATEWAY_HTTP_URL ?? DEFAULT_WS_URL.replace(/^ws/, "http");

type Options = {
  agentId?: string;
  sessionId?: string;
};

type WsIncoming =
  | GatewayEvent
  | { type: "pong" | "ack" | "connected" | "subscribed" | "unsubscribed"; [k: string]: unknown };

export const useGatewaySession = ({ agentId = "main", sessionId: initialSessionId }: Options) => {
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
  const currentSessionRef = useRef(currentSessionId);
  const agentIdRef = useRef(agentId);
  const typingIdRef = useRef<string | null>(null);

  currentSessionRef.current = currentSessionId;
  agentIdRef.current = agentId;

  const bufferRef = useRef<StreamItem[]>([]);

  const flush = useCallback(() => {
    const buf = bufferRef.current;
    if (buf.length === 0) return;
    bufferRef.current = [];
    setStream((prev) => {
      const typingIdx = prev.findIndex((item) => item.kind === "typing");
      if (typingIdx === -1) {
        return [...prev, ...buf].slice(-500);
      }
      const before = prev.slice(0, typingIdx);
      const typing = prev[typingIdx];
      return [...before, ...buf, typing].slice(-500);
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
    bufferRef.current.push({ kind: "log", data: log });
  }, []);

  const removeTyping = useCallback(() => {
    if (!typingIdRef.current) return;
    const tid = typingIdRef.current;
    typingIdRef.current = null;
    setStream((prev) => prev.filter((item) => !(item.kind === "typing" && item.id === tid)));
  }, []);

  const parseEvent = useCallback(
    (event: GatewayEvent) => {
      const p = event.payload;

      if (event.type === "message") {
        const role = p.role === "assistant" ? "assistant" : "user";
        const content = String(p.content ?? "");
        if (!content) return;

        if (role === "assistant") removeTyping();

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
          id: `log-${event.seq}`,
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
              id: `log-${event.seq}-${tc.name}`,
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
            id: `log-${event.seq}`,
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
          id: `log-${event.seq}`,
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
          id: `log-${event.seq}`,
          level: "error",
          text: typeof p.message === "string" ? p.message : "Error",
          createdAt: event.ts,
        });
        return;
      }

      if (event.type === "status") {
        appendLog({
          id: `log-${event.seq}`,
          level: "status",
          text: typeof p.subtype === "string" ? p.subtype : "status",
          createdAt: event.ts,
        });
        return;
      }

      if (event.type === "done") {
        removeTyping();
        appendLog({
          id: `log-${event.seq}`,
          level: "done",
          text: "Done",
          createdAt: event.ts,
        });
      }
    },
    [appendMessage, appendLog, removeTyping]
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
      wsSend({ type: "subscribe_session", sessionId, agentId: agentIdRef.current });
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

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    setConnectionStatus("connecting");

    const ws = new WebSocket(`${DEFAULT_WS_URL}/stream`);
    wsRef.current = ws;

    ws.onopen = () => {
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
            agentId: agentIdRef.current,
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
        appendLog({
          id: `log-subscribed-${Date.now()}`,
          level: "status",
          text: `Watching session ${parsed.sessionId}`,
          createdAt: Date.now(),
        });
        return;
      }

      if (parsed.type === "connected") return;

      parseEvent(parsed as GatewayEvent);
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      if (pingRef.current) clearInterval(pingRef.current);
      if (!isUnmountedRef.current) {
        reconnectRef.current = setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => setConnectionStatus("disconnected");
  }, [appendLog, parseEvent]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${DEFAULT_HTTP_URL}/api/sessions?agentId=${agentId}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        if (!currentSessionRef.current && data.sessions.length > 0) {
          const active = data.activeSessionId ?? data.sessions[0]?.id;
          if (active) {
            setCurrentSessionId(active);
            subscribeToSession(active);
          }
        }
      }
    } catch { /* offline */ }
  }, [agentId, subscribeToSession]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();
    return () => {
      isUnmountedRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    if (connectionStatus === "connected") {
      fetchSessions();
    }
  }, [connectionStatus, fetchSessions]);

  const sendMessage = useCallback(
    (content: string) => {
      const text = content.trim();
      if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const messageId = `local-${Date.now()}`;
      const msg: ChatMessage = { id: messageId, role: "user", content: text, createdAt: Date.now() };
      seenRef.current.add(messageId);

      const typingId = `typing-${Date.now()}`;
      typingIdRef.current = typingId;
      setStream((prev) => [
        ...prev,
        { kind: "message" as const, data: msg },
        { kind: "typing" as const, id: typingId },
      ]);

      setSending(true);
      wsRef.current.send(
        JSON.stringify({
          type: "send_message",
          sessionId: currentSessionRef.current,
          messageId,
          content: text,
          agentId,
        })
      );
      setTimeout(() => setSending(false), 80);
    },
    [agentId, appendMessage]
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
      setCurrentSessionId(newSessionId);
      subscribeToSession(newSessionId);
    },
    [subscribeToSession, unsubscribeFromSession]
  );

  return useMemo(
    () => ({
      connectionStatus,
      currentSessionId,
      sessions,
      stream,
      sending,
      sendMessage,
      switchSession,
      gatewayHttpUrl: DEFAULT_HTTP_URL,
    }),
    [connectionStatus, currentSessionId, sessions, stream, sending, sendMessage, switchSession]
  );
};
