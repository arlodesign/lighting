import type { FaderId, HitId, KnobId } from "../engine/actions.ts";

/**
 * Which MiniLab control does what. Numbers are confirmed by the probe run on the show
 * laptop (2026-10-25), for both of the MiniLab's built-in programs:
 *   - "Arturia" (the default out of the box)
 *   - "DAW" (what it switches to when a music app takes over)
 * Both are listed in `ccSets`, so the app works whichever program the MiniLab is in.
 *
 * Channels are 1-based as printed on gear. Omit `channel` to accept any channel.
 */
export type KnobEncoding =
  | "absolute"
  | "relative-binary-offset"
  | "relative-twos-comp"
  | "relative-signed-bit";

export interface MidiMapping {
  /** Pads 1–8, notes on this channel (pressure arrives as poly aftertouch). */
  pads: {
    channel: number;
    notes: readonly number[];
    roles: readonly (HitId | "tap")[];
  };
  /** Keys: note → look index (note − baseNote). The octave buttons shift notes by ±12. */
  keys: { channel?: number; baseNote: number };
  /**
   * `ccSets[n][i]` is the CC number of the i-th knob in program n; `roles[i]` says what
   * it does. Absolute knobs are turned into relative ticks by the translator.
   */
  knobs: {
    channel?: number;
    ccSets: readonly (readonly number[])[];
    roles: readonly KnobId[];
    encoding: KnobEncoding;
  };
  faders: {
    channel?: number;
    ccSets: readonly (readonly number[])[];
    roles: readonly FaderId[];
  };
  /** Pitch strip → spotlight; mod strip (CC) → swell. */
  strips: { channel?: number; modCc: number };
  /** Main encoder: relative turn moves the setlist, click loads. One CC per program. */
  mainEncoder: {
    turnCcs: readonly number[];
    clickCcs: readonly number[];
    encoding: KnobEncoding;
  };
}

export const MINILAB_MAPPING: MidiMapping = {
  pads: {
    channel: 10,
    notes: [36, 37, 38, 39, 40, 41, 42, 43],
    roles: [
      "strobe",
      "white-flash",
      "blackout",
      "color-bump",
      "left-flash",
      "right-flash",
      "tap",
      "lightning",
    ],
  },
  keys: { channel: 1, baseNote: 48 },
  knobs: {
    ccSets: [
      [74, 71, 76, 77, 93, 18, 19, 16], // Arturia program
      [86, 87, 89, 90, 110, 111, 116, 117], // DAW program
    ],
    roles: [
      "speed",
      "hue",
      "saturation",
      "palette",
      "width",
      "fade",
      "geometry",
      "sensitivity",
    ],
    encoding: "absolute",
  },
  faders: {
    ccSets: [
      [82, 83, 85, 17], // Arturia program
      [14, 15, 30, 31], // DAW program
    ],
    roles: ["master", "left", "right", "audio"],
  },
  strips: { modCc: 1 },
  mainEncoder: {
    turnCcs: [114, 28], // Arturia, DAW
    clickCcs: [115, 118],
    encoding: "relative-binary-offset",
  },
};
