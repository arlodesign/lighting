/**
 * Rig settings that come from the real hardware. The values marked PROBE are best guesses
 * until probe-reports/ comes back from the show laptop.
 */
import type { LightId } from "./engine/rig.ts";

/** The fixture's 7-channel DMX personality (from the paper manual). Offsets from the start address. */
export interface FixtureProfile {
  offsets: {
    master: number;
    r: number;
    g: number;
    b: number;
    rgb: number;
    strobe: number;
    mode: number;
  };
  /** Values for the "extra" channels that leave the fixture in plain manual RGB. PROBE */
  neutral: { rgb: number; strobe: number; mode: number };
  /**
   * Strobe channel values a light press and a hard press of the strobe pad map to
   * (see STROBE_CURVE for what they mean in flashes per second).
   */
  strobeRange: { slow: number; fast: number };
}

/**
 * The lights' strobe channel, measured on the show rig (npm run strobe-sweep, 2026-10-26).
 * Value 0 is off; values 1–255 run the flash rate up on a curve that fits
 *   flashes per second ≈ a · e^(b · value)
 * from about 0.75/s at value 1 (too slow to see changes below ~50) to about 8/s at 255.
 * Measured: 64→1.4/s, 96→1.8/s, 128→2.3/s, 192→4.6/s, 255→7.6/s.
 */
export const STROBE_CURVE = { a: 0.741, b: 0.00932 } as const;

export const strobeHzForValue = (value: number): number =>
  STROBE_CURVE.a * Math.exp(STROBE_CURVE.b * value);

/** The strobe channel value (1–255) closest to a wanted flash rate. */
export function strobeValueForHz(hz: number): number {
  const value = Math.log(hz / STROBE_CURVE.a) / STROBE_CURVE.b;
  return Math.min(255, Math.max(1, Math.round(value)));
}

/**
 * What the strobe pad does: a light press flashes at STROBE_MIN_HZ, a hard press at
 * STROBE_MAX_HZ. The light itself tops out near 8/s. Fast flashing can trigger seizures in
 * photosensitive people, so the default stops well short of that: raise it only if you're
 * sure about the audience, and keep hits momentary (they only run while the pad is held).
 */
export const STROBE_MIN_HZ = 2;
export const STROBE_MAX_HZ = 6;

export interface RigConfig {
  /** DMX start address of each light. PROBE (old setup used 1, 11, 21 … 71). */
  addresses: Record<LightId, number>;
  profile: FixtureProfile;
  /**
   * Extra cap on the strobe pad, 0–1 of strobeRange. 1 = no extra cap: the safety limit is
   * STROBE_MAX_HZ below, which is where strobeRange.fast comes from.
   */
  maxStrobe: number;
  /** DMX refresh rate. PROBE (pick the steadiest rate from the flicker test). */
  fps: number;
}

export const RIG: RigConfig = {
  addresses: { L1: 1, L2: 11, L3: 21, L4: 31, R1: 41, R2: 51, R3: 61, R4: 71 },
  profile: {
    offsets: { master: 0, r: 1, g: 2, b: 3, rgb: 4, strobe: 5, mode: 6 },
    // 0 = steady manual color. The 2024 show left all three at 0 and the lights held steady;
    // setting strobe/mode to 1 made them flash in spurts (1 is "strobe slowly"/"run a
    // program", not "off"), even though the paper manual lists those channels as 1–255.
    neutral: { rgb: 0, strobe: 0, mode: 0 },
    strobeRange: {
      slow: strobeValueForHz(STROBE_MIN_HZ),
      fast: strobeValueForHz(STROBE_MAX_HZ),
    },
  },
  maxStrobe: 1,
  fps: 30,
};
