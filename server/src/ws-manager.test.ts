import { describe, expect, it } from "bun:test";
import { emitEvent, emitEventTo, subscribeSession, unsubscribeAll } from "./ws-manager";

describe("ws-manager dedupe", () => {
  it("drops duplicate events in the dedupe window", () => {
    const packets: string[] = [];
    const socket = {
      send: (data: string) => packets.push(data),
    };
    subscribeSession("s1", socket);

    emitEvent({
      type: "status",
      sessionId: "s1",
      messageId: "m1",
      payload: { a: 1 },
    });
    emitEvent({
      type: "status",
      sessionId: "s1",
      messageId: "m1",
      payload: { a: 1 },
    });

    expect(packets.length).toBe(1);
    unsubscribeAll(socket);
  });

  it("keeps agent-scoped subscriptions isolated", () => {
    const packetsA: string[] = [];
    const packetsB: string[] = [];
    const socketA = {
      send: (data: string) => packetsA.push(data),
    };
    const socketB = {
      send: (data: string) => packetsB.push(data),
    };

    subscribeSession("main::shared", socketA);
    subscribeSession("worker::shared", socketB);

    emitEventTo("main::shared", {
      type: "message_done",
      sessionId: "shared",
      messageId: "m-route-1",
      payload: { ok: true },
    });

    expect(packetsA.length).toBe(1);
    expect(packetsB.length).toBe(0);
    unsubscribeAll(socketA);
    unsubscribeAll(socketB);
  });
});
