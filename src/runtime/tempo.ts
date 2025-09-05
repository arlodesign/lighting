import type { TempoInfo } from "./types";

export class SceneTempo {
  private taps: number[] = []; // ms timestamps
  private lastBpm: number | null = null;

  tap(nowMs: number) {
    this.taps.push(nowMs);
    // Keep last 6 taps for stability
    if (this.taps.length > 6) this.taps.shift();
    this.computeBpm();
  }

  halve() {
    if (this.lastBpm) this.lastBpm = this.lastBpm / 2;
  }

  double() {
    if (this.lastBpm) this.lastBpm = this.lastBpm * 2;
  }

  reset() {
    this.taps = [];
    this.lastBpm = null;
  }

  private computeBpm() {
    if (this.taps.length < 2) return;
    const intervals = [] as number[];
    for (let i = 1; i < this.taps.length; i++) intervals.push(this.taps[i] - this.taps[i - 1]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avg > 0) this.lastBpm = 60000 / avg;
  }

  info(nowMs: number): TempoInfo {
    const bpm = this.lastBpm;
    let beatPhase = 0;
    let barPhase = 0;
    const lastTapAt = this.taps[this.taps.length - 1] ?? null;
    if (bpm && lastTapAt) {
      const msPerBeat = 60000 / bpm;
      const t = (nowMs - lastTapAt) / msPerBeat;
      beatPhase = ((t % 1) + 1) % 1; // wrap 0..1
      barPhase = ((t / 4) % 1 + 1) % 1; // assume 4/4
    }
    return { bpm: bpm ?? null, beatPhase, barPhase, lastTapAt };
  }
}

