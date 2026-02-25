import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export const PORT = Number(process.env.PORT ?? 3000);

export const OPENCLAW_HOME = process.env.OPENCLAW_HOME ?? join(homedir(), ".openclaw");
export const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL ?? "http://127.0.0.1:18789";

export const JSONL_POLL_INTERVAL_MS = 150;

export const normalizeToken = (token?: string | null): string => {
  if (!token) return "";
  return token.trim();
};

let cachedToken: string | null = null;

export const getGatewayToken = async (): Promise<string> => {
  const envToken = normalizeToken(
    process.env.OPENCLAW_TOKEN ?? process.env.OPENCLAW_AUTH_TOKEN ?? process.env.OPENCLAW_GATEWAY_TOKEN
  );
  if (envToken) return envToken;

  if (cachedToken !== null) return cachedToken;

  try {
    const configPath = join(OPENCLAW_HOME, "openclaw.json");
    const raw = await readFile(configPath, "utf8");
    const config = JSON.parse(raw);
    const token = normalizeToken(config?.gateway?.auth?.token);
    cachedToken = token;
    return token;
  } catch {
    cachedToken = "";
    return "";
  }
};

export const invalidateTokenCache = () => {
  cachedToken = null;
};
