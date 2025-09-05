import type { RenderTime, TempoInfo } from "./types";

export type TimeHelpers = {
  nowMs: number;
  deltaMs: number;
  beatPhase: number; // 0..1
  barPhase: number; // 0..1
  cycle: (periodMs: number, phase?: number) => number; // 0..1
  pulse: (periodMs: number, width?: number, phase?: number) => number; // 0..1
  beat: (division?: number) => boolean; // true when a divided beat boundary occurs (approx)
  step: <T>(arr: readonly T[], periodMs: number, phase?: number) => T;
  lerp: (a: number, b: number, t: number) => number;
  easeInOutQuad: (t: number) => number;
  sin01: (t: number) => number;
  tri01: (t: number) => number;
};

export function createTimeHelpers(time: RenderTime, tempo: TempoInfo): TimeHelpers {
  const lastBeatMs = tempo.bpm ? 60000 / tempo.bpm : null;
  const cycle = (periodMs: number, phase = 0) => {
    if (periodMs <= 0) return 0;
    const t = (time.nowMs / periodMs + phase) % 1;
    return (t + 1) % 1;
  };
  const pulse = (periodMs: number, width = 0.5, phase = 0) => {
    const x = cycle(periodMs, phase);
    return x < width ? 1 : 0;
  };
  const beat = (division = 1) => {
    if (!lastBeatMs || !tempo.lastTapAt) return false;
    const msPerDiv = lastBeatMs * division;
    const prev = ((time.nowMs - time.deltaMs) - tempo.lastTapAt) / msPerDiv;
    const curr = (time.nowMs - tempo.lastTapAt) / msPerDiv;
    return Math.floor(curr) !== Math.floor(prev);
  };
  const step = <T>(arr: readonly T[], periodMs: number, phase = 0): T => {
    if (arr.length === 0) throw new Error("step() requires non-empty array");
    const x = Math.floor((time.nowMs / periodMs + phase) * arr.length) % arr.length;
    return arr[(x + arr.length) % arr.length];
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const sin01 = (t: number) => (Math.sin(t * Math.PI * 2) + 1) / 2;
  const tri01 = (t: number) => 1 - Math.abs(((t * 2) % 2) - 1);

  return {
    nowMs: time.nowMs,
    deltaMs: time.deltaMs,
    beatPhase: tempo.beatPhase,
    barPhase: tempo.barPhase,
    cycle,
    pulse,
    beat,
    step,
    lerp,
    easeInOutQuad,
    sin01,
    tri01,
  };
}

