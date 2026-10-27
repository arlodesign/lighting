/**
 * Measure what each value of the lights' strobe channel does, hands-free:
 * the light strobes at one value for ~10 s; you tap any key or pad on the MiniLab (or press
 * the space bar) in time with the flashes; the script works out the flash rate from your
 * taps and saves everything to probe-reports/strobe-sweep-<time>.json.
 *
 *   npm run strobe-sweep                 straight to the Open DMX over USB (QUIT QLC+ first)
 *   npm run strobe-sweep -- --address 11 use a different light
 *   npm run strobe-sweep -- --seconds 12 run each value longer
 *   npm run strobe-sweep -- --values 8,16,32 only these strobe values
 *
 * If a value is too fast to tap along with, just stop tapping: "too fast to tap" is a useful
 * result too. WARNING: the sweep includes fast flashing. Ctrl-C to stop at any time.
 */
import { Input } from "@julusian/midi";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { RIG } from "../src/config.ts";
import { DmxManager, type DmxBackend } from "../src/dmx/dmxManager.ts";
import {
  estimateStrobeHz,
  type StrobeEstimate,
} from "../src/dmx/strobeMeasure.ts";

const { values: args } = parseArgs({
  options: {
    dmx: { type: "string", default: "usb" },
    address: { type: "string", default: "1" },
    seconds: { type: "string", default: "10" },
    values: { type: "string" },
    "no-reveal": { type: "boolean", default: false },
  },
});

const backend = args.dmx as DmxBackend;
if (!["qlc", "usb", "serial", "fake"].includes(backend)) {
  console.error(`Unknown --dmx "${backend}". Use usb, qlc, serial or fake.`);
  process.exit(1);
}
const address = Number(args.address);
const stepSeconds = Math.max(4, Number(args.seconds) || 10);
const STROBE_VALUES = args.values
  ? args.values
      .split(",")
      .map((v) => Math.max(1, Math.min(255, Number(v) || 1)))
  : [1, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 255];
const SETTLE_MS = 2000; // taps in the first 2 s of each value are ignored while you lock on

interface Tap {
  /** ms since this strobe value started */
  t: number;
  source: "minilab" | "space";
}
interface StepResult {
  strobe: number;
  durationMs: number;
  taps: Tap[];
  estimate: StrobeEstimate;
}

const { offsets, neutral } = RIG.profile;
const results: StepResult[] = [];
const startedAt = new Date();

// ── taps: MiniLab note-ons (and the space bar as a backup) ─────────────────────────

let stepStart = 0;
let currentTaps: Tap[] | null = null;
const recordTap = (source: Tap["source"]) => {
  if (currentTaps)
    currentTaps.push({ t: Math.round(performance.now() - stepStart), source });
};

const midiIn = new Input();
const midiName =
  Input.getPortNames().find((n) =>
    /minilab.*midi(?!.*(din|mcu|hui|alv))/i.test(n),
  ) ?? Input.getPortNames().find((n) => /minilab/i.test(n));
if (midiName) {
  midiIn.ignoreTypes(true, true, true);
  midiIn.on("message", (_dt, bytes) => {
    // note-on with velocity > 0, any key or pad. (Pad pressure messages are ignored.)
    if (((bytes[0] ?? 0) & 0xf0) === 0x90 && (bytes[2] ?? 0) > 0)
      recordTap("minilab");
  });
  midiIn.openPortByName(midiName);
}

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", (chunk: Buffer) => {
    const key = chunk.toString();
    if (key === "\u0003")
      void finish(true); // Ctrl-C arrives as a key in raw mode
    else if (key === " ") recordTap("space");
  });
}

// ── DMX ────────────────────────────────────────────────────────────────────────

const dmx = new DmxManager({ backend, fps: RIG.fps });
await dmx.start();
for (let i = 0; i < 40 && !dmx.status.connected && backend !== "fake"; i++)
  await sleep(150);
if (!dmx.status.connected && backend !== "fake") {
  console.error(
    `\nCan't reach the lights (${backend}): ${dmx.status.lastError ?? "not connected"}\n` +
      (backend === "usb"
        ? "Quit QLC+ (it holds the adapter) and check the Open DMX is plugged in.\n"
        : ""),
  );
  await finish(false, 1);
}

const base = address - 1;
function show(strobe: number | null): void {
  const u = dmx.universe;
  u.fill(0);
  if (strobe === null) return; // blackout
  u[base + offsets.master] = 255;
  u[base + offsets.r] = 255;
  u[base + offsets.g] = 255;
  u[base + offsets.b] = 255;
  u[base + offsets.rgb] = neutral.rgb;
  u[base + offsets.strobe] = strobe;
  u[base + offsets.mode] = neutral.mode;
}

// ── the sweep ──────────────────────────────────────────────────────────────────

console.log(
  `\nStrobe sweep on the light at address ${address} (${backend}). ${STROBE_VALUES.length} values, ` +
    `${stepSeconds} s each.\n` +
    (midiName
      ? `Tap any MiniLab key or pad`
      : `No MiniLab found: tap the SPACE BAR`) +
    ` in time with each flash. The first ${SETTLE_MS / 1000} s of each value are just for ` +
    `getting in step.\nIf it's too fast to tap, stop tapping. WARNING: includes fast flashing. Ctrl-C to stop.\n`,
);

for (const strobe of STROBE_VALUES) {
  show(null);
  console.log(`Next: strobe ${strobe}. Get ready…`);
  await sleep(2500);

  currentTaps = [];
  stepStart = performance.now();
  const deadline = stepStart + stepSeconds * 1000;
  while (performance.now() < deadline) {
    show(strobe); // re-assert every tick: the output can be swapped underneath us
    process.stdout.write(
      `\r  strobe ${String(strobe).padStart(3)}  ${((deadline - performance.now()) / 1000).toFixed(0).padStart(2)}s left  taps: ${currentTaps.length}   `,
    );
    await sleep(100);
  }
  const taps = currentTaps;
  currentTaps = null;
  show(null);

  const estimate = estimateStrobeHz(
    taps.map((t) => t.t),
    SETTLE_MS,
  );
  results.push({ strobe, durationMs: stepSeconds * 1000, taps, estimate });
  const summary =
    estimate.hz === null
      ? "too few taps to measure (too fast or too slow to tap?)"
      : `≈ ${estimate.hz} flashes/s${estimate.unreliable ? "  (uneven tapping: treat as rough)" : ""}`;
  console.log(
    `\r  strobe ${String(strobe).padStart(3)}: ${summary}                    `,
  );
}

await finish(false);

// ── wrap up ────────────────────────────────────────────────────────────────────

async function finish(interrupted: boolean, code = 0): Promise<never> {
  currentTaps = null;
  try {
    dmx.universe.fill(0);
    await sleep(250); // let a blackout frame go out
    await dmx.stop();
  } catch {
    // best effort
  }
  try {
    midiIn.closePort();
  } catch {
    // never opened
  }
  if (process.stdin.isTTY) process.stdin.setRawMode(false);

  if (results.length > 0) {
    const dir = path.join(import.meta.dirname, "..", "probe-reports");
    await mkdir(dir, { recursive: true });
    const stamp = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const file = path.join(dir, `strobe-sweep-${stamp}.json`);
    await writeFile(
      file,
      JSON.stringify(
        {
          kind: "strobe-sweep",
          version: 1,
          startedAt: startedAt.toISOString(),
          interrupted,
          backend,
          address,
          stepSeconds,
          settleMs: SETTLE_MS,
          channels: { offsets, neutral },
          currentGuess: RIG.profile.strobeRange,
          machine: {
            hostname: os.hostname(),
            platform: os.platform(),
            node: process.version,
          },
          input: midiName ?? "space bar",
          steps: results,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`\n${interrupted ? "Stopped early. " : ""}Saved: ${file}`);
    console.log("Strobe value → flashes per second:");
    for (const r of results) {
      console.log(
        `  ${String(r.strobe).padStart(3)}  ${r.estimate.hz === null ? "(too few taps)" : `${r.estimate.hz} /s`}`,
      );
    }
    if (process.platform === "darwin" && !args["no-reveal"]) {
      execFile("open", ["-R", file]); // show it in Finder
    }
    console.log("\nUpload that .json file here.");
  }
  process.exit(code);
}
