import { describe, it, expect } from "vitest";
import { SceneTempo } from "../runtime/tempo";
import { createTimeHelpers } from "../runtime/timeHelpers";

describe("SceneTempo + TimeHelpers", () => {
  it("computes bpm from taps and phases advance", () => {
    const tempo = new SceneTempo();
    const t0 = 1000;
    // 4 taps at 500ms apart -> 120 BPM
    tempo.tap(t0);
    tempo.tap(t0 + 500);
    tempo.tap(t0 + 1000);
    tempo.tap(t0 + 1500);

    const info = tempo.info(t0 + 2000);
    expect(info.bpm && Math.round(info.bpm)).toBe(120);

    const helpers = createTimeHelpers({ nowMs: t0 + 2000, deltaMs: 16 }, info);
    const c1 = helpers.cycle(1000);
    const c2 = createTimeHelpers({ nowMs: t0 + 2500, deltaMs: 16 }, info).cycle(
      1000
    );
    expect(c2).not.toBe(c1);
  });

  it("beat() returns true on division boundaries after tap", () => {
    const tempo = new SceneTempo();
    const tapTimes = [0, 500, 1000, 1500]; // 120 BPM
    tapTimes.forEach((t) => tempo.tap(t));

    // Boundary at 2000ms (1 beat after last tap at 1500)
    const info = tempo.info(2000);
    const helpersPrev = createTimeHelpers({ nowMs: 1999, deltaMs: 1 }, info);
    const helpersNow = createTimeHelpers({ nowMs: 2000, deltaMs: 1 }, info);
    expect(helpersPrev.beat()).toBe(false);
    expect(helpersNow.beat()).toBe(true);
  });

  it("step() cycles through array elements", () => {
    const tempo = new SceneTempo();
    tempo.tap(0);
    tempo.tap(500);
    const info = tempo.info(1000);
    const t1 = createTimeHelpers({ nowMs: 0, deltaMs: 16 }, info);
    const t2 = createTimeHelpers({ nowMs: 1000, deltaMs: 16 }, info);
    const arr = ["a", "b", "c"] as const;
    expect(arr.includes(t1.step(arr, 1000))).toBe(true);
    expect(arr.includes(t2.step(arr, 1000))).toBe(true);
  });
});
