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
});
