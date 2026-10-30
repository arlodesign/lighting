import { describe, expect, it } from "vitest";
import {
  RIG,
  STROBE_MAX_HZ,
  STROBE_MIN_HZ,
  strobeHzForValue,
} from "../config.ts";
import { writeFrame } from "./fixtures.ts";
import { UNIVERSE_SIZE } from "./types.ts";

const black = { r: 0, g: 0, b: 0 };

describe("writeFrame", () => {
  it("puts brightness on the master dimmer and full-chroma color on RGB", () => {
    const universe = new Uint8Array(UNIVERSE_SIZE);
    const lights = Array.from({ length: 8 }, () => black);
    lights[0] = { r: 0.2, g: 0, b: 0.1 }; // dim purple-red on L1
    writeFrame({ lights, strobe: 0 }, RIG, universe);

    const at = RIG.addresses.L1 - 1;
    expect(universe[at + 0]).toBe(51); // master = 0.2 × 255
    expect(universe[at + 1]).toBe(255); // red at full chroma
    expect(universe[at + 3]).toBe(128); // blue keeps its ratio to red
    expect(universe[at + 5]).toBe(RIG.profile.neutral.strobe);
  });

  it("maps strobe 0–1 into the fixture's strobe range, linear in flashes per second", () => {
    const universe = new Uint8Array(UNIVERSE_SIZE);
    const lights = Array.from({ length: 8 }, () => ({ r: 1, g: 1, b: 1 }));
    const at = RIG.addresses.R4 - 1 + 5;
    const strobeAt = (strobe: number) => {
      writeFrame({ lights, strobe }, RIG, universe);
      return universe[at]!;
    };
    expect(strobeAt(1)).toBe(RIG.profile.strobeRange.fast);
    expect(strobeAt(0.001)).toBe(RIG.profile.strobeRange.slow);
    // Halfway in pressure is halfway in flash rate (2/s → 6/s, so 4/s).
    expect(strobeHzForValue(strobeAt(0.5))).toBeCloseTo(
      (STROBE_MIN_HZ + STROBE_MAX_HZ) / 2,
      1,
    );
  });
});
