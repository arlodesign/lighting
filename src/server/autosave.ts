import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Snapshot } from "../engine/engine.ts";

const STATE_DIR = path.join(import.meta.dirname, "..", "..", "state");
export const AUTOSAVE_FILE = path.join(STATE_DIR, "autosave.json");

export async function loadAutosave(
  file = AUTOSAVE_FILE,
): Promise<Partial<Snapshot> | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Partial<Snapshot>;
  } catch {
    return undefined; // first run, or an unreadable file: start fresh
  }
}

/**
 * Write-then-rename, so a crash or power cut mid-save leaves the previous good file rather
 * than half a JSON document.
 */
export async function saveAutosave(
  snapshot: Snapshot,
  file = AUTOSAVE_FILE,
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(snapshot, null, 2));
  await rename(tmp, file);
}
