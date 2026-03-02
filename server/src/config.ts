import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { isPluginMode, getPortFromKernel, getTokenFromKernel } from "./kernel";

export const PORT = (() => {
  if (isPluginMode()) {
    const kPort = getPortFromKernel();
    if (kPort) return kPort;
  }
  return Number(process.env.PORT ?? 3000);
})();

export const OPENCLAW_HOME = process.env.OPENCLAW_HOME ?? join(homedir(), ".openclaw");
export const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL ?? "http://127.0.0.1:18789";

export const JSONL_POLL_INTERVAL_MS = 150;

export const WHISPER_API_URL =
  process.env.WHISPER_API_URL ?? "https://api.openai.com/v1/audio/transcriptions";
export const WHISPER_API_KEY = process.env.OPENAI_API_KEY ?? "";
export const WHISPER_MODEL = process.env.WHISPER_MODEL ?? "whisper-1";

/** How often to run the upload cleanup (minutes). 0 = disabled. Default: 30 */
export const UPLOAD_CLEANUP_INTERVAL_MIN = Number(process.env.UPLOAD_CLEANUP_INTERVAL_MIN ?? 30);

/** Max age of uploaded images before deletion (minutes). Default: 60 */
export const UPLOAD_MAX_AGE_MIN = Number(process.env.UPLOAD_MAX_AGE_MIN ?? 60);

export const normalizeToken = (token?: string | null): string => {
  if (!token) return "";
  return token.trim();
};

let cachedToken: string | null = null;

export const getGatewayToken = async (): Promise<string> => {
  if (isPluginMode()) {
    const kToken = getTokenFromKernel();
    if (kToken) return kToken;
  }

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
