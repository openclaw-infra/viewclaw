import { describe, expect, it } from "bun:test";
import { buildClawflowChannelPlugin } from "./channel-plugin";

describe("channel-plugin facade", () => {
  it("migrates legacy root fields into default account", () => {
    const plugin = buildClawflowChannelPlugin({
      getGatewayState: () => ({
        running: false,
        port: 3000,
        lastStartAt: null,
        lastStopAt: null,
        lastError: null,
      }),
      getLogger: () => null,
    }) as any;

    const cfg = {
      channels: {
        clawflow: {
          enabled: true,
          dmPolicy: "allowlist",
          allowFrom: ["alice"],
          requireMention: false,
        },
      },
    };

    const ids = plugin.config.listAccountIds(cfg);
    expect(ids).toContain("mobile");

    const account = plugin.config.resolveAccount(cfg, "mobile");
    expect(account.config.dmPolicy).toBe("allowlist");
    expect(account.config.allowFrom).toEqual(["alice"]);
    expect(account.config.requireMention).toBe(false);
  });

  it("reports warnings for unsafe policy combinations", () => {
    const plugin = buildClawflowChannelPlugin({
      getGatewayState: () => ({
        running: true,
        port: 3000,
        lastStartAt: null,
        lastStopAt: null,
        lastError: null,
      }),
      getLogger: () => null,
    }) as any;

    const account = plugin.config.resolveAccount(
      {
        channels: {
          clawflow: {
            dmPolicy: "open",
            groupPolicy: "open",
            requireMention: false,
          },
        },
      },
      "mobile",
    );

    const warnings = plugin.security.collectWarnings({ account, cfg: {} });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.join("\n")).toContain("open");
  });

  it("sends outbound via callback", async () => {
    let called = 0;
    const plugin = buildClawflowChannelPlugin({
      getGatewayState: () => ({
        running: true,
        port: 3000,
        lastStartAt: null,
        lastStopAt: null,
        lastError: null,
      }),
      getLogger: () => null,
      sendOutbound: async ({ to, text, mediaUrl }) => {
        called++;
        expect(to).toBe("session-1");
        expect(text).toBe("hi");
        expect(mediaUrl).toBe("https://example.com/a.png");
        return { id: "evt-1" };
      },
    }) as any;

    const result = await plugin.outbound.sendMedia({
      to: "session-1",
      text: "hi",
      mediaUrl: "https://example.com/a.png",
    });
    expect(result.id).toBe("evt-1");
    expect(called).toBe(1);
  });

  it("chunks long outbound text into multiple messages", () => {
    const plugin = buildClawflowChannelPlugin({
      getGatewayState: () => ({
        running: true,
        port: 3000,
        lastStartAt: null,
        lastStopAt: null,
        lastError: null,
      }),
      getLogger: () => null,
    }) as any;

    const chunks = plugin.outbound.chunker("A".repeat(4500), 4000);
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk: string) => chunk.length <= 4000)).toBe(true);
  });

  it("probes gateway health via /healthz", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("http://127.0.0.1:3000/healthz");
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
      const plugin = buildClawflowChannelPlugin({
        getGatewayState: () => ({
          running: false,
          port: 3000,
          lastStartAt: null,
          lastStopAt: null,
          lastError: null,
        }),
        getLogger: () => null,
      }) as any;

      const probe = await plugin.status.probeAccount({
        account: { accountId: "mobile", enabled: true, config: {} },
      });

      expect(probe.ok).toBe(true);
      expect(probe.running).toBe(true);
      expect(probe.port).toBe(3000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
