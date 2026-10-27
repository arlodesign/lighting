/**
 * Quick hardware test, no MiniLab or display needed: lights ONE fixture red for a few
 * seconds through the chosen DMX backend and prints what happened.
 *
 *   npm run dmx-test                       straight to the Open DMX over USB (QUIT QLC+ first)
 *   npm run dmx-test -- --walk             light each light in turn, house-left to house-right
 *   npm run dmx-test -- --address 11 --seconds 15
 *   npm run dmx-test -- --dmx qlc          through QLC+ instead (it must be running, web access on)
 *   npm run dmx-test -- --strobe 0 --mode 0 --rgb 0   try other values on the extra channels
 *
 * Watch the display on the back of the light: blinking = no DMX; steady = DMX arriving.
 */
import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { RIG } from "../src/config.ts";
import { DmxManager, type DmxBackend } from "../src/dmx/dmxManager.ts";

const { values } = parseArgs({
  options: {
    dmx: { type: "string", default: "usb" },
    address: { type: "string", default: "1" },
    seconds: { type: "string", default: "10" },
    walk: { type: "boolean", default: false },
    // Override the "extra" channels (5–7) to experiment: which values leave the light steady?
    rgb: { type: "string" },
    strobe: { type: "string" },
    mode: { type: "string" },
  },
});

const backend = values.dmx as DmxBackend;
if (!["qlc", "usb", "serial", "fake"].includes(backend)) {
  console.error(`Unknown --dmx "${backend}". Use qlc, usb, serial or fake.`);
  process.exit(1);
}
const address = Number(values.address);
const seconds = Number(values.seconds);
const { offsets, neutral: configured } = RIG.profile;
const num = (v: string | undefined, fallback: number) =>
  v === undefined ? fallback : Math.max(0, Math.min(255, Number(v) || 0));
const neutral = {
  rgb: num(values.rgb, configured.rgb),
  strobe: num(values.strobe, configured.strobe),
  mode: num(values.mode, configured.mode),
};

const dmx = new DmxManager({ backend, fps: RIG.fps });
await dmx.start();

if (values.walk) {
  // Light each fixture white for 2.5 s in the order the app assumes (L1…L4 then R1…R4,
  // house-left to house-right as the audience sees them) so the real order can be checked.
  const o = offsets;
  const n = neutral;
  console.log(
    `Backend: ${backend}. Lighting each light white in turn. Stand where the audience would,\n` +
      "and check each one is where it says (L1 = far house-left … R4 = far house-right).\n",
  );
  for (const [id, addr] of Object.entries(RIG.addresses)) {
    dmx.universe.fill(0);
    const b = addr - 1;
    dmx.universe[b + o.master] = 255;
    dmx.universe[b + o.r] = 255;
    dmx.universe[b + o.g] = 255;
    dmx.universe[b + o.b] = 255;
    dmx.universe[b + o.rgb] = n.rgb;
    dmx.universe[b + o.strobe] = n.strobe;
    dmx.universe[b + o.mode] = n.mode;
    console.log(
      `  ${id}  (address ${addr})  ${dmx.status.connected || backend === "fake" ? "" : "NOT CONNECTED"}`,
    );
    await sleep(2500);
  }
  dmx.universe.fill(0);
  await sleep(300);
  await dmx.stop();
  console.log("\nDone. If any light was in the wrong place, tell me which.");
  process.exit(0);
}
console.log(
  `Backend: ${backend}. Lighting the fixture at address ${address} for ${seconds}s ` +
    `(extra channels: rgb=${neutral.rgb} strobe=${neutral.strobe} mode=${neutral.mode}).`,
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
