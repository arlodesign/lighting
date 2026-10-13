/** Number of channels in one DMX universe. */
export const UNIVERSE_SIZE = 512;

/** Running counters so the HUD (and the probe) can tell whether output is healthy. */
export interface DmxStats {
  frames: number;
  /** Frames that started more than half a period late — a sign of macOS timer throttling. */
  lateFrames: number;
  /** Worst gap between frame starts, in ms, since the last reset. */
  maxGapMs: number;
  errors: number;
  lastError?: string;
}

/**
 * Anything that can push a 512-channel universe to lights.
 * The engine only ever talks to this, so the Open DMX driver can be swapped for
 * OLA, a fake (for tests/dev), or a future network output without touching looks.
 */
export interface DmxOutput {
  /** Channel values, index 0 = DMX channel 1. Mutate freely; the next frame picks it up. */
  readonly universe: Uint8Array;
  readonly stats: DmxStats;
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Change refresh rate on the fly (frames per second). */
  setFps(fps: number): void;
}
