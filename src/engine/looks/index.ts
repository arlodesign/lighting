import type { Look } from "../look.ts";
import { CORE_LOOKS } from "./core.ts";
import { SPOOKY_LOOKS } from "./spooky.ts";

/**
 * Every look, in key order: the 12 core looks fill the first octave of keys, the spooky
 * ones the second. Add your own by writing a Look and appending it here.
 */
export const LOOKS: readonly Look[] = [...CORE_LOOKS, ...SPOOKY_LOOKS];

export function findLook(id: string): Look | undefined {
  return LOOKS.find((look) => look.id === id);
}
