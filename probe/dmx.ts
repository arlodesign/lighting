import { setTimeout as sleep } from "node:timers/promises";
import { SerialPort } from "serialport";
import { collectDriverInfo } from "../src/dmx/diagnostics.ts";
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
  /** One entry per break method tried: what happened at each stage of the first-light hunt. */
  firstLightAttempts: ({ breakMode: BreakMode } & FirstLightResult)[];
  /** What the OS reports about the adapter (driver, device nodes). */
  driver?: Record<string, string>;
  /** How fast bytes really leave the adapter at several settings (no lights needed). */
  wireRate?: WireRateResult[];
  /** Which signal variant, if any, made a light react. */
  variantSweep?: VariantSweepResult;
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

/**
 * Values for the "extra" channels (RGB, strobe, mode) that keep a fixture in plain steady
 * colour. All 0: the 2024 show left them at 0 and the lights held steady. (Setting strobe and
 * mode to 1 made them flash in spurts, even though the paper manual lists them as 1–255.)
 */
const SAFE = { rgb: 0, strobe: 0, mode: 0 } as const;

/**
 * Most fixtures with a small address display blink it while NO DMX signal arrives and go
 * steady once valid DMX does. That makes the display a better "is DMX arriving?" detector
 * than the lights themselves: it works even when the address or mode is wrong.
 */
const DISPLAY_TELL =
  "Tip: if the lights show a blinking address (like A001), that blinking means they are NOT " +
  "receiving DMX. When DMX arrives the display should go steady.";

export interface FirstLightResult {
  lit: boolean;
  /** "address-1": normal red test worked. */
  stage?: "address-1";
  /** Did the all-channels-255 blast make any light do anything? (signal reaches the fixtures) */
  blastResponse?: boolean;
  /** Address windows that were showing when the user said a light turned red. */
  scanCandidates?: number[];
}

/**
 * Find out why (or whether) a light responds. Three stages, each narrowing the cause:
 *  1. Red at address 1 with valid strobe/mode → works → done.
 *  2. Every channel at 255 → if ANY light reacts, DMX is arriving and the problem is the
 *     fixture's address/mode; if nothing reacts, it's wiring, the adapter, or the break.
 *  3. Sweep a red window across every address until the user shouts → finds the address.
 */
async function findFirstLight(dmx: OpenDmxOutput): Promise<FirstLightResult> {
  dmx.universe.fill(0);
  fixture(dmx, 1, { master: 255, r: 255, ...SAFE });
  await sleep(700);
  console.log(c.dim(`  ${DISPLAY_TELL}`));
  if (
    await yesNo(
      `  Sending ${c.bold("red")} to address 1 (strobe and mode at 0). Did ANY light turn red?`,
      "y",
    )
  ) {
    return { lit: true, stage: "address-1" };
  }

  console.log(
    `\n${c.bold("Signal test.")} Every one of the 512 channels goes to 255 for 4 seconds. ` +
      "Whatever address or mode the lights are in, anything receiving DMX should react: " +
      "light up, flash, change colour or program, " +
      c.bold("or the display on the back stops blinking") +
      ".",
  );
  dmx.universe.fill(255);
  await sleep(4000);
  const blastResponse = await yesNo(
    "  Did ANY light do anything, or did ANY display on the back stop blinking?",
    "n",
  );
  dmx.universe.fill(0);
  if (!blastResponse) return { lit: false, blastResponse };

  console.log(
    `\n${c.bold("Address scan.")} Red sweeps across every possible DMX address ` +
      "(a new address about every 0.4 seconds). Watch the lights and press Enter " +
      c.bold("the moment any light turns red") +
      ".",
  );
  let stop = false;
  const pressed = ask(c.dim("  Press Enter when a light turns red…")).then(
    () => {
      stop = true;
    },
  );
  let address = 1;
  const shown: number[] = [];
  for (; address <= 506 && !stop; address++) {
    dmx.universe.fill(0);
    fixture(dmx, address, { master: 255, r: 255, ...SAFE });
    shown.push(address);
    await sleep(400);
  }
  dmx.universe.fill(0);
  if (!stop)
    console.log(
      c.yellow("  Scan finished and nothing lit. Press Enter to continue."),
    );
  await pressed;
  // Reaction time is ~1s, so the light that lit was among the last few addresses shown.
  const scanCandidates = stop && shown.length ? shown.slice(-4) : [];
  if (scanCandidates.length) {
    console.log(
      c.green(
        `  ✓ A light turned red while addresses ${scanCandidates.join(", ")} were showing.`,
      ),
    );
  }
  return { lit: false, blastResponse, scanCandidates };
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

export interface WireRateResult {
  label: string;
  requestedBaud: number;
  /** Baud rate implied by how long the bytes took (bytes/s × bits per byte). */
  measuredBaud: number;
  /** measured / requested: ≈1.00 means the driver applied the speed we asked for. */
  ratio: number;
  error?: string;
}

/**
 * Time how long ~1 second of data takes to leave the adapter, at several settings. The
 * UART can't send faster than its baud rate, so bytes-per-second reveals the speed the
 * driver REALLY applied. The 115200 and 230400 rows are standard speeds: they show the
 * method works. If the 250000 row comes out near 230400, macOS rounded the DMX speed,
 * and the lights would see garbled data.
 */
async function measureWireRate(path: string): Promise<WireRateResult[]> {
  const cases = [
    { label: "115200 8N1 (reference)", baudRate: 115200, stopBits: 1 as const },
    { label: "230400 8N1 (reference)", baudRate: 230400, stopBits: 1 as const },
    { label: "250000 8N2 (DMX)", baudRate: 250000, stopBits: 2 as const },
    { label: "250000 8N1", baudRate: 250000, stopBits: 1 as const },
  ];
  const results: WireRateResult[] = [];
  for (const { label, baudRate, stopBits } of cases) {
    const bitsPerByte = 1 + 8 + stopBits;
    const bytes = Math.round(baudRate / bitsPerByte); // ≈ 1 second of data
    try {
      const port = new SerialPort({
        path,
        baudRate,
        dataBits: 8,
        stopBits,
        parity: "none",
        autoOpen: false,
      });
      await new Promise<void>((res, rej) =>
        port.open((e) => (e ? rej(e) : res())),
      );
      const t0 = performance.now();
      await new Promise<void>((res, rej) =>
        port.write(Buffer.alloc(bytes), (e) => (e ? rej(e) : res())),
      );
      await new Promise<void>((res, rej) =>
        port.drain((e) => (e ? rej(e) : res())),
      );
      const seconds = (performance.now() - t0) / 1000;
      await new Promise<void>((res) => port.close(() => res()));
      const measuredBaud = Math.round((bytes / seconds) * bitsPerByte);
      const ratio = Math.round((measuredBaud / baudRate) * 1000) / 1000;
      results.push({ label, requestedBaud: baudRate, measuredBaud, ratio });
      console.log(
        `  ${label.padEnd(26)} asked ${baudRate}, measured ≈${measuredBaud}  (×${ratio.toFixed(2)})`,
      );
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({
        label,
        requestedBaud: baudRate,
        measuredBaud: 0,
        ratio: 0,
        error,
      });
      console.log(c.red(`  ${label}: ${error}`));
    }
  }
  return results;
}

export interface VariantSweepResult {
  variants: string[];
  /** The variant running when you pressed Enter (reaction time means it may be the one before). */
  reactedDuring: string | null;
  previous: string | null;
}

/**
 * Run different ways of building the DMX signal, a few seconds each, with every channel at
 * 255. If any light reacts to one of them, that's the setting to use.
 */
async function variantSweep(path: string): Promise<VariantSweepResult> {
  const variants: {
    label: string;
    opts: ConstructorParameters<typeof OpenDmxOutput>[0];
  }[] = [
    {
      label: "break via line-break, 2 stop bits (the default)",
      opts: { path, breakMode: "brk", stopBits: 2 },
    },
    {
      label: "break via baud-rate drop, 2 stop bits",
      opts: { path, breakMode: "baud", stopBits: 2 },
    },
    {
      label: "break via line-break, 1 stop bit",
      opts: { path, breakMode: "brk", stopBits: 1 },
    },
    {
      label: "break via baud-rate drop, 1 stop bit",
      opts: { path, breakMode: "baud", stopBits: 1 },
    },
    {
      label: "long 5 ms line-break, 2 stop bits",
      opts: { path, breakMode: "brk", stopBits: 2, breakMs: 5 },
    },
    {
      label: "line-break, 2 stop bits, slow 15 fps",
      opts: { path, breakMode: "brk", stopBits: 2, fps: 15 },
    },
  ];
  console.log(
    `\n${c.bold("Variant sweep.")} Six different ways of building the signal, ~7 seconds each, ` +
      "all channels at 255. Watch the lights AND the displays on the back, and press Enter " +
      c.bold(
        "the moment ANY light does anything or ANY display stops blinking",
      ) +
      ".",
  );
  let pressed = false;
  const answered = ask(
    c.dim("  Press Enter when a light reacts or a display stops blinking…"),
  ).then(() => {
    pressed = true;
  });
  let reactedDuring: string | null = null;
  let previous: string | null = null;
  for (const [i, v] of variants.entries()) {
    if (pressed) break;
    console.log(c.dim(`  ${i + 1}/${variants.length}: ${v.label}`));
    const out = new OpenDmxOutput(v.opts);
    try {
      await out.start();
      out.universe.fill(255);
      for (let waited = 0; waited < 7000 && !pressed; waited += 100)
        await sleep(100);
    } catch (err) {
      console.log(
        c.red(`    error: ${err instanceof Error ? err.message : err}`),
      );
    } finally {
      out.universe.fill(0);
      await sleep(150);
      await out.stop().catch(() => {});
    }
    if (pressed) {
      reactedDuring = v.label;
      previous = variants[i - 1]?.label ?? null;
    }
  }
  if (!pressed)
    console.log(c.yellow("  Nothing reacted. Press Enter to continue."));
  await answered;
  if (reactedDuring)
    console.log(
      c.green(
        `  ✓ A light reacted during: ${reactedDuring}` +
          (previous ? ` (or just before: ${previous})` : ""),
      ),
    );
  return { variants: variants.map((v) => v.label), reactedDuring, previous };
}

function printNoLightAdvice(signalArrives: boolean): void {
  console.log(
    `\n${c.red("No light reacted.")} The report records what was tried.`,
  );
  if (signalArrives) {
    console.log(
      "\nSomething DID react to the all-channels test, so DMX is reaching the fixtures. " +
        "The address or mode on the lights probably doesn't match what the app assumes. " +
        "Tell me what the displays show (mode and address).",
    );
    return;
  }
  console.log(`
Nothing reacted, and no display stopped blinking, so DMX is not getting into the lights.
This is almost always physical, not software. Check, in this order:
  1. DMX IN, not OUT. The cable from the Open DMX must go into the first light's DMX IN
     socket (the OUT socket only passes signal along). Try this first.
  2. One light only. Unplug the chain: Open DMX -> one cable -> one light's DMX IN.
     A single bad cable or light further down can take the whole chain down.
  3. A different cable. Swap in another XLR cable (a short one). Mic cables usually
     work for short runs.
  4. Swapped data wires. Some cheap Open DMX adapters wire pins 2 and 3 the other way
     round from the lights. A "phase reverse" XLR adapter (or a cable with pins 2 and 3
     crossed) fixes it. If cables 1-3 fail, this is the next suspect.
  5. Adapter connector. The Open DMX should be using its DMX OUTPUT socket (3-pin or 5-pin).
     With 5-pin you need pins 1, 2, 3 to line up with a 3-pin cable. Use the proper adapter.
  6. Terminator. Plug a 120-ohm DMX terminator (or a resistor across pins 2 and 3 in a spare
     XLR) into the LAST light's DMX OUT. Many cheap lights need it.
  7. USB. Plug the adapter straight into the laptop, not through a hub.
Re-run \`npm run probe -- dmx\` after each change and watch whether the displays stop blinking.`);
}

export async function runDmxSection(): Promise<DmxSection> {
  heading("Open DMX + lights");
  const section: DmxSection = {
    serialPorts: [],
    firstLight: false,
    firstLightAttempts: [],
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
  console.log(c.dim(DISPLAY_TELL));
  await pause();

  // What does macOS think of the adapter? Useful whether or not the lights respond.
  console.log(c.dim("Collecting driver info…"));
  section.driver = await collectDriverInfo();

  // Try the cleaner break method first; fall back to the baud-rate trick — unless the
  // signal-test shows DMX is arriving, in which case the break method isn't the problem.
  let dmx: OpenDmxOutput | undefined;
  let signalArrives = false;
  for (const breakMode of ["brk", "baud"] as const) {
    const out = new OpenDmxOutput({ path, fps: 30, breakMode });
    try {
      await out.start();
      const result = await findFirstLight(out);
      section.firstLightAttempts.push({ breakMode, ...result });
      if (result.lit) {
        dmx = out;
        section.breakMode = breakMode;
        break;
      }
      await out.stop();
      if (result.blastResponse) {
        signalArrives = true;
        break;
      }
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
    if (!signalArrives) {
      console.log(
        `\n${c.bold("Wire-speed check")} (no lights needed). How fast do bytes really leave the adapter?`,
      );
      section.wireRate = await measureWireRate(path);
      section.variantSweep = await variantSweep(path);
    }
    printNoLightAdvice(signalArrives);
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
      fixture(dmx, 1, {
        master: 255,
        r: rgb[0],
        g: rgb[1],
        b: rgb[2],
        ...SAFE,
      });
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
    let neutral: { rgb: number; strobe: number; mode: number } = { ...SAFE };
    for (const ch of ["strobe", "mode", "rgb"] as const) {
      section.exploration.push(await exploreChannel(dmx, ch, neutral));
    }
    const steadyAtZero = await yesNo(
      "\nWith strobe and mode at 1 and rgb at 0, was the light plain steady blue (no flashing, no auto-program)?",
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
