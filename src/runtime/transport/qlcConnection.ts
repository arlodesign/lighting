"use client";

// Minimal client-side QLC+ WebSocket connection manager for localhost usage.
// - Auto-connects on creation
// - Exponential backoff reconnect
// - One message per channel: `CH|<address>|<value>`
// - Drops sends when disconnected (no buffering)

export type QlcStatus = "connecting" | "connected" | "disconnected";

export type QlcConnectionEvent = {
  status: QlcStatus;
};

export type QlcListener = (evt: QlcConnectionEvent) => void;

export class QlcConnection {
  private url: string;
  private ws: WebSocket | null = null;
  private _status: QlcStatus = "connecting";
  private listeners = new Set<QlcListener>();
  private backoffMs = 500;
  private readonly maxBackoffMs = 5000;
  private retryTimer: number | null = null;

  constructor(url = "ws://127.0.0.1:9999/qlcplusWS") {
    this.url = url;
    // Eagerly connect on creation in this single-operator localhost setup
    if (typeof window !== "undefined") {
      this.connect();
    }
  }

  get status(): QlcStatus {
    return this._status;
  }

  subscribe(fn: QlcListener): () => void {
    this.listeners.add(fn);
    // Immediately emit current state for new subscribers
    try {
      fn({ status: this._status });
    } catch {}
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    const evt = { status: this._status } as const;
    for (const fn of this.listeners) {
      try {
        fn(evt);
      } catch {}
    }
  }

  private setStatus(s: QlcStatus) {
    if (this._status !== s) {
      this._status = s;
      this.emit();
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.info(`[qlc] ${s}`);
      }
    }
  }

  private clearRetryTimer() {
    if (this.retryTimer != null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private scheduleReconnect() {
    this.clearRetryTimer();
    const wait = Math.min(this.backoffMs, this.maxBackoffMs);
    this.retryTimer = window.setTimeout(() => {
      this.connect();
    }, wait);
    this.backoffMs = Math.min(this.maxBackoffMs, Math.floor(this.backoffMs * 2));
  }

  retryNow() {
    this.clearRetryTimer();
    this.backoffMs = 500;
    this.connect(true);
  }

  private connect(force = false) {
    if (typeof window === "undefined") return;
    if (!force && (this.ws && this.ws.readyState === WebSocket.OPEN)) return;
    if (!force && (this.ws && this.ws.readyState === WebSocket.CONNECTING)) return;

    try {
      this.setStatus("connecting");
      this.ws?.close();
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.backoffMs = 500;
        this.setStatus("connected");
      };
      this.ws.onclose = () => {
        this.setStatus("disconnected");
        this.scheduleReconnect();
      };
      this.ws.onerror = () => {
        this.setStatus("disconnected");
        this.scheduleReconnect();
      };
      // We don't need to read messages for the basic DMX use case
      this.ws.onmessage = () => {};
    } catch (e) {
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  sendChannel(address: number, value: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return; // drop
    // QLC+ expects integers 0..255 and 1-based addresses
    const v = Math.max(0, Math.min(255, Math.round(value)));
    this.ws.send(`CH|${address}|${v}`);
  }
}

export const qlcConnection = new QlcConnection();

