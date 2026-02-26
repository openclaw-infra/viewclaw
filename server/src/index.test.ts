import { describe, expect, it } from "bun:test";
import { app } from "./index";
import { normalizeToken } from "./config";

describe("gateway http interfaces", () => {
  it("GET /", async () => {
    const res = await app.handle(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { name: string; ok: boolean };
    expect(data.ok).toBe(true);
    expect(data.name).toBe("ClawFlow Gateway");
  });

  it("GET /healthz", async () => {
    const res = await app.handle(new Request("http://localhost/healthz"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; now: number };
    expect(data.ok).toBe(true);
    expect(typeof data.now).toBe("number");
  });

  it("GET /api/agents", async () => {
    const res = await app.handle(new Request("http://localhost/api/agents"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; agents: unknown[] };
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.agents)).toBe(true);
  });

  it("GET /api/sessions", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/sessions?agentId=main")
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; sessions: unknown[] };
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.sessions)).toBe(true);
  });

  it("POST /api/message validates body", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(422);
  });

  it("POST /api/dev/emit", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/dev/emit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "thought",
          sessionId: "s-test-1",
          payload: { text: "thinking..." },
        }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });
});

describe("normalizeToken", () => {
  it("returns empty for falsy values", () => {
    expect(normalizeToken(null)).toBe("");
    expect(normalizeToken(undefined)).toBe("");
    expect(normalizeToken("")).toBe("");
  });

  it("preserves literal token strings", () => {
    expect(normalizeToken("undefined")).toBe("undefined");
    expect(normalizeToken("null")).toBe("null");
  });

  it("trims and returns valid tokens", () => {
    expect(normalizeToken("  my-token  ")).toBe("my-token");
    expect(normalizeToken("abc123")).toBe("abc123");
  });
});
