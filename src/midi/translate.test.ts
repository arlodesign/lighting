import { describe, expect, it } from "vitest";
import { MINILAB_MAPPING } from "./mapping.ts";
import { knobDelta, MidiTranslator } from "./translate.ts";

const t = () => new MidiTranslator(MINILAB_MAPPING);

describe("knobDelta", () => {
  it.each([
    ["relative-binary-offset", 66, 2],
    ["relative-binary-offset", 61, -3],
    ["relative-twos-comp", 2, 2],
    ["relative-twos-comp", 126, -2],
    ["relative-signed-bit", 3, 3],
    ["relative-signed-bit", 67, -3],
  ] as const)("%s %i → %i", (encoding, value, delta) => {
    expect(knobDelta(value, encoding, undefined)).toBe(delta);
  });

  it("turns absolute positions into deltas", () => {
    expect(knobDelta(70, "absolute", undefined)).toBe(0);
    expect(knobDelta(70, "absolute", 65)).toBe(5);
    expect(knobDelta(60, "absolute", 65)).toBe(-5);
  });

  it("treats repeated end values as continued turning (endless feel)", () => {
    expect(knobDelta(127, "absolute", 127)).toBe(1);
    expect(knobDelta(0, "absolute", 0)).toBe(-1);
    expect(knobDelta(64, "absolute", 64)).toBe(0);
  });
});

describe("MidiTranslator", () => {
  it("pads on channel 10 are hits; pad 7 taps", () => {
    expect(t().translate([0x99, 36, 127])).toEqual([
      { type: "hit", hit: "strobe", down: true, pressure: 1 },
    ]);
    expect(t().translate([0x89, 36, 0])).toEqual([
      { type: "hit", hit: "strobe", down: false },
    ]);
    expect(t().translate([0x99, 42, 100])).toEqual([{ type: "tap" }]);
    expect(t().translate([0x89, 42, 0])).toEqual([]);
  });

  it("pad pressure updates the held hit", () => {
    expect(t().translate([0xa9, 36, 127])).toEqual([
      { type: "hit", hit: "strobe", down: true, pressure: 1 },
    ]);
  });

  it("white keys pick looks in order, with velocity", () => {
    expect(t().translate([0x90, 48, 127])).toEqual([
      { type: "look", index: 0, velocity: 1 },
    ]);
    expect(t().translate([0x90, 50, 127])[0]).toMatchObject({ index: 1 }); // D
    expect(t().translate([0x90, 53, 127])[0]).toMatchObject({ index: 3 }); // F
    expect(t().translate([0x90, 60, 127])[0]).toMatchObject({ index: 7 }); // next C
    expect(t().translate([0x90, 72, 127])[0]).toMatchObject({ index: 14 }); // top C
    expect(t().translate([0x80, 48, 0])).toEqual([]); // key release does nothing
  });

  it("black keys do nothing", () => {
    for (const note of [49, 51, 54, 56, 58, 61, 70])
      expect(t().translate([0x90, note, 100])).toEqual([]);
  });

  it("a low key on channel 1 is not mistaken for a pad", () => {
    expect(t().translate([0x90, 36, 100])[0]).toMatchObject({ type: "look" });
  });

  it("knobs become relative ticks (the first message only establishes position)", () => {
    const tr = t();
    expect(tr.translate([0xb0, 74, 60])).toEqual([]);
    expect(tr.translate([0xb0, 74, 62])).toEqual([
      { type: "knob", knob: "speed", delta: 2 },
    ]);
    expect(tr.translate([0xb0, 74, 61])).toEqual([
      { type: "knob", knob: "speed", delta: -1 },
    ]);
  });

  it("a knob held against its end keeps scrolling", () => {
    const tr = t();
    tr.translate([0xb0, 77, 126]);
    tr.translate([0xb0, 77, 127]);
    expect(tr.translate([0xb0, 77, 127])).toEqual([
      { type: "knob", knob: "palette", delta: 1 },
    ]);
  });

  it("faders are absolute", () => {
    expect(t().translate([0xb0, 82, 127])).toEqual([
      { type: "fader", fader: "master", value: 1 },
    ]);
  });

  it("understands the DAW program's CC numbers too", () => {
    expect(t().translate([0xb0, 14, 0])).toEqual([
      { type: "fader", fader: "master", value: 0 },
    ]);
    const tr = t();
    tr.translate([0xb0, 86, 10]);
    expect(tr.translate([0xb0, 86, 12])).toEqual([
      { type: "knob", knob: "speed", delta: 2 },
    ]);
  });

  it("pitch strip drives the spotlight and releases at centre", () => {
    expect(t().translate([0xe0, 0x7f, 0x7f])).toEqual([
      { type: "spotlight", value: 1 },
    ]);
    expect(t().translate([0xe0, 0x00, 0x40])).toEqual([
      { type: "spotlight", value: null },
    ]);
  });

  it("main encoder moves and loads the setlist (Arturia program, as recorded)", () => {
    // Each click sends 65 (right) or 62 (left), then returns to the 64 centre.
    expect(t().translate([0xb0, 114, 65])).toEqual([
      { type: "setlist-move", delta: 1 },
    ]);
    expect(t().translate([0xb0, 114, 62])).toEqual([
      { type: "setlist-move", delta: -1 },
    ]);
    expect(t().translate([0xb0, 114, 64])).toEqual([]);
    expect(t().translate([0xb0, 115, 127])).toEqual([{ type: "setlist-load" }]);
    expect(t().translate([0xb0, 115, 0])).toEqual([]);
  });

  it("main encoder also works in the DAW program", () => {
    expect(t().translate([0xb0, 28, 65])).toEqual([
      { type: "setlist-move", delta: 1 },
    ]);
    expect(t().translate([0xb0, 118, 127])).toEqual([{ type: "setlist-load" }]);
  });
});
