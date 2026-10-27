import { describe, expect, it } from "vitest";
import { estimateStrobeHz } from "./strobeMeasure.ts";

/** Evenly spaced taps at `hz` for `seconds`, with a little human jitter. */
function taps(hz: number, seconds = 10, jitterMs = 0): number[] {
  const period = 1000 / hz;
  const out: number[] = [];
  for (let i = 0, t = 300; t < seconds * 1000; i++, t += period) {
    out.push(t + (i % 2 ? jitterMs : -jitterMs));
  }
  return out;
}

describe("estimateStrobeHz", () => {
  it("recovers the rate from steady taps", () => {
    const e = estimateStrobeHz(taps(4));
    expect(e.hz).toBeCloseTo(4, 1);
    expect(e.unreliable).toBe(false);
  });

  it("tolerates human jitter", () => {
    const e = estimateStrobeHz(taps(3, 10, 40));
    expect(e.hz).toBeGreaterThan(2.8);
    expect(e.hz).toBeLessThan(3.2);
  });

  it("ignores taps before the settle period", () => {
    // Wild early taps, then a clean 2 Hz.
    const early = [100, 150, 900, 1000];
    const e = estimateStrobeHz([...early, ...taps(2).filter((t) => t > 2500)]);
    expect(e.hz).toBeCloseTo(2, 1);
  });

  it("shrugs off a double-tap and a missed pulse", () => {
    const base = taps(2);
    const withDouble = [...base, base[8]! + 40].sort((a, b) => a - b);
    const withMiss = withDouble.filter((_, i) => i !== 12);
    const e = estimateStrobeHz(withMiss);
    expect(e.hz).toBeCloseTo(2, 1);
  });

  it("says so when there weren't enough taps", () => {
    const e = estimateStrobeHz([2500, 3500]);
    expect(e.hz).toBeNull();
    expect(e.unreliable).toBe(true);
    expect(estimateStrobeHz([]).hz).toBeNull();
  });

  it("flags erratic tapping as unreliable", () => {
    const erratic = [
      2100, 2300, 3300, 3500, 5200, 5300, 7400, 7500, 7600, 9900,
    ];
    expect(estimateStrobeHz(erratic).unreliable).toBe(true);
  });
});
