/**
 * The Energy fader (fader 2): every song has three versions of its look.
 *   bottom  = Low  (verse: dimmer, half speed, one color, narrow)
 *   middle  = Mid  (the song's preset, what the knobs and keys set)
 *   top     = High (chorus: lifted brightness, double speed, more colors, wider)
 * Low and High start out derived from Mid, so a song with no special setup still gets a
 * sensible verse and chorus. Anything the operator changes while the fader sits in Low or
 * High is kept as an override on top of that.
 */
import type { Geometry } from "./rig.ts";

export type LevelId = "low" | "mid" | "high";
export const LEVEL_IDS: readonly LevelId[] = ["low", "mid", "high"];

/** The parts of the show a level sets. */
export interface Level {
  lookIndex: number;
  paletteIndex: number;
  hue: number;
  saturation: number;
  speedIndex: number;
  fadeIndex: number;
  geometry: Geometry;
  width: number;
  variety: number;
}
export const LEVEL_FIELDS = [
  "lookIndex",
  "paletteIndex",
  "hue",
  "saturation",
  "speedIndex",
  "fadeIndex",
  "geometry",
  "width",
  "variety",
] as const satisfies readonly (keyof Level)[];

export type LevelOverrides = Partial<Level>;

export function pickLevel(from: Level): Level {
  const out = {} as Record<keyof Level, unknown>;
  for (const f of LEVEL_FIELDS) out[f] = from[f];
  return out as Level;
}

/** Low and High, worked out from Mid. `speedSteps` = how many speed steps exist. */
export function deriveLevel(
  mid: Level,
  id: LevelId,
  speedSteps: number,
): Level {
  if (id === "low")
    return {
      ...mid,
      speedIndex: Math.max(0, mid.speedIndex - 1),
      variety: 0,
      width: mid.width * 0.5,
    };
  if (id === "high")
    return {
      ...mid,
      speedIndex: Math.min(speedSteps - 1, mid.speedIndex + 1),
      variety: Math.min(1, mid.variety + 1 / 3),
      width: Math.min(1, mid.width + 0.3),
    };
  return mid;
}

/** How bright each level is: a dimmer, and a lift toward full brightness (like the swell). */
export const LEVEL_FEEL: Record<LevelId, { brightness: number; lift: number }> =
  {
    low: { brightness: 0.6, lift: 0 },
    mid: { brightness: 1, lift: 0 },
    high: { brightness: 1, lift: 0.35 },
  };

/**
 * Where each level sits on the fader. Each owns a stretch (a fader has no center click, so
 * "the middle" needs some room), and the stretches in between blend from one to the next.
 */
const PLATEAUS: Record<LevelId, [number, number]> = {
  low: [0, 0.12],
  mid: [0.4, 0.6],
  high: [0.88, 1],
};

/** Which levels a fader position blends between, and how far (0 = all `from`). */
export function blendPosition(energy: number): {
  from: LevelId;
  to: LevelId;
  t: number;
} {
  const e = Math.min(1, Math.max(0, energy));
  if (e <= PLATEAUS.low[1]) return { from: "low", to: "low", t: 0 };
  if (e < PLATEAUS.mid[0])
    return {
      from: "low",
      to: "mid",
      t: (e - PLATEAUS.low[1]) / (PLATEAUS.mid[0] - PLATEAUS.low[1]),
    };
  if (e <= PLATEAUS.mid[1]) return { from: "mid", to: "mid", t: 0 };
  if (e < PLATEAUS.high[0])
    return {
      from: "mid",
      to: "high",
      t: (e - PLATEAUS.mid[1]) / (PLATEAUS.high[0] - PLATEAUS.mid[1]),
    };
  return { from: "high", to: "high", t: 0 };
}

/** The level the knobs and keys (and ⌘S) work on: whichever the fader is nearest. */
export function editingLevel(energy: number): LevelId {
  return energy < 0.25 ? "low" : energy > 0.75 ? "high" : "mid";
}

/**
 * Part-way between two levels. Smooth things (hue, width, …) slide; things that can only be
 * one value (look, palette, speed, shape) switch halfway, and the engine crossfades them.
 */
export function blendLevels(a: Level, b: Level, t: number): Level {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const near = t < 0.5 ? a : b;
  // Hue goes the short way around the color wheel.
  let dh = b.hue - a.hue;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  return {
    lookIndex: near.lookIndex,
    paletteIndex: near.paletteIndex,
    speedIndex: near.speedIndex,
    fadeIndex: near.fadeIndex,
    geometry: near.geometry,
    hue: (((a.hue + dh * t) % 1) + 1) % 1,
    saturation: lerp(a.saturation, b.saturation),
    width: lerp(a.width, b.width),
    variety: lerp(a.variety, b.variety),
  };
}

export function blendFeel(
  from: LevelId,
  to: LevelId,
  t: number,
): { brightness: number; lift: number } {
  const a = LEVEL_FEEL[from];
  const b = LEVEL_FEEL[to];
  return {
    brightness: a.brightness + (b.brightness - a.brightness) * t,
    lift: a.lift + (b.lift - a.lift) * t,
  };
}

/** Left ↔ right balance (fader 3): the middle keeps both sides full; up keeps the left and fades the
 * right out, down the reverse. */
export function balanceGains(balance: number): { left: number; right: number } {
  const b = Math.min(1, Math.max(0, balance));
  const off = Math.abs(b - 0.5) - BALANCE_CENTER;
  if (off <= 0) return { left: 1, right: 1 };
  const other = 1 - off / (0.5 - BALANCE_CENTER); // 1 at the dead zone's edge → 0 at the end
  return b > 0.5 ? { left: 1, right: other } : { left: other, right: 1 };
}
/** A small dead zone around the middle, since a fader has no center click. */
const BALANCE_CENTER = 0.05;
