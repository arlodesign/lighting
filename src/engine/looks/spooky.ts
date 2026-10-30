import { hsv, mix, scale, WHITE, type Rgb } from "../color.ts";
import { blendAt, hash, noise, pick, type Look } from "../look.ts";
import { frac } from "./core.ts";

const LIGHTNING_WINDOW_S = 0.3;
const COLD_WHITE: Rgb = { r: 0.85, g: 0.9, b: 1 };

/**
 * Lightning brightness for light `i` at `time` (seconds), 0–1. Time is cut into short
 * windows; a hashed few become "strikes" made of 1–3 rapid flickers that hit a random
 * cluster of lights. Shared by the Lightning look and the Lightning hit pad.
 *
 * @param chance probability that any given window is a strike
 */
export function lightningAt(time: number, i: number, chance: number): number {
  const window = Math.floor(time / LIGHTNING_WINDOW_S);
  if (hash(window, 1) >= chance) return 0;
  if (hash(window, 200 + i) > 0.55) return 0; // this light isn't in the strike
  const t = frac(time / LIGHTNING_WINDOW_S);
  const flicker = Math.floor(t * 6); // 6 sub-slots in the window
  const flickers = 1 + Math.floor(hash(window, 2) * 3); // 1–3 flickers
  const onSlots = [0, 2, 4].slice(0, flickers);
  if (!onSlots.includes(flicker)) return 0;
  return 0.7 + 0.3 * hash(window, 300 + flicker);
}

/** Darkness, then irregular bursts of white strikes. Width = how stormy. */
export const lightning: Look = {
  id: "lightning",
  name: "Lightning",
  spooky: true,
  render({ time, colors, width }, out) {
    const bed = scale(pick(colors, 0), 0.04);
    for (let i = 0; i < out.length; i++) {
      const strike = lightningAt(time, i, 0.08 + 0.25 * width);
      out[i] = strike > 0 ? scale(COLD_WHITE, strike) : bed;
    }
  },
};

/** Steady colour, but bulbs stutter as if failing; a couple are really on their way out. */
export const dyingBulb: Look = {
  id: "dying-bulb",
  name: "Dying Bulb",
  spooky: true,
  render({ time, colors }, out) {
    for (let i = 0; i < out.length; i++) {
      const badBulb = hash(i, 7) < 0.3;
      const stutter = hash(Math.floor(time * 14), i) < (badBulb ? 0.45 : 0.04);
      const dropout = badBulb && noise(time * 0.35, i + 20) < 0.25;
      const buzz = 0.85 + 0.15 * noise(time * 40, i + 40);
      out[i] =
        stutter || dropout
          ? scale(pick(colors, 0), 0.02)
          : scale(pick(colors, 0), buzz);
    }
  },
};

/** One dim light slowly crawls across the line; everything else dark. Width = blob size. */
export const creep: Look = {
  id: "creep",
  name: "Creep",
  spooky: true,
  render({ beats, colors, pos, width }, out) {
    // Over 16 beats go left → right, then 16 back, easing at the ends.
    const t = frac(beats / 32);
    const x = 0.5 - 0.5 * Math.cos(t * 2 * Math.PI);
    const w = 0.08 + 0.2 * width;
    for (let i = 0; i < out.length; i++) {
      const d = (pos[i]! - x) / w;
      out[i] = scale(pick(colors, 0), 0.55 * Math.exp(-d * d));
    }
  },
};

/** A calm wash that's randomly seized by violent colour glitches. */
export const possession: Look = {
  id: "possession",
  name: "Possession",
  spooky: true,
  render({ beats, time, colors }, out) {
    const window = Math.floor(beats * 2); // half-beat windows
    const possessed = hash(window, 5) < 0.18;
    for (let i = 0; i < out.length; i++) {
      const calm = scale(blendAt(colors, beats / 32 + i * 0.04), 0.6);
      if (!possessed) {
        out[i] = calm;
        continue;
      }
      const jitter = Math.floor(time * 25); // changes 25×/s while possessed
      const r = hash(jitter, i);
      out[i] =
        r < 0.2
          ? { r: 0, g: 0, b: 0 }
          : r < 0.35
            ? WHITE
            : r < 0.7
              ? hsv(hash(jitter, i + 70), 1, 1)
              : mix(calm, pick(colors, Math.floor(r * 10)), 1);
    }
  },
};

export const SPOOKY_LOOKS: readonly Look[] = [
  lightning,
  dyingBulb,
  creep,
  possession,
];
