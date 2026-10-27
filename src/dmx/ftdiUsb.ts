import { setTimeout as sleep } from "node:timers/promises";
import { UNIVERSE_SIZE, type DmxOutput, type DmxStats } from "./types.ts";

/**
 * Talks to the FTDI FT232R chip inside the ENTTEC Open DMX USB directly over USB (libusb),
 * the way QLC+, OLA and libftdi do, instead of going through the operating system's generic
 * serial driver. Same signal, but we control every setting: exactly 250 000 baud, 8 data
 * bits, 2 stop bits, and a real hardware break between frames.
 *
 * Only one program can own the adapter at a time: quit QLC+ (and anything else using it)
 * before using this.
 */

// FTDI vendor requests (bmRequestType 0x40 = vendor, host→device).
const REQ_RESET = 0x00;
const REQ_SET_FLOW_CTRL = 0x02;
const REQ_SET_BAUD = 0x03;
const REQ_SET_DATA = 0x04;
const REQ_SET_LATENCY = 0x09;

const RESET_PURGE_TX = 2;
const BAUD_DIVISOR_250K = 12; // the chip's 3 MHz clock ÷ 12 = 250 000 baud exactly
/** 8 data bits (low byte) | 2 stop bits (bits 11–12 = 2) | no parity. */
const LINE_8N2 = 8 | (2 << 11);
const BREAK_ON = 1 << 14;

const FTDI_VENDOR_ID = 0x0403;
const FT232R_PRODUCT_ID = 0x6001;
const EP_OUT = 0x02;

// 513 slots × 11 bits at 250 kbaud ≈ 22.6 ms on the wire.
const FRAME_TX_MS = 22.6;
/** The chip buffers up to 128 bytes: after the host's write completes, ~5.6 ms is still in flight. */
const FIFO_DRAIN_MS = 7;

/** The two things the driver needs from a USB device, so tests can replace the hardware. */
export interface FtdiTransport {
  /** FTDI vendor request on the device, no data stage. */
  control(request: number, value: number, index: number): Promise<void>;
  /** Bulk write to the chip's transmit endpoint. */
  write(data: Buffer): Promise<void>;
  close(): Promise<void>;
}

export interface FtdiUsbOptions {
  fps?: number;
  /** Line-break length in ms (default 1; the DMX minimum is 0.088 ms). */
  breakMs?: number;
  /** Open the device. Defaults to the real one via libusb. */
  openTransport?: () => Promise<FtdiTransport>;
}

export class FtdiUsbOutput implements DmxOutput {
  readonly universe = new Uint8Array(UNIVERSE_SIZE);
  readonly stats: DmxStats = {
    frames: 0,
    lateFrames: 0,
    maxGapMs: 0,
    errors: 0,
  };

  #periodMs = 0;
  #breakMs: number;
  #open: () => Promise<FtdiTransport>;
  #transport: FtdiTransport | undefined;
  #running = false;
  #loopDone: Promise<void> = Promise.resolve();

  constructor(opts: FtdiUsbOptions = {}) {
    this.#breakMs = opts.breakMs ?? 1;
    this.#open = opts.openTransport ?? openFtdiUsb;
    this.setFps(opts.fps ?? 30);
  }

  setFps(fps: number): void {
    this.#periodMs = Math.max(1000 / fps, FRAME_TX_MS + this.#breakMs + 4);
  }

  /** Opens the adapter and starts sending. Throws (with advice) if it can't. */
  async start(): Promise<void> {
    if (this.#running) return;
    const transport = await this.#open();
    try {
      await transport.control(REQ_RESET, 0, 0);
      await transport.control(REQ_SET_FLOW_CTRL, 0, 0); // no flow control
      await transport.control(REQ_SET_BAUD, BAUD_DIVISOR_250K, 0);
      await transport.control(REQ_SET_DATA, LINE_8N2, 0);
      await transport.control(REQ_SET_LATENCY, 1, 0);
      await transport.control(REQ_RESET, RESET_PURGE_TX, 0);
    } catch (err) {
      await transport.close().catch(() => {});
      throw err;
    }
    this.#transport = transport;
    this.#running = true;
    this.#loopDone = this.#loop();
  }

  async stop(): Promise<void> {
    this.#running = false;
    await this.#loopDone;
    const transport = this.#transport;
    this.#transport = undefined;
    await transport?.close().catch(() => {});
  }

  async #loop(): Promise<void> {
    let lastStart = performance.now();
    while (this.#running) {
      const start = performance.now();
      if (this.stats.frames > 0) {
        const gap = start - lastStart;
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
        await sleep(250); // don't spin if the adapter was unplugged
      }
      await sleep(Math.max(0, this.#periodMs - (performance.now() - start)));
    }
  }

  async #sendFrame(): Promise<void> {
    const transport = this.#transport;
    if (!transport) return;

    await transport.control(REQ_SET_DATA, LINE_8N2 | BREAK_ON, 0); // line low: the DMX break
    await sleep(this.#breakMs);
    await transport.control(REQ_SET_DATA, LINE_8N2, 0); // line high: mark-after-break

    const frame = Buffer.alloc(UNIVERSE_SIZE + 1); // slot 0 = start code 0x00
    frame.set(this.universe, 1);
    await transport.write(frame);
    // Let the chip's buffer finish clocking out before the next break would cut it off.
    await sleep(FIFO_DRAIN_MS);
  }
}

/** Advice for the errors people actually hit when opening the adapter. */
function explainOpenError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  let advice = "";
  if (/ACCESS|BUSY|-3|-6/i.test(message)) {
    advice =
      " Something else is using the adapter. Quit QLC+ (and any other lighting app), then try again.";
  } else if (/NOT_SUPPORTED|-12/i.test(message)) {
    advice = " The operating system won't let this program open the adapter.";
  }
  return new Error(`Couldn't open the Open DMX over USB: ${message}.${advice}`);
}

/** Open the first FT232R adapter via libusb. Imported lazily so other code never needs it. */
export async function openFtdiUsb(): Promise<FtdiTransport> {
  const { findByIds } = await import("usb");
  const device = findByIds(FTDI_VENDOR_ID, FT232R_PRODUCT_ID);
  if (!device) {
    throw new Error(
      "No FTDI FT232R USB device found. Is the Open DMX plugged in (straight into the laptop, not through a hub)?",
    );
  }
  try {
    device.open();
    const iface = device.interface(0);
    iface.claim();
    const out = iface.endpoints.find((e) => e.address === EP_OUT);
    if (!out || out.direction !== "out") {
      throw new Error("the adapter has no transmit endpoint at 0x02");
    }
    const endpoint = out as unknown as {
      timeout: number;
      transferAsync(data: Buffer): Promise<number>;
    };
    endpoint.timeout = 1000;

    return {
      control: (request, value, index) =>
        new Promise<void>((resolve, reject) => {
          device.controlTransfer(
            0x40,
            request,
            value,
            index,
            Buffer.alloc(0),
            (err) => (err ? reject(err) : resolve()),
          );
        }),
      write: async (data) => {
        await endpoint.transferAsync(data);
      },
      close: async () => {
        try {
          await iface.releaseAsync();
        } finally {
          device.close();
        }
      },
    };
  } catch (err) {
    try {
      device.close();
    } catch {
      // wasn't open
    }
    throw explainOpenError(err);
  }
}
