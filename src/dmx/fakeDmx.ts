import { UNIVERSE_SIZE, type DmxOutput, type DmxStats } from "./types.ts";

/**
 * Stand-in for the Open DMX when no hardware is attached (dev machine, tests).
 * Snapshots each "frame" so tests can assert on exactly what would have been sent.
 */
export class FakeDmxOutput implements DmxOutput {
  readonly universe = new Uint8Array(UNIVERSE_SIZE);
  readonly stats: DmxStats = {
    frames: 0,
    lateFrames: 0,
    maxGapMs: 0,
    errors: 0,
  };
  readonly sent: Uint8Array[] = [];
  #timer: NodeJS.Timeout | undefined;
  #fps: number;
  #keep: number;

  constructor(opts: { fps?: number; keepFrames?: number } = {}) {
    this.#fps = opts.fps ?? 30;
    this.#keep = opts.keepFrames ?? 120;
  }

  async start(): Promise<void> {
    this.#schedule();
  }

  async stop(): Promise<void> {
    clearInterval(this.#timer);
    this.#timer = undefined;
  }

  setFps(fps: number): void {
    this.#fps = fps;
    if (this.#timer) this.#schedule();
  }

  /** Send one frame immediately — handy in tests instead of waiting on the timer. */
  flush(): Uint8Array {
    const frame = this.universe.slice();
    this.sent.push(frame);
    if (this.sent.length > this.#keep) this.sent.shift();
    this.stats.frames++;
    return frame;
  }

  #schedule(): void {
    clearInterval(this.#timer);
    this.#timer = setInterval(() => this.flush(), 1000 / this.#fps);
  }
}
