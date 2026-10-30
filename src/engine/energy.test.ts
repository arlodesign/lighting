import { describe, expect, it } from "vitest";
import {
  balanceGains,
  blendLevels,
  blendPosition,
  editingLevel,
  type Level,
} from "./energy.ts";

const level = (over: Partial<Level>): Level => ({
  lookIndex: 0,
  paletteIndex: 0,
  hue: 0,
  saturation: 1,
  speedIndex: 2,
  fadeIndex: 3,
  geometry: "linear",
  width: 0.4,
  variety: 0.3,
  ...over,
});

describe("Energy fader positions", () => {
  it("has a stretch for each level and blends between them", () => {
    expect(blendPosition(0)).toEqual({ from: "low", to: "low", t: 0 });
    expect(blendPosition(0.5)).toEqual({ from: "mid", to: "mid", t: 0 });
    expect(blendPosition(1)).toEqual({ from: "high", to: "high", t: 0 });
    const between = blendPosition(0.74);
    expect(between).toMatchObject({ from: "mid", to: "high" });
    expect(between.t).toBeCloseTo(0.5);
  });

  it("edits whichever level the fader is nearest", () => {
    expect([0, 0.2, 0.3, 0.7, 0.8, 1].map(editingLevel)).toEqual([
      "low",
      "low",
      "mid",
      "mid",
      "high",
      "high",
    ]);
  });
});

describe("blendLevels", () => {
  it("slides smooth values and switches the rest halfway", () => {
    const a = level({ width: 0, lookIndex: 1 });
    const b = level({ width: 1, lookIndex: 5 });
    expect(blendLevels(a, b, 0.25)).toMatchObject({
      width: 0.25,
      lookIndex: 1,
    });
    expect(blendLevels(a, b, 0.75)).toMatchObject({
      width: 0.75,
      lookIndex: 5,
    });
  });

  it("goes the short way around the color wheel", () => {
    const h = blendLevels(level({ hue: 0.9 }), level({ hue: 0.1 }), 0.5).hue;
    expect(Math.min(h, 1 - h)).toBeCloseTo(0);
  });
});

describe("balanceGains", () => {
  it("keeps both sides full around the middle", () => {
    expect(balanceGains(0.5)).toEqual({ left: 1, right: 1 });
    expect(balanceGains(0.53)).toEqual({ left: 1, right: 1 });
  });

  it("up keeps the left and fades the right; down the reverse", () => {
    expect(balanceGains(1)).toEqual({ left: 1, right: 0 });
    expect(balanceGains(0)).toEqual({ left: 0, right: 1 });
    expect(balanceGains(0.56).right).toBeGreaterThan(0.95); // no jump off the dead zone
  });
});
