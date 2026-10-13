import { setTimeout as sleep } from "node:timers/promises";
import { SerialPort } from "serialport";
import {
  findOpenDmxPorts,
  OpenDmxOutput,
  type BreakMode,
} from "../src/dmx/openDmx.ts";
import { ask, c, choose, heading, pause, yesNo } from "./prompt.ts";

/** Channel offsets within one fixture in 7-channel mode (from the fixture's manual). */
const CH = { master: 0, r: 1, g: 2, b: 3, rgb: 4, strobe: 5, mode: 6 } as const;
const LABELS = ["L1", "L2", "L3", "L4", "R1", "R2", "R3", "R4"] as const;

const ADDRESS_SCHEMES = {
  /** What the 2024/2025 versions of this repo used. */
  "spaced-10": [1, 11, 21, 31, 41, 51, 61, 71],
  /** Tightly packed 7-channel fixtures. */
  "packed-7": [1, 8, 15, 22, 29, 36, 43, 50],
} as const;

interface ChannelExploration {
  channel: keyof typeof CH;
  observations: { value: number; seen: string }[];
}

interface FlickerResult {
  fps: number;
  scenario: "foreground" | "app-switch";
  rating: string;
  frames: number;
  lateFrames: number;
  maxGapMs: number;
  errors: number;
}

export interface DmxSection {
  serialPorts: {
    path: string;
    vendorId?: string;
    productId?: string;
    manufacturer?: string;
  }[];
  chosenPort?: string;
  breakMode?: BreakMode;
  firstLight: boolean;
  colorOrderOk?: boolean;
  /** Values for channels 5–7 that leave a fixture showing plain steady RGB. */
  neutral?: { rgb: number; strobe: number; mode: number };
  exploration: ChannelExploration[];
  addressScheme?: string;
  /** DMX start address → what the user saw ("L1", "none", "many", …). */
  addressMap: Record<number, string>;
  flicker: FlickerResult[];
  errors: string[];
}

function fixture(
  dmx: OpenDmxOutput,
  start: number,
  values: Partial<Record<keyof typeof CH, number>>,
) {
  for (const [key, v] of Object.entries(values)) {
    dmx.universe[start - 1 + CH[key as keyof typeof CH]] = v;
  }
}

async function tryFirstLight(dmx: OpenDmxOutput): Promise<boolean> {
  dmx.universe.fill(0);
  fixture(dmx, 1, { master: 255, r: 255 });
  await sleep(600);
  return yesNo(
    `  Sending ${c.bold("red")} to the light at DMX address 1. Did ANY light turn red?`,
    "y",
  );
}

async function exploreChannel(
  dmx: OpenDmxOutput,
  channel: "rgb" | "strobe" | "mode",
  neutral: { rgb: number; strobe: number; mode: number },
): Promise<ChannelExploration> {
  console.log(
    `\n${c.bold(`Exploring channel ${CH[channel] + 1} ("${channel}")`)} on the light at address 1, ` +
      "starting from a steady dim blue.\n" +
      c.dim(
        "  For each value, describe what the light does (Enter = looks the same / steady blue).",
      ),
  );
  const observations: ChannelExploration["observations"] = [];
  for (const value of [0, 1, 32, 64, 128, 192, 255]) {
    dmx.universe.fill(0);
    fixture(dmx, 1, { master: 255, b: 120, ...neutral, [channel]: value });
    await sleep(400);
    const seen = await ask(`  ${channel} = ${String(value).padStart(3)} →`);
    observations.push({ value, seen: seen || "same" });
  }
  return { channel, observations };
}

async function addressWalk(
  dmx: OpenDmxOutput,
  addresses: readonly number[],
  neutral: DmxSection["neutral"],
) {
  const map: Record<number, string> = {};
  console.log(
    `\n${c.bold("Address walk.")} One address at a time lights up WHITE. Say which light it is, ` +
      `using house-left → house-right order (${LABELS.join(" ")}), as the audience sees them.\n` +
      c.dim(
        "  Type the label (e.g. L1), 'none' if nothing lit, or 'many' if several lit.",
      ),
  );
  for (const address of addresses) {
    dmx.universe.fill(0);
    fixture(dmx, address, { master: 255, r: 255, g: 255, b: 255, ...neutral });
    await sleep(400);
    map[address] =
      (await ask(`  Address ${String(address).padStart(3)} →`)).toUpperCase() ||
      "NONE";
  }
  return map;
}

/** A slow, smooth rainbow + breathe: smooth gradients are where flicker and stutter show up. */
function startShimmer(
  dmx: OpenDmxOutput,
  addresses: readonly number[],
  neutral: DmxSection["neutral"],
) {
  const t0 = performance.now();
  const timer = setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    addresses.forEach((address, i) => {
      const hue = (t * 0.1 + i / addresses.length) % 1;
      const level = 0.55 + 0.45 * Math.sin(t * 1.2);
      const [r, g, b] = hueToRgb(hue);
      fixture(dmx, address, {
        master: Math.round(255 * level),
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
        ...neutral,
      });
    });
  }, 1000 / 60);
  return () => clearInterval(timer);
}

function hueToRgb(h: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return 1 - Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

async function flickerTest(
  dmx: OpenDmxOutput,
  addresses: readonly number[],
  neutral: DmxSection["neutral"],
): Promise<FlickerResult[]> {
  console.log(
    `\n${c.bold("Flicker test.")} All lights do a slow rainbow fade at different refresh rates. ` +
      "Watch for flicker (brightness blips) or stutter (jumpy, not smooth).",
  );
  const results: FlickerResult[] = [];
  const stopShimmer = startShimmer(dmx, addresses, neutral);
  const runOne = async (fps: number, scenario: FlickerResult["scenario"]) => {
    dmx.setFps(fps);
    dmx.resetStats();
    if (scenario === "foreground") {
      console.log(`\n  ${c.bold(`${fps} fps`)} — watch for ~8 seconds…`);
      await sleep(8000);
    } else {
      console.log(
        `\n  ${c.bold(`${fps} fps, app-switch test`)}: press Cmd-Tab to another app (e.g. Finder), ` +
          "stay there ~10 seconds while watching the lights, then come back here.",
      );
      await pause("  Press Enter once you're back…");
    }
    const { frames, lateFrames, maxGapMs, errors } = dmx.stats;
    const rating = await choose(
      "  How did it look? smooth / flicker / stutter",
      ["smooth", "flicker", "stutter"] as const,
      "smooth",
    );
    results.push({
      fps,
      scenario,
      rating,
      frames,
      lateFrames,
      maxGapMs: Math.round(maxGapMs),
      errors,
    });
    console.log(
      c.dim(
        `    frames=${frames} late=${lateFrames} worstGap=${Math.round(maxGapMs)}ms errors=${errors}`,
      ),
    );
  };
  try {
    for (const fps of [40, 30, 20, 15]) await runOne(fps, "foreground");
    await runOne(30, "app-switch");
  } finally {
    stopShimmer();
  }
  return results;
}

export async function runDmxSection(): Promise<DmxSection> {
  heading("Open DMX + lights");
  const section: DmxSection = {
    serialPorts: [],
    firstLight: false,
    exploration: [],
    addressMap: {},
    flicker: [],
    errors: [],
  };

  const all = await SerialPort.list();
  section.serialPorts = all.map(
    ({ path, vendorId, productId, manufacturer }) => ({
      path,
      ...(vendorId && { vendorId }),
      ...(productId && { productId }),
      ...(manufacturer && { manufacturer }),
    }),
  );
  const candidates = await findOpenDmxPorts();
  console.log(`Serial devices: ${all.map((p) => p.path).join(", ") || "none"}`);
  if (candidates.length === 0) {
    console.log(
      c.red("No FTDI device found.") +
        " Check the Open DMX is plugged in. See probe/README.md → 'Open DMX not found'.",
    );
    return section;
  }
  const path =
    candidates.length === 1
      ? candidates[0]!
      : await choose(
          "Several FTDI devices — which one?",
          candidates,
          candidates[0],
        );
  section.chosenPort = path;
  console.log(`Using ${c.bold(path)}`);
  console.log(
    c.dim(
      "Make sure the lights are powered, cabled, and set to 7-channel DMX mode.",
    ),
  );
  await pause();

  // Try the cleaner break method first; fall back to the baud-rate trick.
  let dmx: OpenDmxOutput | undefined;
  for (const breakMode of ["brk", "baud"] as const) {
    const out = new OpenDmxOutput({ path, fps: 30, breakMode });
    try {
      await out.start();
      if (await tryFirstLight(out)) {
        dmx = out;
        section.breakMode = breakMode;
        break;
      }
      await out.stop();
    } catch (err) {
      const msg = `${breakMode}: ${err instanceof Error ? err.message : String(err)}`;
      section.errors.push(msg);
      console.log(c.red(`  Error (${msg})`));
      await out.stop().catch(() => {});
    }
    if (breakMode === "brk")
      console.log(c.dim("  Trying the alternate break method…"));
  }
  if (!dmx) {
    console.log(
      c.red(
        "Couldn't light anything. The report will still help diagnose why.",
      ),
    );
    return section;
  }
  section.firstLight = true;

  try {
    // Colour order: confirms R/G/B channel offsets.
    console.log(
      `\n${c.bold("Colour check")} on the same light: red → green → blue → white.`,
    );
    for (const [name, rgb] of [
      ["red", [255, 0, 0]],
      ["green", [0, 255, 0]],
      ["blue", [0, 0, 255]],
      ["white", [255, 255, 255]],
    ] as const) {
      fixture(dmx, 1, { master: 255, r: rgb[0], g: rgb[1], b: rgb[2] });
      console.log(`  ${name}`);
      await sleep(1200);
    }
    section.colorOrderOk = await yesNo(
      "  Did it go red, green, blue, white in that order?",
      "y",
    );
    if (!section.colorOrderOk) {
      section.errors.push(
        `colour order: ${await ask("  What did you see instead?")}`,
      );
    }

    // The manual's channels 5–7 ("RGB", strobe speed, mode) are under-documented.
    let neutral = { rgb: 0, strobe: 0, mode: 0 };
    for (const ch of ["strobe", "mode", "rgb"] as const) {
      section.exploration.push(await exploreChannel(dmx, ch, neutral));
    }
    const steadyAtZero = await yesNo(
      "\nWith strobe, mode and rgb all at 0, was the light plain steady blue (no flashing, no auto-program)?",
      "y",
    );
    if (!steadyAtZero) {
      const parse = (s: string, d: number) =>
        Number.isFinite(Number(s)) && s !== "" ? Number(s) : d;
      neutral = {
        strobe: parse(
          await ask("  Which strobe value gave steady light? (e.g. 1)"),
          0,
        ),
        mode: parse(
          await ask("  Which mode value gave plain manual colour? (e.g. 1)"),
          0,
        ),
        rgb: parse(await ask("  Which rgb value changed nothing? (e.g. 0)"), 0),
      };
    }
    section.neutral = neutral;

    // Addressing.
    const scheme = await choose(
      `\nWhich addressing do the lights use? spaced-10 = ${ADDRESS_SCHEMES["spaced-10"].join(",")} (the old setup), ` +
        `packed-7 = ${ADDRESS_SCHEMES["packed-7"].join(",")}, custom = type your own`,
      ["spaced-10", "packed-7", "custom"] as const,
      "spaced-10",
    );
    let addresses: number[] = [
      ...(scheme === "custom" ? [] : ADDRESS_SCHEMES[scheme]),
    ];
    if (scheme === "custom") {
      addresses = (await ask("  Start addresses, comma separated:"))
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => n >= 1 && n <= 506);
    }
    section.addressScheme = `${scheme}:${addresses.join(",")}`;
    section.addressMap = await addressWalk(dmx, addresses, neutral);

    const found = Object.entries(section.addressMap)
      .filter(([, label]) => /^[LR][1-4]$/.test(label))
      .map(([address]) => Number(address));
    if (found.length > 0)
      section.flicker = await flickerTest(dmx, found, neutral);
  } finally {
    dmx.universe.fill(0);
    await sleep(200); // let a blackout frame go out before closing
    await dmx.stop();
  }
  return section;
}
