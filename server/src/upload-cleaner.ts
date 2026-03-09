import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { UPLOAD_CLEANUP_INTERVAL_MIN, UPLOAD_MAX_AGE_MIN } from "./config";
import { getWorkspaceDir } from "./openclaw-client";
import { isPluginMode, getWorkspaceDirFromKernel, log } from "./kernel";

let timer: ReturnType<typeof setInterval> | null = null;

const UPLOAD_SUBDIR = ".clawflow-uploads";

/**
 * In plugin mode, files are written directly to the workspace.
 * The cleaner still runs to remove legacy temp files.
 */
export async function getUploadDir(): Promise<string> {
  if (isPluginMode()) {
    const ws = getWorkspaceDirFromKernel();
    if (ws) return ws;
  }
  const workspace = await getWorkspaceDir();
  return join(workspace, UPLOAD_SUBDIR);
}

async function cleanStaleUploads(): Promise<number> {
  const uploadDir = await getUploadDir();

  let entries: string[];
  try {
    entries = await readdir(uploadDir);
  } catch {
    return 0;
  }

  const maxAgeMs = UPLOAD_MAX_AGE_MIN * 60_000;
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  for (const name of entries) {
    try {
      const filePath = join(uploadDir, name);
      const info = await stat(filePath);
      if (info.isFile() && info.mtimeMs < cutoff) {
        await unlink(filePath);
        removed++;
      }
    } catch {
      // skip files that disappeared between readdir and stat/unlink
    }
  }

  if (removed > 0) {
    log.info(`[upload-cleaner] removed ${removed} stale file(s) from ${uploadDir}`);
  }
  return removed;
}

export function startUploadCleaner(): void {
  if (UPLOAD_CLEANUP_INTERVAL_MIN <= 0) {
    log.info("[upload-cleaner] disabled (UPLOAD_CLEANUP_INTERVAL_MIN=0)");
    return;
  }

  const intervalMs = UPLOAD_CLEANUP_INTERVAL_MIN * 60_000;
  log.info(
    `[upload-cleaner] will clean files older than ${UPLOAD_MAX_AGE_MIN}min every ${UPLOAD_CLEANUP_INTERVAL_MIN}min`,
  );

  cleanStaleUploads();
  timer = setInterval(cleanStaleUploads, intervalMs);
}

export function stopUploadCleaner(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
