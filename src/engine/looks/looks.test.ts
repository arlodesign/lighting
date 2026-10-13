import { describe, expect, it } from "vitest";
import type { Rgb } from "../color.ts";
import type { LookContext } from "../look.ts";
import { PALETTES } from "../palettes.ts";
import {
  GEOMETRIES,
  LIGHT_COUNT,
  positions,
  sideOf,
  stepCount,
} from "../rig.ts";
import { LOOKS } from "./index.ts";

function context(over: Partial<LookContext> = {}): LookContext {
  const geometry = over.geometry ?? "linear";
  return {
    beats: 0,
    time: 0,
    colors: PALETTES[0]!.colors,
    width: 0.5,
    geometry,
    pos: positions(geometry),
    side: Array.from({ length: LIGHT_COUNT }, (_, i) => sideOf(i)),
    steps: stepCount(geometry),
    audio: { level: 0, bass: 0 },
    ...over,
  };
}

function render(index: number, ctx: LookContext): Rgb[] {
  const out = Array.from({ length: LIGHT_COUNT }, () => ({ r: 0, g: 0, b: 0 }));
  LOOKS[index]!.render(ctx, out);
  return out;
}

describe("every look", () => {
  it("has a unique id", () => {
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(LOOKS.length);
    expect(LOOKS).toHaveLength(18);
  });

  // Sweep a long stretch of time across every geometry, palette and width:
  // a NaN or out-of-range value here would be a flicker or a crash on stage.
  for (const [index, look] of LOOKS.entries()) {
    it(`${look.name} always outputs 8 valid colours`, () => {
      for (const geometry of GEOMETRIES) {
        for (const palette of PALETTES) {
          for (const width of [0, 0.5, 1]) {
            for (let step = 0; step < 120; step++) {
              const beats = step * 0.37 - 3; // includes negative beats
              const out = render(
                index,
                context({
                  geometry,
                  colors: palette.colors,
                  width,
                  beats,
                  time: step * 0.211,
                  audio: { level: step % 2, bass: 0.5 },
                }),
              );
              expect(out).toHaveLength(LIGHT_COUNT);
              for (const c of out) {
                for (const v of [c.r, c.g, c.b]) {
                  expect(Number.isFinite(v)).toBe(true);
                  expect(v).toBeGreaterThanOrEqual(0);
                  expect(v).toBeLessThanOrEqual(1.0001);
                }
              }
            }
          }
        }
      }
    });

    it(`${look.name} is deterministic (same moment → same colours)`, () => {
      const ctx = context({ beats: 13.3, time: 42.42 });
      expect(render(index, ctx)).toEqual(render(index, ctx));
    });
  }
});

describe("chase", () => {
  it("steps one light per beat along the linear geometry", () => {
    const chase = LOOKS.findIndex((l) => l.id === "chase");
    const brightest = (beats: number) => {
      const out = render(chase, context({ beats, width: 0 }));
      const levels = out.map((c) => c.r + c.g + c.b);
      return levels.indexOf(Math.max(...levels));
    };
    expect([0, 1, 2, 3].map(brightest)).toEqual([0, 1, 2, 3]);
    expect(brightest(8)).toBe(0); // wraps after 8 lights
  });
});
