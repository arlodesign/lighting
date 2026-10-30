import { describe, expect, it } from "vitest";
import { hsv, toHsv, WHITE } from "./color.ts";
import {
  PALETTES,
  vary,
  varietyName,
  varietySpread,
  VARIETY_STOPS,
} from "./palettes.ts";

const hueDegrees = (c: Parameters<typeof toHsv>[0]) =>
  Math.round(toHsv(c).h * 360) % 360;

describe("Variety", () => {
  it("runs mono → analogous → triadic → complementary as the knob turns", () => {
    expect(VARIETY_STOPS.map((s) => s.name)).toEqual([
      "Mono",
      "Analogous",
      "Triadic",
      "Complementary",
    ]);
    expect(varietySpread(0) * 360).toBeCloseTo(0);
    expect(varietySpread(1 / 3) * 360).toBeCloseTo(30);
    expect(varietySpread(2 / 3) * 360).toBeCloseTo(120);
    expect(varietySpread(1) * 360).toBeCloseTo(180);
    expect(varietyName(0.6)).toBe("Triadic");
  });

  it("fades continuously between the schemes (no jumps)", () => {
    let last = 0;
    for (let v = 0; v <= 1.0001; v += 0.01) {
      const spread = varietySpread(v) * 360;
      expect(spread).toBeGreaterThanOrEqual(last);
      expect(spread - last).toBeLessThan(6);
      last = spread;
    }
  });

  it("spreads hues around the key color on both sides", () => {
    const red = hsv(0, 1, 1);
    const [key, a, b] = vary([red, red, red], 2 / 3); // triadic
    expect(hueDegrees(key!)).toBe(0);
    expect(hueDegrees(a!)).toBe(240); // −120°
    expect(hueDegrees(b!)).toBe(120); // +120°
  });

  it("keeps each color's brightness and saturation, and leaves white alone", () => {
    const [, dark, white] = vary([hsv(0, 1, 1), hsv(0.5, 1, 0.3), WHITE], 0);
    expect(toHsv(dark!).v).toBeCloseTo(0.3);
    expect(hueDegrees(dark!)).toBe(0); // mono: pulled onto the key hue
    expect(white).toEqual(WHITE);
  });

  it("pads short palettes so every scheme has both sides", () => {
    expect(vary([hsv(0, 1, 1)], 1)).toHaveLength(3);
  });

  it("every palette has its own key color (Variety builds schemes from it)", () => {
    const keys = PALETTES.map((p) => JSON.stringify(p.colors[0]));
    expect(new Set(keys).size).toBe(PALETTES.length);
  });
});
