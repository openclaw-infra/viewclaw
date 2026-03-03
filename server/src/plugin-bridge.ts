import { randomUUID } from "node:crypto";

const REQ_PREFIX = "__CF_REQ__";
const RES_PREFIX = "__CF_RES__";
const EVT_PREFIX = "__CF_EVT__";

type BridgeResponse = {
  reqId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

type BridgeEvent = {
  type?: string;
  sessionId?: string;
  sessionKey?: string;
  messageId?: string;
  payload?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

let bridgeInitialized = false;

const parseIncomingLine = (line: string, onEvent: (evt: BridgeEvent) => void) => {
  if (!line.startsWith(RES_PREFIX) && !line.startsWith(EVT_PREFIX)) return;
  const raw = line.startsWith(RES_PREFIX)
    ? line.slice(RES_PREFIX.length)
    : line.slice(EVT_PREFIX.length);
  try {
    const parsed = JSON.parse(raw);
    if (line.startsWith(RES_PREFIX)) {
      const res = parsed as BridgeResponse;
      const pending = pendingRequests.get(res.reqId);
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingRequests.delete(res.reqId);
      if (res.ok) pending.resolve(res.result);
      else pending.reject(new Error(res.error ?? "Bridge request failed"));
      return;
    }

    onEvent(parsed as BridgeEvent);
  } catch {
    // ignore malformed bridge payload
  }
};

export const initPluginBridge = (onEvent: (evt: BridgeEvent) => void) => {
  if (bridgeInitialized) return;
  bridgeInitialized = true;
  process.stdin.setEncoding("utf8");

  let buffer = "";
  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      parseIncomingLine(trimmed, onEvent);
    }
  });
};

export const sendBridgeRequest = async <T>(method: string, payload: Record<string, unknown>): Promise<T> => {
  const reqId = randomUUID();
  const packet = `${REQ_PREFIX}${JSON.stringify({ reqId, method, payload })}\n`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(reqId);
      reject(new Error(`Bridge request timeout: ${method}`));
    }, 30_000);

    pendingRequests.set(reqId, { resolve: resolve as (value: unknown) => void, reject, timer });
    process.stdout.write(packet);
  });
};

export const formatBridgeEventLine = (event: BridgeEvent): string =>
  `${EVT_PREFIX}${JSON.stringify(event)}\n`;

export const formatBridgeResponseLine = (response: BridgeResponse): string =>
  `${RES_PREFIX}${JSON.stringify(response)}\n`;

export const bridgePrefixes = {
  request: REQ_PREFIX,
  response: RES_PREFIX,
  event: EVT_PREFIX,
};
