/**
 * The night's setlist. Every field except `name` is optional: a song preset only changes
 * what it mentions, and the operator improvises from there.
 *
 *   palette: an id from src/engine/palettes.ts   (e.g. "blood", "toxic", "pumpkin")
 *   look:    an id from src/engine/looks/*.ts     (e.g. "chase", "lightning", "candle")
 */
export interface Song {
  name: string;
  bpm?: number;
  palette?: string;
  look?: string;
  /** Shown on the HUD under the song name: cues, reminders. */
  notes?: string;
}

// Placeholder — replace with the real set.
export const SETLIST: readonly Song[] = [
  { name: "Opener", bpm: 128, palette: "blood", look: "chase" },
  {
    name: "Slow One",
    bpm: 72,
    palette: "candle",
    look: "candle",
    notes: "Fog up before",
  },
  { name: "Monster Mash", bpm: 120, palette: "toxic", look: "ping-pong" },
  { name: "Thriller", bpm: 118, palette: "witching", look: "possession" },
  {
    name: "Closer",
    bpm: 140,
    palette: "fire",
    look: "ripple",
    notes: "Strobe on the last hit",
  },
];
