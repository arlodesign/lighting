import { describe, expect, it } from "vitest";
import { LIGHT_COUNT, positions, stepCount } from "./rig.ts";

describe("scatter geometry", () => {
  const linear = positions("linear");

  it("is a reshuffle of the same positions (every light still gets one)", () => {
    for (const bar of [0, 1, 7, 42]) {
      expect([...positions("scatter", bar)].sort()).toEqual([...linear].sort());
    }
  });

  it("is the same all through a bar, and changes between bars", () => {
    expect(positions("scatter", 5)).toEqual(positions("scatter", 5));
    const distinct = new Set(
      [0, 1, 2, 3, 4, 5].map((b) => positions("scatter", b).join()),
    );
    expect(distinct.size).toBeGreaterThan(3);
  });

  it("steps through all eight lights", () => {
    expect(stepCount("scatter")).toBe(LIGHT_COUNT);
  });
});
