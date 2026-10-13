import { FakeDmxOutput } from "./fakeDmx.ts";
import { findOpenDmxPorts, OpenDmxOutput, type BreakMode } from "./openDmx.ts";
import type { DmxOutput } from "./types.ts";

const POLL_MS = 2000;

/**
 * Owns "whatever DMX output we have right now". Looks for the Open DMX, falls back to a
 * fake output while it's missing, and swaps the real one in when it's plugged (back) in.
 * The engine writes to `universe` and never needs to know which is behind it.
 */
export class DmxManager {
  #output: DmxOutput = new FakeDmxOutput();
  #port: string | null = null;
  #timer: NodeJS.Timeout | undefined;
  #opts: { fps: number; breakMode: BreakMode; forceFake: boolean };

  constructor(opts: {
    fps: number;
    breakMode?: BreakMode;
    forceFake?: boolean;
  }) {
    this.#opts = {
      fps: opts.fps,
      breakMode: opts.breakMode ?? "brk",
      forceFake: opts.forceFake ?? false,
    };
  }

  /** The active output's channels. Re-read it each frame: it changes when devices swap. */
  get universe(): Uint8Array {
    return this.#output.universe;
  }

  get status() {
    const s = this.#output.stats;
    return {
      connected: this.#port !== null,
      port: this.#port,
      fake: this.#output instanceof FakeDmxOutput,
      fps: this.#opts.fps,
      lateFrames: s.lateFrames,
      errors: s.errors,
      ...(s.lastError && { lastError: s.lastError }),
    };
  }

  async start(): Promise<void> {
    await this.#output.start();
    if (this.#opts.forceFake) {
      console.log("[dmx] using fake output (--fake)");
      return;
    }
    await this.#poll();
    this.#timer = setInterval(() => void this.#poll(), POLL_MS);
  }

  async stop(): Promise<void> {
    clearInterval(this.#timer);
    await this.#output.stop();
  }

  async #poll(): Promise<void> {
    const ports = await findOpenDmxPorts().catch(() => [] as string[]);

    // A real output that keeps erroring has most likely been unplugged.
    if (
      this.#port &&
      (!ports.includes(this.#port) || this.#output.stats.errors > 20)
    ) {
      console.log(`[dmx] lost ${this.#port}; falling back to fake output`);
      await this.#swap(new FakeDmxOutput(), null);
    }
    if (this.#port || ports.length === 0) return;

    const port = ports[0]!;
    const real = new OpenDmxOutput({
      path: port,
      fps: this.#opts.fps,
      breakMode: this.#opts.breakMode,
    });
    try {
      await this.#swap(real, port);
      console.log(`[dmx] sending on ${port} at ${this.#opts.fps} fps`);
    } catch (err) {
      console.log(
        `[dmx] couldn't open ${port}: ${err instanceof Error ? err.message : err}`,
      );
      await this.#swap(new FakeDmxOutput(), null);
    }
  }

  async #swap(next: DmxOutput, port: string | null): Promise<void> {
    const previous = this.#output;
    await previous.stop().catch(() => {});
    next.universe.set(previous.universe); // carry the current look across
    this.#output = next;
    this.#port = port;
    await next.start();
  }
}
