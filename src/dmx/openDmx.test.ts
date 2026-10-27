import { SerialPortMock } from "serialport";
import { afterEach, describe, expect, it } from "vitest";
import { OpenDmxOutput, toCalloutPath } from "./openDmx.ts";

const PATH = "/dev/cu.usbserial-TEST";

function makeOutput(breakMode: "brk" | "baud") {
  SerialPortMock.binding.createPort(PATH, { echo: false, record: true });
  const calls: string[] = [];
  let port: SerialPortMock | undefined;
  const dmx = new OpenDmxOutput({
    path: PATH,
    fps: 40,
    breakMode,
    createPort: (settings) => {
      port = new SerialPortMock(settings);
      const set = port.set.bind(port);
      const update = port.update.bind(port);
      port.set = ((opts, cb) => (
        calls.push(`set:${JSON.stringify(opts)}`),
        set(opts, cb)
      )) as typeof port.set;
      port.update = ((opts, cb) => (
        calls.push(`baud:${opts.baudRate}`),
        update(opts, cb)
      )) as typeof port.update;
      return port;
    },
  });
  return { dmx, calls, recorded: () => port!.port!.recording };
}

async function waitForFrames(dmx: OpenDmxOutput, n: number) {
  while (dmx.stats.frames < n) await new Promise((r) => setTimeout(r, 5));
}

afterEach(() => SerialPortMock.binding.reset());

describe("OpenDmxOutput", () => {
  it("sends start code + 512 channels per frame, reflecting universe changes", async () => {
    const { dmx, recorded } = makeOutput("brk");
    dmx.universe[0] = 255; // channel 1
    dmx.universe[511] = 7; // channel 512
    await dmx.start();
    await waitForFrames(dmx, 2);
    await dmx.stop();

    const bytes = recorded();
    expect(bytes.length % 513).toBe(0);
    expect(bytes[0]).toBe(0); // DMX start code
    expect(bytes[1]).toBe(255);
    expect(bytes[512]).toBe(7);
    expect(dmx.stats.errors).toBe(0);
  });

  it("brackets every frame with a break when using brk mode", async () => {
    const { dmx, calls } = makeOutput("brk");
    await dmx.start();
    await waitForFrames(dmx, 2);
    await dmx.stop();
    expect(calls.slice(0, 4)).toEqual([
      'set:{"brk":true}',
      'set:{"brk":false}',
      'set:{"brk":true}',
      'set:{"brk":false}',
    ]);
  });

  it("makes the break by dropping the baud rate in baud mode", async () => {
    const { dmx, calls, recorded } = makeOutput("baud");
    await dmx.start();
    await waitForFrames(dmx, 1);
    await dmx.stop();
    expect(calls.slice(0, 2)).toEqual(["baud:76800", "baud:250000"]);
    // The 0x00 "break byte" precedes the 513-byte frame.
    expect(recorded().length % 514).toBe(0);
  });

  it("can be configured for one stop bit and a longer break", async () => {
    let seen: { stopBits?: number } = {};
    const dmx = new OpenDmxOutput({
      path: PATH,
      stopBits: 1,
      breakMs: 5,
      createPort: (settings) => {
        seen = settings;
        SerialPortMock.binding.createPort(PATH, { echo: false, record: true });
        return new SerialPortMock(settings);
      },
    });
    await dmx.start();
    await dmx.stop();
    expect(seen.stopBits).toBe(1);
    expect(dmx.breakMs).toBe(5);
  });

  it("never runs faster than a frame can physically be transmitted", () => {
    const { dmx } = makeOutput("brk");
    dmx.setFps(1000);
    expect(dmx.fps).toBeLessThan(42);
  });
});

describe("toCalloutPath", () => {
  it("swaps macOS tty.* device paths for cu.*", () => {
    expect(toCalloutPath("/dev/tty.usbserial-AB0")).toBe(
      "/dev/cu.usbserial-AB0",
    );
    expect(toCalloutPath("/dev/ttyUSB0")).toBe("/dev/ttyUSB0");
  });
});
