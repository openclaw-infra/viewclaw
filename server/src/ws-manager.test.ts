import { describe, expect, it } from "bun:test";
import { emitEvent, subscribeSession, unsubscribeAll } from "./ws-manager";

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
});
