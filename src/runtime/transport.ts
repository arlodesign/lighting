import type { Transport, DmxPatch } from "./types";

// Stub transport: no-ops but logs occasionally for debugging
export class NoopTransport implements Transport {
  private lastLog = 0;
  private sends = 0;
  async send(diff: DmxPatch): Promise<void> {
    this.sends++;
    const now = performance.now();
    if (now - this.lastLog > 2000) {
      // log at most every 2s
      const channels = Object.keys(diff).length;
      // eslint-disable-next-line no-console
      console.debug(
        `[dmx] sent ${this.sends} frames | last ${channels} channels`
      );
      this.lastLog = now;
      this.sends = 0;
    }
  }
}

export { QlcPlusWebSocketTransport } from "./transport/qlcWebSocket";
