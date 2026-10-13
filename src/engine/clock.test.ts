import { describe, expect, it } from "vitest";
import { BeatClock, estimateBeatMs, nearestBeatWith } from "./clock.ts";

describe("BeatClock", () => {
  it("counts beats at the set tempo", () => {
    const clock = new BeatClock(120, 0);
    expect(clock.beats(500)).toBeCloseTo(1);
    expect(clock.beats(2000)).toBeCloseTo(4);
    expect(clock.phase(750)).toBeCloseTo(0.5);
  });

  it("changes tempo without jumping", () => {
    const clock = new BeatClock(120, 0);
    clock.setBpm(60, 1000); // at beat 2
    expect(clock.beats(1000)).toBeCloseTo(2);
    expect(clock.beats(2000)).toBeCloseTo(3);
  });

  it("sets tempo from taps and puts the first tap on the downbeat", () => {
    const clock = new BeatClock(120, 0);
    const start = 10_130; // arbitrary, off-grid
    [0, 600, 1200, 1800].forEach((dt) => clock.tap(start + dt)); // 100 BPM
    expect(clock.bpm).toBeCloseTo(100);
    // 4th tap = beat 4 of the bar (index 3), exactly on a beat
    expect(clock.beatOfBar(start + 1800)).toBe(3);
    expect(clock.phase(start + 1800)).toBeCloseTo(0);
    // the next beat after the last tap is a downbeat
    expect(clock.beatOfBar(start + 2400)).toBe(0);
  });

  it("a single tap after a pause just snaps the downbeat", () => {
    const clock = new BeatClock(120, 0);
    clock.tap(10_250);
    expect(clock.bpm).toBeCloseTo(120);
    expect(clock.beatOfBar(10_250)).toBe(0);
    expect(clock.phase(10_250)).toBeCloseTo(0);
  });

  it("starts a fresh sequence after a long pause", () => {
    const clock = new BeatClock(120, 0);
    clock.tap(0);
    clock.tap(500);
    expect(clock.tapCount(500)).toBe(2);
    expect(clock.tapCount(3000)).toBe(0);
    clock.tap(5000);
    clock.tap(5400); // 150 BPM from this pair alone
    expect(clock.bpm).toBeCloseTo(150);
  });
});

describe("estimateBeatMs", () => {
  it("ignores one fumbled tap", () => {
    expect(estimateBeatMs([500, 500, 120, 500, 510])).toBe(500);
  });
  it("rejects impossible tempos", () => {
    expect(estimateBeatMs([50, 5000])).toBeUndefined();
  });
});

describe("nearestBeatWith", () => {
  it("finds the closest beat in the right bar slot", () => {
    expect(nearestBeatWith(9.2, 0)).toBe(8);
    expect(nearestBeatWith(9.2, 1)).toBe(9);
    expect(nearestBeatWith(9.2, 3)).toBe(11);
  });
});
