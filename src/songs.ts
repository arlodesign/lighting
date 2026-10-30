// Song and preset shapes, shared by the server and the browser display (no Node imports).
import { GEOMETRIES, type Geometry } from "./engine/rig.ts";

/**
 * What a song preset can set when the song loads. Every field is optional: a preset only
 * changes what it mentions, and the operator improvises from there.
 *
 * Values are stored as real values (a look's id, a speed of 2 beats, a fade of 1 beat), not
 * as positions in a list, so reordering looks or adding speed steps can't scramble a preset.
 */
export interface SongSettings {
  /** A look id from src/engine/looks/*.ts, e.g. "chase". */
  look?: string;
  /** A palette id from src/engine/palettes.ts, e.g. "blood". */
  palette?: string;
  /** Hue rotation in turns, 0–1. */
  hue?: number;
  /** 0 = washed out, 1 = full color. */
  saturation?: number;
  /** Look speed as a multiple of the beat (¼ … 8). */
  speed?: number;
  /** Crossfade length in beats. */
  fade?: number;
  geometry?: Geometry;
  /** 0–1. */
  width?: number;
  /** Mod-strip brightness swell, 0–1. */
  swell?: number;
}

export interface Song extends SongSettings {
  name: string;
  /** Starting tempo; tap tempo corrects it live. */
  bpm?: number;
  /** Shown on the display under the song name. */
  notes?: string;
}

const unit = (x: unknown) =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1;
const positive = (x: unknown) =>
  typeof x === "number" && Number.isFinite(x) && x >= 0;
const text = (x: unknown) => typeof x === "string" && x.trim() !== "";

/** Keep only the well-formed settings fields; anything else is dropped. */
export function parseSongSettings(raw: unknown): SongSettings {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: SongSettings = {};
  if (text(r.look)) out.look = r.look as string;
  if (text(r.palette)) out.palette = r.palette as string;
  if (unit(r.hue)) out.hue = r.hue as number;
  if (unit(r.saturation)) out.saturation = r.saturation as number;
  if (positive(r.speed)) out.speed = r.speed as number;
  if (positive(r.fade)) out.fade = r.fade as number;
  if (GEOMETRIES.includes(r.geometry as Geometry))
    out.geometry = r.geometry as Geometry;
  if (unit(r.width)) out.width = r.width as number;
  if (unit(r.swell)) out.swell = r.swell as number;
  return out;
}

export function parseSong(raw: unknown): Song | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (!text(r.name)) return undefined;
  const song: Song = { name: (r.name as string).trim() };
  if (typeof r.bpm === "number" && r.bpm >= 50 && r.bpm <= 220)
    song.bpm = r.bpm;
  Object.assign(song, parseSongSettings(r));
  if (text(r.notes)) song.notes = r.notes as string;
  return song;
}

export function parseSetlist(raw: unknown): Song[] {
  if (!Array.isArray(raw))
    throw new Error("setlist.json must be a list of songs");
  return raw.map(parseSong).filter((s): s is Song => s !== undefined);
}
