import type { StreamEvent } from "./types";

let seq = 0;
const nextSeq = () => ++seq;

const socketBySession = new Map<string, Set<any>>();
const socketMeta = new WeakMap<any, { sessions: Set<string> }>();
const dedupeWindowByKey = new Map<string, number>();
const DEDUPE_TTL_MS = 2_000;
const DEDUPE_TYPES = new Set(["message_start", "message_done", "thought", "action", "observation", "status", "error"]);

const shouldDropDuplicate = (event: Omit<StreamEvent, "seq" | "ts">): boolean => {
  if (!event.messageId || !DEDUPE_TYPES.has(event.type)) return false;
  const key = `${event.sessionId}|${event.type}|${event.messageId}`;
  const now = Date.now();
  const prev = dedupeWindowByKey.get(key);
  dedupeWindowByKey.set(key, now);

  if (dedupeWindowByKey.size > 5000) {
    const cutoff = now - DEDUPE_TTL_MS;
    for (const [k, ts] of dedupeWindowByKey) {
      if (ts < cutoff) dedupeWindowByKey.delete(k);
    }
  }
  return prev != null && now - prev < DEDUPE_TTL_MS;
};

export const emitEvent = (event: Omit<StreamEvent, "seq" | "ts">) => {
  if (shouldDropDuplicate(event)) return;
  const packet: StreamEvent = {
    ...event,
    seq: nextSeq(),
    ts: Date.now(),
  };
  const sockets = socketBySession.get(packet.sessionId);
  if (!sockets || sockets.size === 0) return;
  const data = JSON.stringify(packet);
  for (const socket of sockets) socket.send(data);
};

export const emitEventTo = (routingKey: string, event: Omit<StreamEvent, "seq" | "ts">) => {
  if (shouldDropDuplicate(event)) return;
  const packet: StreamEvent = {
    ...event,
    seq: nextSeq(),
    ts: Date.now(),
  };
  const data = JSON.stringify(packet);
  const seen = new Set<any>();
  for (const key of new Set([routingKey, packet.sessionId])) {
    const sockets = socketBySession.get(key);
    if (!sockets || sockets.size === 0) continue;
    for (const socket of sockets) {
      if (seen.has(socket)) continue;
      seen.add(socket);
      socket.send(data);
    }
  }
};

export const broadcastToAll = (event: Omit<StreamEvent, "seq" | "ts" | "sessionId">) => {
  const packet = { ...event, seq: nextSeq(), ts: Date.now(), sessionId: "__broadcast__" };
  const data = JSON.stringify(packet);
  const seen = new Set<any>();
  for (const sockets of socketBySession.values()) {
    for (const socket of sockets) {
      if (seen.has(socket)) continue;
      seen.add(socket);
      socket.send(data);
    }
  }
};

export const subscribeSession = (sessionId: string, ws: any) => {
  if (!socketBySession.has(sessionId)) socketBySession.set(sessionId, new Set());
  socketBySession.get(sessionId)!.add(ws);

  let meta = socketMeta.get(ws);
  if (!meta) {
    meta = { sessions: new Set() };
    socketMeta.set(ws, meta);
  }
  meta.sessions.add(sessionId);
};

export const unsubscribeSession = (sessionId: string, ws: any) => {
  const sockets = socketBySession.get(sessionId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) socketBySession.delete(sessionId);
  }
  const meta = socketMeta.get(ws);
  if (meta) meta.sessions.delete(sessionId);
};

export const unsubscribeAll = (ws: any): string[] => {
  const meta = socketMeta.get(ws);
  if (!meta) return [];
  const sessions = [...meta.sessions];
  for (const sessionId of sessions) {
    const sockets = socketBySession.get(sessionId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) socketBySession.delete(sessionId);
    }
  }
  meta.sessions.clear();
  return sessions;
};

export const getSubscribedSessions = (ws: any): string[] => {
  const meta = socketMeta.get(ws);
  return meta ? [...meta.sessions] : [];
};

export const getSessionSubscriberCount = (sessionId: string): number => {
  return socketBySession.get(sessionId)?.size ?? 0;
};
