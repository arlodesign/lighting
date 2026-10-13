import type { FaderId, HitId, KnobId } from "../engine/actions.ts";

/**
 * Which MiniLab control does what. Numbers marked PROBE are from Arturia's docs and forum
 * reports; the probe report will confirm or correct them.
 *
 * Channels are 1-based as printed on gear. Omit `channel` to accept any channel.
 */
export type KnobEncoding =
  | "absolute"
  | "relative-binary-offset"
  | "relative-twos-comp"
  | "relative-signed-bit";

export interface MidiMapping {
  /** Pads 1–8, notes on this channel (pressure arrives as poly aftertouch). PROBE */
  pads: {
    channel: number;
    notes: readonly number[];
    roles: readonly (HitId | "tap")[];
  };
  /** Keys: note → look index (note − baseNote). Octave buttons just shift the notes. PROBE */
  keys: { channel?: number; baseNote: number };
  knobs: {
    channel?: number;
    ccs: readonly number[];
    roles: readonly KnobId[];
    encoding: KnobEncoding;
  };
  faders: {
    channel?: number;
    ccs: readonly number[];
    roles: readonly FaderId[];
  };
  /** Pitch strip → spotlight; mod strip (CC) → swell. */
  strips: { channel?: number; modCc: number };
  /** Main encoder: relative turn moves the setlist, click loads. PROBE */
  mainEncoder: { turnCc: number; clickCc: number; encoding: KnobEncoding };
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
    ccs: [74, 71, 76, 77, 93, 18, 19, 16],
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
    encoding: "relative-binary-offset",
  },
  faders: {
    ccs: [82, 83, 85, 17],
    roles: ["master", "left", "right", "audio"],
  },
  strips: { modCc: 1 },
  mainEncoder: { turnCc: 28, clickCc: 118, encoding: "relative-binary-offset" },
};
