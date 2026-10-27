import { describe, expect, it } from "vitest";
import { MINILAB_MAPPING } from "./mapping.ts";
import { MidiTranslator } from "./translate.ts";

// Real messages recorded from a MiniLab 3 (default Arturia program) by the hardware probe,
// 2026-10-25. They pin down behaviour the docs didn't: knob acceleration, repeated end
// values, how the main encoder reports clicks, and message order when a pad is released.

/** Knob 3 (CC76) swept fully right, held at the end, then fully left and held. */
const KNOB_SWEEP = [
  1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 21, 22, 23, 25, 27, 29, 31, 33,
  35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69, 71,
  73, 75, 77, 79, 81, 83, 85, 87, 89, 91, 93, 95, 97, 99, 101, 103, 105, 107,
  109, 111, 113, 115, 117, 119, 121, 122, 123, 124, 126, 127, 127, 127, 127,
  127, 127, 127, 127, 127, 127, 127, 127, 127, 126, 125, 124, 123, 122, 121,
  119, 118, 117, 115, 114, 113, 112, 110, 108, 106, 104, 102, 100, 98, 97, 96,
  94, 92, 90, 89, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70, 68, 66, 65, 64, 62,
  60, 58, 56, 54, 52, 50, 48, 46, 44, 42, 40, 38, 36, 34, 32, 30, 28, 26, 24,
  22, 20, 18, 16, 14, 12, 11, 10, 8, 6, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
];

/** Main encoder (CC114): 3 clicks right then 3 clicks left. */
const ENCODER_TURNS = [64, 65, 64, 65, 64, 65, 64, 62, 64, 62, 64, 62];

/** Pad 1: [status, note, value] for note-on, thinned pressure messages, then note-off. */
const PAD_PRESS = [
  [144, 36, 24],
  [128, 36, 0],
  [144, 36, 127],
  [160, 36, 63],
  [160, 36, 127],
  [160, 36, 15],
  [128, 36, 0],
  [144, 36, 23],
  [160, 36, 109],
  [160, 36, 127],
  [160, 36, 122],
  [160, 36, 127],
  [160, 36, 55],
  [160, 36, 90],
  [160, 36, 48],
  [160, 36, 127],
  [160, 36, 104],
  [160, 36, 114],
  [160, 36, 122],
  [160, 36, 127],
  [160, 36, 81],
  [160, 36, 107],
  [160, 36, 111],
  [160, 36, 57],
  [160, 36, 26],
  [160, 36, 0],
  [128, 36, 0],
] as const;

describe("recorded MiniLab data", () => {
  it("a full knob sweep keeps counting at both ends (endless feel)", () => {
    const tr = new MidiTranslator(MINILAB_MAPPING);
    const deltas = KNOB_SWEEP.flatMap((v) =>
      tr.translate([0xb0, 76, v]).map((a) => (a.type === "knob" ? a.delta : 0)),
    );
    const up = deltas.filter((d) => d > 0).reduce((a, b) => a + b, 0);
    const down = deltas.filter((d) => d < 0).reduce((a, b) => a + b, 0);
    // Travel is 126 units each way; the repeated 127s and 0s add extra ticks on top.
    expect(up).toBeGreaterThan(126);
    expect(down).toBeLessThan(-126);
  });

  it("encoder clicks become exactly three steps each way", () => {
    const tr = new MidiTranslator(MINILAB_MAPPING);
    const moves = ENCODER_TURNS.flatMap((v) => tr.translate([0xb0, 114, v]))
      .filter((a) => a.type === "setlist-move")
      .map((a) => (a.type === "setlist-move" ? a.delta : 0));
    expect(moves.filter((d) => d > 0)).toHaveLength(3);
    expect(moves.filter((d) => d < 0)).toHaveLength(3);
  });

  it("releasing a pad always ends with the hit released, never stuck on", () => {
    const tr = new MidiTranslator(MINILAB_MAPPING);
    const actions = PAD_PRESS.flatMap(([status, note, value]) =>
      tr.translate([status + 9, note, value]),
    );
    const hits = actions.filter((a) => a.type === "hit");
    expect(hits.at(-1)).toMatchObject({ hit: "strobe", down: false });
    expect(hits.some((a) => a.type === "hit" && a.down)).toBe(true);
  });
});
