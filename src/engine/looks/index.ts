import type { Look } from "../look.ts";
import {
  breathe,
  chase,
  fire,
  heartbeat,
  pingPong,
  rainbowRoll,
  ripple,
  sparkle,
  split,
  sweepFill,
  wash,
} from "./core.ts";
import { creep, dyingBulb, lightning, possession } from "./spooky.ts";

/**
 * Every look, in key order: one per WHITE key (black keys are hard to find in the dark),
 * calmest on the left to most frantic on the right. If the operator misses the key they
 * meant, they land on something close in feel. Add a look by writing it and placing it here.
 */
export const LOOKS: readonly Look[] = [
  wash,
  creep,
  breathe,
  rainbowRoll,
  split,
  fire,
  heartbeat,
  sweepFill,
  ripple,
  pingPong,
  chase,
  dyingBulb,
  sparkle,
  possession,
  lightning,
];

export function findLook(id: string): Look | undefined {
  return LOOKS.find((look) => look.id === id);
}
