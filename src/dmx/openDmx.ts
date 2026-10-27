import { SerialPort } from "serialport";
import { setTimeout as sleep } from "node:timers/promises";
import { UNIVERSE_SIZE, type DmxOutput, type DmxStats } from "./types.ts";

/**
 * How the DMX "break" (a long low pulse that marks the start of each frame) is made.
 * - "brk":  ask the serial driver to hold the line low (TIOCSBRK). Cleanest, if the driver supports it.
 * - "baud": drop to a slow baud rate and send one 0x00 byte, whose start bit + zeros last long
 *           enough to count as a break. Works on drivers that ignore break requests.
 */
export type BreakMode = "brk" | "baud";

const DMX_BAUD = 250_000;
// At 76.8k baud one 0x00 byte holds the line low for 9 bits ≈ 117µs (spec minimum: 88µs),
// and its stop bit gives ≈ 26µs of mark-after-break (spec minimum: 8µs).
const BREAK_BAUD = 76_800;
// 1 start + 8 data + 2 stop bits = 11 bits per slot; start code + 512 channels = 513 slots.
const FRAME_TX_MS = ((UNIVERSE_SIZE + 1) * 11 * 1000) / DMX_BAUD; // ≈ 22.6ms

/** The slice of a serial port this driver uses — lets tests pass serialport's SerialPortMock. */
export type DmxSerialPort = Pick<
  SerialPort,
  "open" | "close" | "write" | "drain" | "set" | "update" | "isOpen"
>;

type PortSettings = {
  path: string;
  baudRate: number;
  dataBits: 8;
  stopBits: 1 | 2;
  parity: "none";
  autoOpen: false;
};

export interface OpenDmxOptions {
  path: string;
  fps?: number;
  breakMode?: BreakMode;
  /** DMX specifies 2; some receivers are happier with 1. Used by the probe's variant sweep. */
  stopBits?: 1 | 2;
  /** How long the "brk" method holds the line low, in ms (default 1). */
  breakMs?: number;
  createPort?: (settings: PortSettings) => DmxSerialPort;
}

/** Find FTDI-based serial devices (the ENTTEC Open DMX USB is an FTDI FT232R). */
export async function findOpenDmxPorts(): Promise<string[]> {
  const ports = await SerialPort.list();
  return ports
    .filter(
      (p) => p.vendorId?.toLowerCase() === "0403" || /usbserial/i.test(p.path),
    )
    .map((p) => toCalloutPath(p.path));
}

/**
 * macOS exposes each serial device twice. /dev/tty.* waits for a carrier-detect signal the
 * Open DMX never sends, so opening it can hang; /dev/cu.* ("call-up") opens immediately.
 */
export function toCalloutPath(path: string): string {
  return path.replace(/^\/dev\/tty\./, "/dev/cu.");
}

/**
 * Driver for the ENTTEC Open DMX USB. The box has no processor: it's a USB→serial chip
 * wired to a DMX line driver, so this class must generate every frame, break and all,
 * continuously. If we stop sending, the lights simply keep whatever they last received.
 */
export class OpenDmxOutput implements DmxOutput {
  readonly universe = new Uint8Array(UNIVERSE_SIZE);
  readonly stats: DmxStats = {
    frames: 0,
    lateFrames: 0,
    maxGapMs: 0,
    errors: 0,
  };
  readonly path: string;
  breakMode: BreakMode;
  readonly stopBits: 1 | 2;
  readonly breakMs: number;

  #port: DmxSerialPort | undefined;
  #createPort: (settings: PortSettings) => DmxSerialPort;
  #periodMs = 0;
  #running = false;
  #loopDone: Promise<void> = Promise.resolve();

  constructor(opts: OpenDmxOptions) {
    this.path = toCalloutPath(opts.path);
    this.breakMode = opts.breakMode ?? "brk";
    this.stopBits = opts.stopBits ?? 2;
    this.breakMs = opts.breakMs ?? 1;
    this.#createPort =
      opts.createPort ?? ((settings) => new SerialPort(settings));
    this.setFps(opts.fps ?? 30);
  }

  setFps(fps: number): void {
    // A frame physically takes ~23ms on the wire, so ~40fps is the ceiling.
    this.#periodMs = Math.max(1000 / fps, FRAME_TX_MS + 2);
  }

  get fps(): number {
    return 1000 / this.#periodMs;
  }

  resetStats(): void {
    Object.assign(this.stats, {
      frames: 0,
      lateFrames: 0,
      maxGapMs: 0,
      errors: 0,
    });
  }

  async start(): Promise<void> {
    if (this.#running) return;
    const port = this.#createPort({
      path: this.path,
      baudRate: DMX_BAUD,
      dataBits: 8,
      stopBits: this.stopBits,
      parity: "none",
      autoOpen: false,
    });
    await new Promise<void>((resolve, reject) =>
      port.open((err) => (err ? reject(err) : resolve())),
    );
    this.#port = port;
    this.#running = true;
    this.#loopDone = this.#loop();
  }

  async stop(): Promise<void> {
    this.#running = false;
    await this.#loopDone;
    const port = this.#port;
    this.#port = undefined;
    if (port?.isOpen)
      await new Promise<void>((resolve) => port.close(() => resolve()));
  }

  async #loop(): Promise<void> {
    let lastStart = performance.now();
    while (this.#running) {
      const start = performance.now();
      const gap = start - lastStart;
      if (this.stats.frames > 0) {
        this.stats.maxGapMs = Math.max(this.stats.maxGapMs, gap);
        if (gap > this.#periodMs * 1.5) this.stats.lateFrames++;
      }
      lastStart = start;

      try {
        await this.#sendFrame();
        this.stats.frames++;
      } catch (err) {
        this.stats.errors++;
        this.stats.lastError = err instanceof Error ? err.message : String(err);
        await sleep(250); // don't spin if the device was unplugged
      }

      const elapsed = performance.now() - start;
      await sleep(Math.max(0, this.#periodMs - elapsed));
    }
  }

  async #sendFrame(): Promise<void> {
    const port = this.#port;
    if (!port) return;

    if (this.breakMode === "brk") {
      await this.#set(port, { brk: true });
      await sleep(this.breakMs); // ≥1ms low: well past the 88µs minimum, well under the 1s maximum
      await this.#set(port, { brk: false });
    } else {
      await this.#update(port, BREAK_BAUD);
      await this.#write(port, Buffer.of(0));
      await this.#update(port, DMX_BAUD);
    }

    const frame = Buffer.alloc(UNIVERSE_SIZE + 1); // slot 0 = start code 0x00
    frame.set(this.universe, 1);
    const writeStart = performance.now();
    await this.#write(port, frame);

    // drain() only means "handed to the OS" — bytes may still be leaving the USB chip.
    // Starting the next break early would chop the end off this frame, so wait it out.
    const remaining = FRAME_TX_MS + 1 - (performance.now() - writeStart);
    if (remaining > 0) await sleep(remaining);
  }

  #set(port: DmxSerialPort, opts: { brk: boolean }): Promise<void> {
    return new Promise((resolve, reject) =>
      port.set(opts, (err) => (err ? reject(err) : resolve())),
    );
  }

  #update(port: DmxSerialPort, baudRate: number): Promise<void> {
    return new Promise((resolve, reject) =>
      port.update({ baudRate }, (err) => (err ? reject(err) : resolve())),
    );
  }

  #write(port: DmxSerialPort, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      port.write(data, (err) => {
        if (err) return reject(err);
        port.drain((drainErr) => (drainErr ? reject(drainErr) : resolve()));
      });
    });
  }
}
