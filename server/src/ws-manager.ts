import type { StreamEvent } from "./types";

let seq = 0;
const nextSeq = () => ++seq;

const socketBySession = new Map<string, Set<any>>();
const socketMeta = new WeakMap<any, { sessions: Set<string> }>();

export const emitEvent = (event: Omit<StreamEvent, "seq" | "ts">) => {
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
