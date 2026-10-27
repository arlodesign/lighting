/**
 * Quick hardware test, no MiniLab or display needed: lights ONE fixture red for a few
 * seconds through the chosen DMX backend and prints what happened.
 *
 *   npm run dmx-test                       through QLC+ (it must be running, web access on)
 *   npm run dmx-test -- --dmx usb          straight to the Open DMX over USB (QUIT QLC+ first)
 *   npm run dmx-test -- --dmx usb --address 11 --seconds 15
 *
 * Watch the display on the back of the light: blinking = no DMX; steady = DMX arriving.
 */
import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { RIG } from "../src/config.ts";
import { DmxManager, type DmxBackend } from "../src/dmx/dmxManager.ts";

const { values } = parseArgs({
  options: {
    dmx: { type: "string", default: "qlc" },
    address: { type: "string", default: "1" },
    seconds: { type: "string", default: "10" },
  },
});

const backend = values.dmx as DmxBackend;
if (!["qlc", "usb", "serial", "fake"].includes(backend)) {
  console.error(`Unknown --dmx "${backend}". Use qlc, usb, serial or fake.`);
  process.exit(1);
}
const address = Number(values.address);
const seconds = Number(values.seconds);
const { offsets, neutral } = RIG.profile;

const dmx = new DmxManager({ backend, fps: RIG.fps });
await dmx.start();
console.log(
  `Backend: ${backend}. Lighting the fixture at address ${address} RED for ${seconds}s.`,
);
console.log("Watch the light and the display on its back. Ctrl-C to stop.\n");

const base = address - 1;
const colors = [
  { name: "red", r: 255, g: 0, b: 0 },
  { name: "green", r: 0, g: 255, b: 0 },
  { name: "blue", r: 0, g: 0, b: 255 },
];
const t0 = Date.now();
let last = "";
while (Date.now() - t0 < seconds * 1000) {
  const c = colors[Math.floor((Date.now() - t0) / 2000) % colors.length]!;
  const u = dmx.universe;
  u.fill(0);
  u[base + offsets.master] = 255;
  u[base + offsets.r] = c.r;
  u[base + offsets.g] = c.g;
  u[base + offsets.b] = c.b;
  u[base + offsets.rgb] = neutral.rgb;
  u[base + offsets.strobe] = neutral.strobe;
  u[base + offsets.mode] = neutral.mode;

  const s = dmx.status;
  const line = `${c.name.padEnd(5)} | ${s.connected ? "connected" : "NOT connected"} | errors ${s.errors}${s.lastError ? ` | ${s.lastError}` : ""}`;
  if (line !== last) console.log(line);
  last = line;
  await sleep(100);
}
dmx.universe.fill(0);
await sleep(300);
await dmx.stop();
const final = dmx.status;
console.log(
  `\nDone. ${final.connected ? "Connected" : "NOT connected"}, ${final.errors} errors.`,
);
process.exit(0);
