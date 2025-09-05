import type { DmxPatch } from "./types";

export const blendLinear = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

export function blendPatches(a: DmxPatch, b: DmxPatch, t: number): DmxPatch {
  const out: DmxPatch = {};
  const keys = new Set<number>([
    ...Object.keys(a).map(Number),
    ...Object.keys(b).map(Number),
  ]);
  for (const addr of keys) {
    const va = a[addr] ?? 0;
    const vb = b[addr] ?? 0;
    out[addr] = blendLinear(va, vb, t);
  }
  return out;
}

