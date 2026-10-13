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
 * and the geometry answers differently, so one chase becomes three different moves:
 *  - linear: 0 at the far left → 1 at the far right (sweeps across the stage)
 *  - mirror: 0 in the middle → 1 at both edges (bursts out from the band / closes in)
 *  - split:  each side counts 0 → 1 on its own (both sides move in parallel)
 */
export const GEOMETRIES = ["linear", "mirror", "split"] as const;
export type Geometry = (typeof GEOMETRIES)[number];

export function positions(geometry: Geometry): number[] {
  const half = LIGHT_COUNT / 2;
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
  return geometry === "linear" ? LIGHT_COUNT : LIGHT_COUNT / 2;
}
