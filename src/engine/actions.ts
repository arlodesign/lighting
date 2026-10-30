/**
 * Everything an operator can do, independent of *how* they do it. The MiniLab mapping,
 * the laptop keyboard, tests, and a future iPad remote all translate their input into
 * these — the engine never sees a MIDI byte.
 */

export const HIT_IDS = [
  "strobe",
  "white-flash",
  "blackout",
  "color-bump",
  "left-flash",
  "right-flash",
  "lightning",
] as const;
export type HitId = (typeof HIT_IDS)[number];

export const KNOB_IDS = [
  "speed",
  "hue",
  "saturation",
  "palette",
  "width",
  "fade",
  "geometry",
  "variety",
] as const;
export type KnobId = (typeof KNOB_IDS)[number];

export const FADER_IDS = ["master", "left", "right", "audio"] as const;
export type FaderId = (typeof FADER_IDS)[number];

export type Action =
  /** Latch a look (keys). `velocity` 0–1 sets its intensity. */
  | { type: "look"; index: number; velocity?: number }
  /** Momentary hit: active while held. `pressure` 0–1 (pads send it continuously). */
  | { type: "hit"; hit: HitId; down: boolean; pressure?: number }
  /** Relative knob turn in encoder ticks: positive = clockwise. */
  | { type: "knob"; knob: KnobId; delta: number }
  /** Absolute fader position 0–1. */
  | { type: "fader"; fader: FaderId; value: number }
  /** Pitch strip: spotlight position 0–1 across the stage, or null when released. */
  | { type: "spotlight"; value: number | null }
  /** Mod strip: brightness swell 0–1. */
  | { type: "swell"; value: number }
  | { type: "tap" }
  /** Move the setlist cursor (main encoder). */
  | { type: "setlist-move"; delta: number }
  /** Load the song under the cursor (main encoder click). */
  | { type: "setlist-load" };
