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
  /** Strobe channel values for the slowest and fastest strobe. PROBE */
  strobeRange: { slow: number; fast: number };
}

export interface RigConfig {
  /** DMX start address of each light. PROBE (old setup used 1, 11, 21 … 71). */
  addresses: Record<LightId, number>;
  profile: FixtureProfile;
  /** Cap on strobe speed, 0–1 of strobeRange. Photosensitivity safety; raise with care. */
  maxStrobe: number;
  /** DMX refresh rate. PROBE (pick the steadiest rate from the flicker test). */
  fps: number;
}

export const RIG: RigConfig = {
  addresses: { L1: 1, L2: 11, L3: 21, L4: 31, R1: 41, R2: 51, R3: 61, R4: 71 },
  profile: {
    offsets: { master: 0, r: 1, g: 2, b: 3, rgb: 4, strobe: 5, mode: 6 },
    // 0 = steady manual colour. The 2024 show left all three at 0 and the lights held steady;
    // setting strobe/mode to 1 made them flash in spurts (1 is "strobe slowly"/"run a
    // program", not "off"), even though the paper manual lists those channels as 1–255.
    neutral: { rgb: 0, strobe: 0, mode: 0 },
    strobeRange: { slow: 16, fast: 255 },
  },
  maxStrobe: 0.6,
  fps: 30,
};
