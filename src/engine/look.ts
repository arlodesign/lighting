import type { Rgb } from "./color.ts";
import type { Geometry, Side } from "./rig.ts";

/** What a look can know when drawing one frame. */
export interface LookContext {
  /** Musical time in beats, already scaled by the speed knob. Integer = on the beat. */
  beats: number;
  /** Wall-clock seconds, for things that shouldn't follow tempo (flicker, noise). */
  time: number;
  /** The active palette after hue/saturation knobs. Always at least one color. */
  colors: readonly Rgb[];
  /** Width/size knob, 0–1. Each look decides what it means (tail length, density, …). */
  width: number;
  geometry: Geometry;
  /** Per-light position 0–1 under the current geometry (see rig.ts). */
  pos: readonly number[];
  /** Per-light side. */
  side: readonly Side[];
  /** Number of distinct steps along the geometry. */
  steps: number;
  /** Microphone, already scaled by the sensitivity knob. */
  audio: { level: number; bass: number };
}

/**
 * A look is a pure function of its context: same context in → same colors out.
 * No hidden state means crossfades (render two looks at once), restarts and tests just work.
 */
export interface Look {
  id: string;
  name: string;
  spooky?: boolean;
  /** Write one color per light into `out` (brightness baked into the color). */
  render(ctx: LookContext, out: Rgb[]): void;
}

// ── helpers looks share ────────────────────────────────────────────────────────

/** Deterministic pseudo-random 0–1 for integer inputs (stateless "random"). */
export function hash(a: number, b = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Smooth 1-D value noise, 0–1, continuous in t. Different `seed` → independent curve. */
export function noise(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const s = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - s) + hash(i + 1, seed) * s;
}

/** Palette color i (wrapping). */
export function pick(colors: readonly Rgb[], i: number): Rgb {
  const n = colors.length;
  return colors[((Math.floor(i) % n) + n) % n]!;
}

/** Smoothly blend around the palette as x goes 0 → 1 (wraps). */
export function blendAt(colors: readonly Rgb[], x: number): Rgb {
  const n = colors.length;
  const t = (((x % 1) + 1) % 1) * n;
  const a = pick(colors, t);
  const b = pick(colors, t + 1);
  const f = t - Math.floor(t);
  return {
    r: a.r + (b.r - a.r) * f,
    g: a.g + (b.g - a.g) * f,
    b: a.b + (b.b - a.b) * f,
  };
}

/** Sharp attack, exponential decay — a "hit" envelope over phase 0–1. */
export const pulse = (phase: number, sharpness = 6) =>
  Math.exp(-phase * sharpness);

/** Shortest distance between two points on a 0–1 loop. */
export const loopDistance = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 1) + 1) % 1);
  return Math.min(d, 1 - d);
};
