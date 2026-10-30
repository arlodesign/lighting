import { clamp01, hex, hsv, toHsv, type Rgb } from "./color.ts";

export interface Palette {
  id: string;
  name: string;
  /** 1–4 colors that look good together. Looks pick from or blend across these. */
  colors: readonly Rgb[];
  spooky?: boolean;
}

const p = (
  id: string,
  name: string,
  codes: string[],
  spooky = false,
): Palette => ({
  id,
  name,
  colors: codes.map(hex),
  ...(spooky && { spooky }),
});

/**
 * Saturated colors with real darkness read best in fog; pastels just turn the haze gray.
 * Order = the order the palette knob scrolls through.
 */
export const PALETTES: readonly Palette[] = [
  p("blood", "Blood", ["#b00010", "#ff0000", "#ffffff"], true),
  p("fire", "Fire", ["#ff2000", "#ff6a00", "#ffb000"]),
  p("vampire", "Vampire", ["#8a0000", "#1a0000", "#d00018"], true),
  p("pumpkin", "Pumpkin", ["#ff5a00", "#c43c00", "#ff8c1a"], true),
  p("toxic", "Toxic", ["#5aff00", "#b8ff1a", "#1fbf00"], true),
  p("witching", "Witching Hour", ["#5a00c8", "#30ff40", "#8a00ff"], true),
  p("bruise", "Bruise", ["#6a00a8", "#0020a0", "#c8d000"], true),
  p("ghost", "Ghost", ["#a8f0ff", "#e8f8ff", "#60c0ff"], true),
  p("candle", "Candlelight", ["#ff7a10", "#ff9a30", "#c05000"], true),
  p("purple-rain", "Purple Rain", ["#8000ff", "#ff00c8", "#2a00ff"]),
  p("ice", "Ice", ["#0040ff", "#00d8ff", "#ffffff"]),
  // Pink first: Pumpkin already has this orange as its key color, and Variety builds
  // every scheme from the key color.
  p("sunset", "Sunset", ["#ff1a6a", "#ff5a00", "#8a00c8"]),
  p("forest", "Forest", ["#00c040", "#00b0a0", "#d0e000"]),
  p("neon", "Neon", ["#ff0090", "#00f0ff", "#90ff00"]),
  p("warm-white", "Warm White", ["#ffb070", "#ffc890"]),
];

/**
 * The Variety knob: how far around the color wheel the palette spreads from its key color
 * (its first color), in degrees. The knob slides continuously between these.
 */
export const VARIETY_STOPS = [
  { name: "Mono", degrees: 0 },
  { name: "Analogous", degrees: 30 },
  { name: "Triadic", degrees: 120 },
  { name: "Complementary", degrees: 180 },
] as const;

/** Which side of the key color each palette slot sits on: key, one side, the other, key. */
const SIDES = [0, -1, 1, 0];

/** The spread for a Variety knob position (0–1), in turns. */
export function varietySpread(variety: number): number {
  const x = clamp01(variety) * (VARIETY_STOPS.length - 1);
  const i = Math.min(Math.floor(x), VARIETY_STOPS.length - 2);
  const from = VARIETY_STOPS[i]!.degrees;
  const to = VARIETY_STOPS[i + 1]!.degrees;
  return (from + (to - from) * (x - i)) / 360;
}

/** The name of the Variety stop nearest a knob position. */
export function varietyName(variety: number): string {
  const i = Math.round(clamp01(variety) * (VARIETY_STOPS.length - 1));
  return VARIETY_STOPS[i]!.name;
}

/**
 * Re-aim a palette's hues around its key color. Each color keeps its own saturation and
 * brightness (so a dark palette stays dark and whites stay white); only the hue moves.
 * Short palettes are padded to 3 colors so every scheme has both sides of the wheel.
 */
export function vary(colors: readonly Rgb[], variety: number): Rgb[] {
  if (colors.length === 0) return [];
  const key = toHsv(colors[0]!).h;
  const spread = varietySpread(variety);
  const slots = Array.from(
    { length: Math.max(3, colors.length) },
    (_, i) => colors[i] ?? colors[0]!,
  );
  return slots.map((col, i) => {
    const { s, v } = toHsv(col);
    return hsv(key + SIDES[i % SIDES.length]! * spread, s, v);
  });
}

export function paletteIndex(id: string): number {
  return Math.max(
    0,
    PALETTES.findIndex((pal) => pal.id === id),
  );
}
