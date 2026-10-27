import { describe, expect, it } from "vitest";
import { RIG, strobeHzForValue, strobeValueForHz } from "./config.ts";

// Real measurements from the show lights (strobe-sweep, 2026-10-26), by tapping along.
const MEASURED: [value: number, hz: number][] = [
  [64, 1.39],
  [96, 1.81],
  [128, 2.29],
  [192, 4.58],
  [255, 7.58],
];

describe("strobe curve", () => {
  it.each(MEASURED)("matches the measured rate at value %i", (value, hz) => {
    expect(strobeHzForValue(value)).toBeGreaterThan(hz * 0.88);
    expect(strobeHzForValue(value)).toBeLessThan(hz * 1.12);
  });

  it("is inverted correctly", () => {
    for (const hz of [1, 2, 3, 4.5, 6, 8]) {
      expect(strobeHzForValue(strobeValueForHz(hz))).toBeCloseTo(hz, 0);
    }
    expect(strobeValueForHz(100)).toBe(255); // clamped
    expect(strobeValueForHz(0.01)).toBe(1);
  });

  it("puts the pad between a slow-but-visible flash and the safety limit", () => {
    const { slow, fast } = RIG.profile.strobeRange;
    expect(slow).toBeGreaterThan(90); // below ~50 the changes are barely visible
    expect(fast).toBeGreaterThan(slow);
    expect(strobeHzForValue(slow)).toBeGreaterThan(1.5);
    expect(strobeHzForValue(fast)).toBeLessThan(6.5);
  });
});
