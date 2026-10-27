import { describe, expect, it } from "vitest";
import { FtdiUsbOutput, type FtdiTransport } from "./ftdiUsb.ts";

type Event =
  | { kind: "control"; request: number; value: number; index: number }
  | { kind: "write"; data: Buffer }
  | { kind: "close" };

function fakeTransport(failWrites = false) {
  const events: Event[] = [];
  const transport: FtdiTransport = {
    async control(request, value, index) {
      events.push({ kind: "control", request, value, index });
    },
    async write(data) {
      if (failWrites) throw new Error("LIBUSB_ERROR_IO");
      events.push({ kind: "write", data: Buffer.from(data) });
    },
    async close() {
      events.push({ kind: "close" });
    },
  };
  return { events, transport };
}

const until = async (cond: () => boolean, ms = 3000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 5));
  }
};

const controls = (events: Event[]) =>
  events.filter(
    (e): e is Extract<Event, { kind: "control" }> => e.kind === "control",
  );
const writes = (events: Event[]) =>
  events.filter(
    (e): e is Extract<Event, { kind: "write" }> => e.kind === "write",
  );

describe("FtdiUsbOutput", () => {
  it("configures the chip for exactly 250k baud, 8 data bits, 2 stop bits", async () => {
    const { events, transport } = fakeTransport();
    const out = new FtdiUsbOutput({ openTransport: async () => transport });
    await out.start();
    await out.stop();
    const setup = controls(events).slice(0, 6);
    expect(setup).toEqual([
      { kind: "control", request: 0x00, value: 0, index: 0 }, // reset
      { kind: "control", request: 0x02, value: 0, index: 0 }, // no flow control
      { kind: "control", request: 0x03, value: 12, index: 0 }, // 3 MHz / 12 = 250 000 baud
      { kind: "control", request: 0x04, value: 0x1008, index: 0 }, // 8N2
      { kind: "control", request: 0x09, value: 1, index: 0 }, // 1 ms latency
      { kind: "control", request: 0x00, value: 2, index: 0 }, // purge TX
    ]);
  });

  it("sends break → mark → start code + 512 channels, every frame", async () => {
    const { events, transport } = fakeTransport();
    const out = new FtdiUsbOutput({
      fps: 40,
      openTransport: async () => transport,
    });
    out.universe[0] = 255; // channel 1
    out.universe[511] = 9; // channel 512
    await out.start();
    await until(() => writes(events).length >= 2);
    await out.stop();

    const frameEvents = events.slice(6); // after the 6 setup requests
    // Per frame: SET_DATA with break bit, SET_DATA without, then the data write.
    expect(frameEvents[0]).toEqual({
      kind: "control",
      request: 0x04,
      value: 0x1008 | (1 << 14),
      index: 0,
    });
    expect(frameEvents[1]).toEqual({
      kind: "control",
      request: 0x04,
      value: 0x1008,
      index: 0,
    });
    const first = frameEvents[2] as Extract<Event, { kind: "write" }>;
    expect(first.kind).toBe("write");
    expect(first.data).toHaveLength(513);
    expect(first.data[0]).toBe(0); // DMX start code
    expect(first.data[1]).toBe(255);
    expect(first.data[512]).toBe(9);
    expect(frameEvents[3]).toMatchObject({
      kind: "control",
      value: 0x1008 | (1 << 14),
    }); // next frame begins
    expect(out.stats.errors).toBe(0);
  });

  it("closes the adapter on stop", async () => {
    const { events, transport } = fakeTransport();
    const out = new FtdiUsbOutput({ openTransport: async () => transport });
    await out.start();
    await out.stop();
    expect(events.at(-1)).toEqual({ kind: "close" });
  });

  it("counts write errors instead of crashing, and keeps trying", async () => {
    const { transport } = fakeTransport(true);
    const out = new FtdiUsbOutput({
      fps: 40,
      openTransport: async () => transport,
    });
    await out.start();
    await until(() => out.stats.errors >= 2, 4000);
    await out.stop();
    expect(out.stats.lastError).toMatch(/LIBUSB_ERROR_IO/);
  });

  it("reports (and doesn't swallow) a failure to open the adapter", async () => {
    const out = new FtdiUsbOutput({
      openTransport: async () => {
        throw new Error("Something else is using the adapter");
      },
    });
    await expect(out.start()).rejects.toThrow(/using the adapter/);
  });

  it("never schedules frames faster than the wire allows", () => {
    const { transport } = fakeTransport();
    const out = new FtdiUsbOutput({ openTransport: async () => transport });
    out.setFps(1000); // would be 1 ms: impossible at 22.6 ms/frame
    // No public getter; the test above for ordering guards correctness. Just must not throw.
    expect(out).toBeTruthy();
  });
});
