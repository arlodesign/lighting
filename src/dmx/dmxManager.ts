import { FakeDmxOutput } from "./fakeDmx.ts";
import { FtdiUsbOutput } from "./ftdiUsb.ts";
import { findOpenDmxPorts, OpenDmxOutput, type BreakMode } from "./openDmx.ts";
import { QlcOutput, QLC_DEFAULT_URL } from "./qlcOutput.ts";
import type { DmxOutput } from "./types.ts";

const POLL_MS = 2000;

/**
 * How DMX leaves the laptop:
 *  - "usb":    straight to the Open DMX's FTDI chip over USB (libusb), the way QLC+ does,
 *              with no QLC+ in between. Verified on the show laptop; the default.
 *              QLC+ must be closed: only one program can own the adapter.
 *  - "qlc":    through QLC+ (a lighting app that owns the adapter and does the DMX timing).
 *              The backup if the direct route ever misbehaves.
 *  - "serial": straight to the Open DMX via the OS serial driver. Works on some machines,
 *              but on the show MacBook Air the lights never received a valid signal.
 *  - "fake":   no hardware — the preview and tests.
 */
export type DmxBackend = "qlc" | "usb" | "serial" | "fake";

/**
 * Owns "whatever DMX output we have right now". The engine writes to `universe` and never
 * needs to know which backend is behind it.
 */
export class DmxManager {
  #output: DmxOutput;
  #backend: DmxBackend;
  #port: string | null = null;
  #timer: NodeJS.Timeout | undefined;
  #lastUsbError = "";
  #lastError = "";
  #opts: { fps: number; breakMode: BreakMode; qlcUrl: string };

  constructor(opts: {
    backend: DmxBackend;
    fps: number;
    breakMode?: BreakMode;
    qlcUrl?: string;
  }) {
    this.#backend = opts.backend;
    this.#opts = {
      fps: opts.fps,
      breakMode: opts.breakMode ?? "brk",
      qlcUrl: opts.qlcUrl ?? QLC_DEFAULT_URL,
    };
    this.#output =
      opts.backend === "qlc"
        ? new QlcOutput({ url: this.#opts.qlcUrl, fps: opts.fps })
        : new FakeDmxOutput();
  }

  /** The active output's channels. Re-read it each frame: it changes when devices swap. */
  get universe(): Uint8Array {
    return this.#output.universe;
  }

  get status() {
    const s = this.#output.stats;
    const qlc = this.#output instanceof QlcOutput ? this.#output : undefined;
    return {
      backend: this.#backend,
      connected: qlc ? qlc.connected : this.#port !== null,
      port: qlc ? this.#opts.qlcUrl : this.#port,
      fake: this.#output instanceof FakeDmxOutput,
      fps: this.#opts.fps,
      lateFrames: s.lateFrames,
      errors: s.errors,
      ...((s.lastError || this.#lastError) && {
        lastError: s.lastError || this.#lastError,
      }),
    };
  }

  async start(): Promise<void> {
    await this.#output.start();
    if (this.#backend === "qlc") {
      console.log(`[dmx] sending through QLC+ at ${this.#opts.qlcUrl}`);
      return;
    }
    if (this.#backend === "fake") {
      console.log("[dmx] using fake output (preview only)");
      return;
    }
    const poll = () =>
      this.#backend === "usb" ? this.#pollUsb() : this.#poll();
    await poll();
    this.#timer = setInterval(() => void poll(), POLL_MS);
  }

  async stop(): Promise<void> {
    clearInterval(this.#timer);
    await this.#output.stop();
  }

  /** Same idea as #poll, for the direct-USB backend: (re)open the adapter when it's available. */
  async #pollUsb(): Promise<void> {
    if (this.#port && this.#output.stats.errors > 20) {
      console.log("[dmx] lost the adapter; falling back to fake output");
      await this.#swap(new FakeDmxOutput(), null);
      this.#lastUsbError = "";
    }
    if (this.#port) return;
    const real = new FtdiUsbOutput({ fps: this.#opts.fps });
    try {
      await this.#swap(real, "Open DMX (USB)");
      console.log(
        `[dmx] sending straight to the Open DMX over USB at ${this.#opts.fps} fps`,
      );
      this.#lastUsbError = "";
      this.#lastError = "";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message !== this.#lastUsbError) console.log(`[dmx] ${message}`);
      this.#lastUsbError = message;
      this.#lastError = message;
      await this.#swap(new FakeDmxOutput(), null).catch(() => {});
    }
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
