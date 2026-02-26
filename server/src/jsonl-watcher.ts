import { open, stat } from "node:fs/promises";
import { JSONL_POLL_INTERVAL_MS } from "./config";
import { emitEvent } from "./ws-manager";
import type { OpenClawJsonlEntry, OpenClawMessage } from "./types";

type Watcher = {
  timer: Timer;
  position: number;
  remainder: string;
  reading: boolean;
  sessionId: string;
  logFile: string;
};

const watchers = new Map<string, Watcher>();

export const classifyEntry = (entry: OpenClawJsonlEntry): {
  eventType: "message" | "thought" | "action" | "observation" | "status" | "error";
  payload: Record<string, unknown>;
} | null => {
  if (entry.type === "message") {
    const msg = (entry as OpenClawMessage).message;
    if (!msg) return { eventType: "observation", payload: { source: "jsonl", raw: entry } };

    if (msg.role === "user") {
      return null;
    }

    if (msg.role === "assistant") {
      const contents = msg.content ?? [];
      const thoughts: string[] = [];
      const texts: string[] = [];
      const toolCalls: Record<string, unknown>[] = [];

      for (const block of contents) {
        if (block.type === "thinking" && block.thinking) {
          thoughts.push(block.thinking as string);
        } else if (block.type === "text" && block.text) {
          texts.push(block.text as string);
        } else if (block.type === "toolCall") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.arguments,
          });
        }
      }

      if (toolCalls.length > 0) {
        return {
          eventType: "action",
          payload: {
            toolCalls,
            thinking: thoughts.join("\n") || undefined,
            thinkingSummary: extractThinkingSummary(contents),
            text: texts.join("\n") || undefined,
            usage: msg.usage,
            stopReason: msg.stopReason,
            raw: entry,
          },
        };
      }

      if (thoughts.length > 0 && texts.length === 0) {
        return {
          eventType: "thought",
          payload: {
            thinking: thoughts.join("\n"),
            thinkingSummary: extractThinkingSummary(contents),
            usage: msg.usage,
            raw: entry,
          },
        };
      }

      return {
        eventType: "message",
        payload: {
          role: "assistant",
          content: texts.join("\n"),
          thinking: thoughts.join("\n") || undefined,
          thinkingSummary: extractThinkingSummary(contents),
          usage: msg.usage,
          stopReason: msg.stopReason,
          raw: entry,
        },
      };
    }

    if (msg.role === "toolResult") {
      return {
        eventType: "observation",
        payload: {
          toolCallId: msg.toolCallId,
          toolName: msg.toolName,
          content: extractTextContent(msg.content),
          isError: (entry as any).isError ?? false,
          details: (entry as any).details,
          raw: entry,
        },
      };
    }

    return { eventType: "observation", payload: { source: "jsonl", raw: entry } };
  }

  if (entry.type === "session" || entry.type === "model_change" || entry.type === "thinking_level_change") {
    return { eventType: "status", payload: { source: "jsonl", subtype: entry.type, raw: entry } };
  }

  if (entry.type === "custom") {
    return { eventType: "status", payload: { source: "jsonl", subtype: "custom", customType: (entry as any).customType, raw: entry } };
  }

  return { eventType: "observation", payload: { source: "jsonl", raw: entry } };
};

const extractTextContent = (content?: Array<{ type: string; text?: string; [key: string]: unknown }>): string => {
  if (!content) return "";
  return content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("\n");
};

const extractThinkingSummary = (content?: Array<{ type: string; thinkingSignature?: string; thinking?: string; [key: string]: unknown }>): string | undefined => {
  if (!content) return undefined;
  for (const block of content) {
    if (block.type === "thinking" && block.thinkingSignature) {
      try {
        const sig = JSON.parse(block.thinkingSignature as string);
        if (sig.summary?.[0]?.text) return sig.summary[0].text;
      } catch { /* ignore */ }
    }
    if (block.type === "thinking" && block.thinking) {
      return block.thinking as string;
    }
  }
  return undefined;
};

export const startWatcher = async (sessionId: string, logFile: string) => {
  if (watchers.has(sessionId)) return;

  const initial = await stat(logFile).catch(() => null);
  const watcher: Watcher = {
    timer: setInterval(async () => {
      if (watcher.reading) return;
      watcher.reading = true;
      try {
        const info = await stat(logFile).catch(() => null);
        if (!info || info.size <= watcher.position) return;

        const length = Number(info.size - watcher.position);
        const handle = await open(logFile, "r");
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, watcher.position);
        await handle.close();

        watcher.position = Number(info.size);
        const text = watcher.remainder + buffer.toString("utf8");
        const lines = text.split("\n");
        watcher.remainder = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const entry = JSON.parse(trimmed) as OpenClawJsonlEntry;
            const result = classifyEntry(entry);
            if (!result) continue;
            emitEvent({
              type: result.eventType,
              sessionId,
              messageId: entry.id,
              payload: result.payload,
            });
          } catch {
            emitEvent({
              type: "error",
              sessionId,
              payload: { message: "Failed to parse JSONL line", line: trimmed.slice(0, 200) },
            });
          }
        }
      } catch (error) {
        emitEvent({
          type: "error",
          sessionId,
          payload: { message: (error as Error).message },
        });
      } finally {
        watcher.reading = false;
      }
    }, JSONL_POLL_INTERVAL_MS),
    position: initial ? Number(initial.size) : 0,
    remainder: "",
    reading: false,
    sessionId,
    logFile,
  };

  watchers.set(sessionId, watcher);
};

export const stopWatcher = (sessionId: string) => {
  const watcher = watchers.get(sessionId);
  if (!watcher) return;
  clearInterval(watcher.timer);
  watchers.delete(sessionId);
};

export const isWatching = (sessionId: string): boolean => watchers.has(sessionId);

export const getActiveWatchers = (): string[] => [...watchers.keys()];
