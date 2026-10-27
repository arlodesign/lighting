import WebSocket from "ws";
import { UNIVERSE_SIZE, type DmxOutput, type DmxStats } from "./types.ts";

export const QLC_DEFAULT_URL = "ws://127.0.0.1:9999/qlcplusWS";

/** The slice of a WebSocket this class uses, so tests can substitute their own. */
export interface QlcSocket {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(data: string): void;
  close(): void;
  on(event: "open" | "close", listener: () => void): unknown;
  on(event: "error", listener: (err: Error) => void): unknown;
}

export interface QlcOutputOptions {
  url?: string;
  fps?: number;
  /** How many channels (from channel 1) to keep in sync. Default 128. */
  channels?: number;
  createSocket?: (url: string) => QlcSocket;
}

const OPEN = 1;
const MIN_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 5000;
/** Don't queue more than this many bytes of unsent updates: skip a tick instead. */
const MAX_BUFFERED_BYTES = 64 * 1024;

/**
 * Sends the universe to QLC+ over its WebSocket, one `CH|<address>|<value>` message per
 * changed channel (the same protocol the 2024 version of this project used). QLC+ owns the
 * Open DMX adapter and does the DMX timing; this just tells it what values to hold.
 *
 * Only changes are sent, so a static look costs nothing. If QLC+ isn't running or restarts,
 * this keeps retrying and, once connected, re-sends every channel so QLC+ catches up.
 */
export class QlcOutput implements DmxOutput {
  readonly universe = new Uint8Array(UNIVERSE_SIZE);
  readonly stats: DmxStats = {
    frames: 0,
    lateFrames: 0,
    maxGapMs: 0,
    errors: 0,
  };
  readonly url: string;

  #fps: number;
  #channels: number;
  #createSocket: (url: string) => QlcSocket;
  #socket: QlcSocket | undefined;
  /** What QLC+ currently holds for each channel; -1 = unknown, so it gets (re)sent. */
  #sent: Int16Array;
  #tick: NodeJS.Timeout | undefined;
  #retry: NodeJS.Timeout | undefined;
  #backoff = MIN_BACKOFF_MS;
  #running = false;
  #lastTick = 0;

  constructor(opts: QlcOutputOptions = {}) {
    this.url = opts.url ?? QLC_DEFAULT_URL;
    this.#fps = opts.fps ?? 30;
    this.#channels = Math.min(opts.channels ?? 128, UNIVERSE_SIZE);
    this.#createSocket =
      opts.createSocket ??
      ((url) => new WebSocket(url) as unknown as QlcSocket);
    this.#sent = new Int16Array(this.#channels).fill(-1);
  }

  get connected(): boolean {
    return this.#socket?.readyState === OPEN;
  }

  async start(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    this.#connect();
    this.#schedule();
  }

  async stop(): Promise<void> {
    this.#running = false;
    clearInterval(this.#tick);
    clearTimeout(this.#retry);
    const socket = this.#socket;
    this.#socket = undefined;
    try {
      socket?.close();
    } catch {
      // already closed
    }
  }

  setFps(fps: number): void {
    this.#fps = fps;
    if (this.#running) this.#schedule();
  }

  #schedule(): void {
    clearInterval(this.#tick);
    this.#tick = setInterval(() => this.#flush(), 1000 / this.#fps);
  }

  #connect(): void {
    if (!this.#running) return;
    let socket: QlcSocket;
    try {
      socket = this.#createSocket(this.url);
    } catch (err) {
      this.#fail(err);
      return;
    }
    this.#socket = socket;
    socket.on("open", () => {
      this.#backoff = MIN_BACKOFF_MS;
      this.#sent.fill(-1); // QLC+ may have restarted: send everything again
      this.stats.lastError = undefined;
    });
    socket.on("error", (err) => this.#fail(err));
    socket.on("close", () => {
      if (this.#socket !== socket) return; // an old socket closing after a replacement
      this.#socket = undefined;
      this.#scheduleReconnect();
    });
  }

  #fail(err: unknown): void {
    this.stats.errors++;
    this.stats.lastError = err instanceof Error ? err.message : String(err);
  }

  #scheduleReconnect(): void {
    if (!this.#running) return;
    clearTimeout(this.#retry);
    this.#retry = setTimeout(() => this.#connect(), this.#backoff);
    this.#backoff = Math.min(MAX_BACKOFF_MS, this.#backoff * 2);
  }

  #flush(): void {
    const now = performance.now();
    if (this.#lastTick > 0) {
      const gap = now - this.#lastTick;
      this.stats.maxGapMs = Math.max(this.stats.maxGapMs, gap);
      if (gap > (1000 / this.#fps) * 1.5) this.stats.lateFrames++;
    }
    this.#lastTick = now;

    const socket = this.#socket;
    if (!socket || socket.readyState !== OPEN) return;
    if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      this.stats.lateFrames++; // QLC+ is behind; send the newest values next tick instead
      return;
    }
    try {
      for (let i = 0; i < this.#channels; i++) {
        const value = this.universe[i]!;
        if (value === this.#sent[i]) continue;
        socket.send(`CH|${i + 1}|${value}`);
        this.#sent[i] = value;
      }
      this.stats.frames++;
    } catch (err) {
      this.#fail(err);
    }
  }
}
