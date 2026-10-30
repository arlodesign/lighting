/** Light labels, house-left → house-right as the audience sees them. */
export const LIGHT_IDS = [
  "L1",
  "L2",
  "L3",
  "L4",
  "R1",
  "R2",
  "R3",
  "R4",
] as const;
export type LightId = (typeof LIGHT_IDS)[number];
export const LIGHT_COUNT = LIGHT_IDS.length;

export type Side = "L" | "R";
export const sideOf = (index: number): Side =>
  index < LIGHT_COUNT / 2 ? "L" : "R";

/**
 * How looks see the line of lights. Every look asks "where is light i?" as a number 0–1,
 * and the geometry answers differently, so one chase becomes four different moves:
 *  - linear:  0 at the far left → 1 at the far right (sweeps across the stage)
 *  - mirror:  0 in the middle → 1 at both edges (bursts out from the band / closes in)
 *  - split:   each side counts 0 → 1 on its own (both sides move in parallel)
 *  - scatter: a random order that reshuffles every bar, so moves hop around the stage
 *             unpredictably but stay on the beat
 */
export const GEOMETRIES = ["linear", "mirror", "split", "scatter"] as const;
export type Geometry = (typeof GEOMETRIES)[number];

/**
 * @param bar which bar of the music it is (only "scatter" uses it: a new shuffle per bar,
 *            the same shuffle for every frame within a bar)
 */
export function positions(geometry: Geometry, bar = 0): number[] {
  const half = LIGHT_COUNT / 2;
  if (geometry === "scatter") {
    const order = shuffledOrder(bar);
    return LIGHT_IDS.map((_, i) => order[i]! / (LIGHT_COUNT - 1));
  }
  return LIGHT_IDS.map((_, i) => {
    switch (geometry) {
      case "linear":
        return i / (LIGHT_COUNT - 1);
      case "mirror":
        return Math.abs(i - (LIGHT_COUNT - 1) / 2) / ((LIGHT_COUNT - 1) / 2);
      case "split":
        return (i % half) / (half - 1);
    }
  });
}

/** Number of distinct steps along the geometry — chases step through these. */
export function stepCount(geometry: Geometry): number {
  return geometry === "linear" || geometry === "scatter"
    ? LIGHT_COUNT
    : LIGHT_COUNT / 2;
}

/** A deterministic shuffle of 0…7 for a given bar (Fisher–Yates with a hashed seed). */
function shuffledOrder(bar: number): number[] {
  const order = LIGHT_IDS.map((_, i) => i);
  let seed = (Math.imul(Math.floor(bar) | 0, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
  const next = () => {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    return seed / 4294967296;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}
