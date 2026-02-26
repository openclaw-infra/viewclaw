import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { UPLOAD_CLEANUP_INTERVAL_MIN, UPLOAD_MAX_AGE_MIN } from "./config";
import { getWorkspaceDir } from "./openclaw-client";

let timer: ReturnType<typeof setInterval> | null = null;

const UPLOAD_SUBDIR = ".clawflow-uploads";

async function cleanStaleUploads(): Promise<number> {
  const workspace = await getWorkspaceDir();
  const uploadDir = join(workspace, UPLOAD_SUBDIR);

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
    console.log(`[upload-cleaner] removed ${removed} stale file(s) from ${uploadDir}`);
  }
  return removed;
}

export function startUploadCleaner(): void {
  if (UPLOAD_CLEANUP_INTERVAL_MIN <= 0) {
    console.log("[upload-cleaner] disabled (UPLOAD_CLEANUP_INTERVAL_MIN=0)");
    return;
  }

  const intervalMs = UPLOAD_CLEANUP_INTERVAL_MIN * 60_000;
  console.log(
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
