import { describe, it, expect } from "vitest";
import { blendLinear, blendPatches } from "../runtime/crossfade";

describe("crossfade", () => {
  it("blendLinear interpolates and rounds", () => {
    expect(blendLinear(0, 100, 0)).toBe(0);
    expect(blendLinear(0, 100, 0.5)).toBe(50);
    expect(blendLinear(0, 101, 0.5)).toBe(51); // 50.5 -> 51 (Math.round)
    expect(blendLinear(0, 100, 1)).toBe(100);
  });

  it("blendPatches unions keys and blends missing channels against 0", () => {
    const a = { 1: 0, 2: 255 } as Record<number, number>;
    const b = { 2: 0, 3: 128 } as Record<number, number>;
    const out = blendPatches(a, b, 0.5);
    expect(out[1]).toBe(0); // 0 -> 0
    expect(out[2]).toBe(128); // 255 -> 0
    expect(out[3]).toBe(64); // 0 -> 128
  });
});
