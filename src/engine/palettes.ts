import { hex, type Rgb } from "./color.ts";

export interface Palette {
  id: string;
  name: string;
  /** 1–4 colours that look good together. Looks pick from or blend across these. */
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
 * Saturated colours with real darkness read best in fog; pastels just turn the haze grey.
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
  p("sunset", "Sunset", ["#ff5a00", "#ff1a6a", "#8a00c8"]),
  p("forest", "Forest", ["#00c040", "#00b0a0", "#d0e000"]),
  p("neon", "Neon", ["#ff0090", "#00f0ff", "#90ff00"]),
  p("warm-white", "Warm White", ["#ffb070", "#ffc890"]),
];

export function paletteIndex(id: string): number {
  return Math.max(
    0,
    PALETTES.findIndex((pal) => pal.id === id),
  );
}
