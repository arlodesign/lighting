export const BEATS_PER_BAR = 4;
const MIN_BPM = 50;
const MAX_BPM = 220;
/** A pause longer than this between taps starts a fresh tap sequence. */
const TAP_RESET_MS = 2000;
const MAX_TAPS = 8;

/**
 * Free-running musical clock. Everything rhythmic asks it "what beat is it?" rather than
 * counting frames, so looks stay locked to the band no matter how unevenly frames arrive.
 *
 * Time is linear between anchors: beats(now) = anchor.beat + (now − anchor.time) / period.
 * Tapping or changing BPM moves the anchor; it never rewinds more than half a beat.
 */
export class BeatClock {
  #periodMs: number;
  #anchorTime: number;
  #anchorBeat = 0;
  #taps: number[] = [];

  constructor(bpm = 120, now = performance.now()) {
    this.#periodMs = 60_000 / clampBpm(bpm);
    this.#anchorTime = now;
  }

  get bpm(): number {
    return 60_000 / this.#periodMs;
  }

  /** Taps in the current sequence (0 when idle) — the HUD shows this while tapping. */
  tapCount(now: number): number {
    const last = this.#taps.at(-1);
    return last !== undefined && now - last <= TAP_RESET_MS
      ? this.#taps.length
      : 0;
  }

  beats(now: number): number {
    return this.#anchorBeat + (now - this.#anchorTime) / this.#periodMs;
  }

  /** 0–1 through the current beat. */
  phase(now: number): number {
    const b = this.beats(now);
    return b - Math.floor(b);
  }

  /** 0–3: which beat of the bar. */
  beatOfBar(now: number): number {
    return mod(Math.floor(this.beats(now)), BEATS_PER_BAR);
  }

  /** Change tempo without a jump: the beat position at `now` is preserved. */
  setBpm(bpm: number, now: number): void {
    this.#reanchor(now, this.beats(now));
    this.#periodMs = 60_000 / clampBpm(bpm);
  }

  /**
   * Register a tap. The first tap of a sequence means "this is the 1" (snaps the downbeat
   * without touching tempo); later taps also set the tempo from the gaps between them.
   */
  tap(now: number): void {
    if (this.tapCount(now) === 0) this.#taps = [];
    this.#taps.push(now);
    if (this.#taps.length > MAX_TAPS) this.#taps.shift();

    if (this.#taps.length >= 2) {
      const intervals = this.#taps.slice(1).map((t, i) => t - this.#taps[i]!);
      const estimate = estimateBeatMs(intervals);
      if (estimate !== undefined) {
        this.#reanchor(now, this.beats(now));
        this.#periodMs = 60_000 / clampBpm(60_000 / estimate);
      }
    }

    // This tap lands on a beat: the n-th tap of the sequence is beat n of the bar.
    const wantBeatOfBar = (this.#taps.length - 1) % BEATS_PER_BAR;
    this.#reanchor(now, nearestBeatWith(this.beats(now), wantBeatOfBar));
  }

  #reanchor(time: number, beat: number): void {
    this.#anchorTime = time;
    this.#anchorBeat = beat;
  }
}

/**
 * Turn the gaps between taps into one beat length. Median, not mean: one fumbled tap
 * (a beer-hand double-tap, a late hit) shouldn't drag the tempo off.
 */
export function estimateBeatMs(
  intervals: readonly number[],
): number | undefined {
  const plausible = intervals.filter(
    (ms) => ms >= 60_000 / MAX_BPM && ms <= 60_000 / MIN_BPM,
  );
  if (plausible.length === 0) return undefined;
  const sorted = [...plausible].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Closest integer beat to `beats` whose position in the bar is `beatOfBar`. */
export function nearestBeatWith(beats: number, beatOfBar: number): number {
  const base = Math.round(beats);
  for (let offset = 0; offset <= BEATS_PER_BAR; offset++) {
    for (const candidate of [base + offset, base - offset]) {
      if (mod(candidate, BEATS_PER_BAR) === beatOfBar) return candidate;
    }
  }
  return base;
}

const clampBpm = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
const mod = (n: number, m: number) => ((n % m) + m) % m;
