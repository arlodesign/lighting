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

  it("keys pick looks from the base note, with velocity", () => {
    expect(t().translate([0x90, 48, 127])).toEqual([
      { type: "look", index: 0, velocity: 1 },
    ]);
    expect(t().translate([0x90, 60, 0x40])[0]).toMatchObject({ index: 12 });
    expect(t().translate([0x80, 48, 0])).toEqual([]); // key release does nothing
  });

  it("a low key on channel 1 is not mistaken for a pad", () => {
    expect(t().translate([0x90, 36, 100])[0]).toMatchObject({ type: "look" });
  });

  it("knobs are relative turns, faders absolute", () => {
    expect(t().translate([0xb0, 74, 65])).toEqual([
      { type: "knob", knob: "speed", delta: 1 },
    ]);
    expect(t().translate([0xb0, 74, 64])).toEqual([]);
    expect(t().translate([0xb0, 82, 127])).toEqual([
      { type: "fader", fader: "master", value: 1 },
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

  it("main encoder moves and loads the setlist", () => {
    expect(t().translate([0xb0, 28, 66])).toEqual([
      { type: "setlist-move", delta: 1 },
    ]);
    expect(t().translate([0xb0, 118, 127])).toEqual([{ type: "setlist-load" }]);
    expect(t().translate([0xb0, 118, 0])).toEqual([]);
  });
});
