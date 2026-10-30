import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseSong,
  parseSongPreset,
  type Song,
  type SongPreset as SongSettingsPreset,
} from "../songs.ts";

/**
 * Presets saved on site (⌘S on the laptop) live here, on the show laptop, next to the
 * autosave. They sit on top of the defaults in src/setlist.json: the repo is the default,
 * this file is "what we tweaked at the venue". Export merges the two into a new setlist.json.
 */
export const PRESETS_FILE = path.join(
  import.meta.dirname,
  "..",
  "..",
  "state",
  "presets.json",
);

export type SongPreset = SongSettingsPreset & { bpm?: number };

export interface Presets {
  version: 1;
  /** Keyed by song name. */
  songs: Record<string, SongPreset>;
}

export const EMPTY_PRESETS: Presets = { version: 1, songs: {} };

function parsePreset(raw: unknown): SongPreset {
  const preset: SongPreset = parseSongPreset(raw);
  const bpm = (raw as { bpm?: unknown } | null)?.bpm;
  if (typeof bpm === "number" && bpm >= 50 && bpm <= 220) preset.bpm = bpm;
  return preset;
}

/** Load saved presets. A missing or unreadable file just means "nothing saved yet". */
export async function loadPresets(file = PRESETS_FILE): Promise<Presets> {
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as {
      songs?: Record<string, unknown>;
    };
    const songs: Record<string, SongPreset> = {};
    for (const [name, preset] of Object.entries(raw.songs ?? {})) {
      songs[name] = parsePreset(preset);
    }
    return { version: 1, songs };
  } catch {
    return { version: 1, songs: {} };
  }
}

/** Write-then-rename, so a crash mid-save leaves the previous good file. */
export async function savePresets(
  presets: Presets,
  file = PRESETS_FILE,
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(presets, null, 2) + "\n");
  await rename(tmp, file);
}

/** The setlist the show actually uses: repo defaults with on-site saves layered on top. */
export function applyPresets(
  setlist: readonly Song[],
  presets: Presets,
): Song[] {
  return setlist.map((song) => {
    const saved = presets.songs[song.name];
    return saved ? { ...song, ...saved } : { ...song };
  });
}

export function withPreset(
  presets: Presets,
  name: string,
  preset: SongPreset,
): Presets {
  return {
    version: 1,
    songs: { ...presets.songs, [name]: parsePreset(preset) },
  };
}

export function withoutPreset(presets: Presets, name: string): Presets {
  const songs = { ...presets.songs };
  delete songs[name];
  return { version: 1, songs };
}

/**
 * The exported file: exactly the shape, field order and formatting of src/setlist.json, so
 * dropping it into the repo shows only real changes in git.
 */
export function exportSetlist(setlist: readonly Song[]): string {
  const songs = setlist.map(parseSong).filter((s) => s !== undefined);
  return JSON.stringify(songs, null, 2) + "\n";
}
