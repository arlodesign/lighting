import { Input } from "@julusian/midi";
import { decodeMidi, type DecodedMidi } from "../src/midi/decode.ts";
import { classifyKnobEncoding, type KnobEncoding } from "./encoding.ts";
import { ask, c, choose, heading, pause } from "./prompt.ts";

interface CapturedEvent extends DecodedMidi {
  /** ms since the step started */
  t: number;
  port: string;
  bytes: number[];
}

interface StepSummary {
  /** One line per distinct (port, kind, channel, data1): what the control sends. */
  signatures: {
    port: string;
    kind: string;
    channel: number;
    data1?: number;
    count: number;
    min?: number;
    max?: number;
  }[];
  knobEncoding?: KnobEncoding;
}

interface StepResult {
  id: string;
  instruction: string;
  skipped: boolean;
  events: CapturedEvent[];
  summary: StepSummary;
  note?: string;
}

interface Step {
  id: string;
  instruction: string;
  /** Run the knob-encoding classifier on this step's CC values. */
  knob?: boolean;
}

export interface MidiPassResult {
  program: string;
  steps: StepResult[];
}

export interface MidiSection {
  inputPorts: string[];
  openedPorts: string[];
  passes: MidiPassResult[];
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** The full tour of the controller, in the order a person would naturally work across it. */
function fullTour(): Step[] {
  return [
    ...range(8).map((n) => ({
      id: `pad${n}`,
      instruction: `Press pad ${n} softly, then press it HARD and hold it squeezed for a second, then let go.`,
    })),
    ...range(8).map((n) => ({
      id: `knob${n}`,
      instruction: `Turn knob ${n} slowly RIGHT about half a turn, then slowly LEFT about half a turn.`,
      knob: true,
    })),
    {
      id: "knob1-fast",
      instruction: "Spin knob 1 FAST to the right, then FAST to the left.",
      knob: true,
    },
    ...range(4).map((n) => ({
      id: `fader${n}`,
      instruction: `Move fader ${n} all the way down, then all the way up.`,
    })),
    {
      id: "pitch-strip",
      instruction:
        "Slide a finger along the PITCH strip from one end to the other, then let go.",
    },
    {
      id: "mod-strip",
      instruction:
        "Slide a finger along the MOD strip from one end to the other, then let go.",
    },
    {
      id: "main-encoder-turn",
      instruction:
        "Turn the big main encoder (by the screen) 3 clicks RIGHT, then 3 clicks LEFT.",
      knob: true,
    },
    {
      id: "main-encoder-click",
      instruction: "Click (push) the main encoder twice.",
    },
    { id: "shift", instruction: "Press and release the SHIFT button twice." },
    {
      id: "shift-main-encoder",
      instruction:
        "Hold SHIFT and turn the main encoder 3 clicks right, then click it once.",
    },
    {
      id: "shift-pads",
      instruction:
        "Hold SHIFT and tap pads 4, 5, 6, 7, 8 in order. (Skip pads 1–3: they change modes/program.)",
    },
    {
      id: "hold-button",
      instruction: "Press the HOLD button, then press it again to turn it off.",
    },
    {
      id: "keys-range",
      instruction:
        "Play the LOWEST key softly, then HARD. Then the HIGHEST key softly, then HARD.",
    },
    {
      id: "keys-octave",
      instruction:
        "Press OCTAVE + once and play the lowest key. Press OCTAVE − twice and play the lowest key. Press OCTAVE + once to get back to normal.",
    },
  ];
}

/** Second pass (User program): only the controls a program change is likely to alter. */
function userProgramTour(): Step[] {
  return fullTour().filter((s) =>
    /^(pad\d|knob|fader|main-encoder)/.test(s.id),
  );
}

function summarize(events: CapturedEvent[], knob: boolean): StepSummary {
  const map = new Map<string, StepSummary["signatures"][number]>();
  for (const e of events) {
    const key = `${e.port}|${e.kind}|${e.channel}|${e.data1 ?? ""}`;
    const sig = map.get(key) ?? {
      port: e.port,
      kind: e.kind,
      channel: e.channel,
      ...(e.data1 !== undefined && { data1: e.data1 }),
      count: 0,
    };
    sig.count++;
    if (e.value !== undefined) {
      sig.min = Math.min(sig.min ?? e.value, e.value);
      sig.max = Math.max(sig.max ?? e.value, e.value);
    }
    map.set(key, sig);
  }
  const signatures = [...map.values()].sort((a, b) => b.count - a.count);

  const summary: StepSummary = { signatures };
  if (knob) {
    // Classify the busiest CC in the step (the knob being turned).
    const top = signatures.find((s) => s.kind === "cc");
    if (top) {
      const values = events
        .filter(
          (e) =>
            e.kind === "cc" && e.data1 === top.data1 && e.port === top.port,
        )
        .map((e) => e.value ?? 0);
      summary.knobEncoding = classifyKnobEncoding(values);
    }
  }
  return summary;
}

function describeSignature(s: StepSummary["signatures"][number]): string {
  const what =
    s.kind === "cc"
      ? `CC ${s.data1}`
      : s.data1 !== undefined
        ? `${s.kind} ${s.data1}`
        : s.kind;
  const vals = s.min !== undefined ? ` values ${s.min}–${s.max}` : "";
  return `${what} ch${s.channel}${vals} ×${s.count}  ${c.dim(s.port)}`;
}

/** Opens every MiniLab port (it exposes several) so we learn which port each control uses. */
function openInputs(onEvent: (port: string, bytes: number[]) => void): {
  all: string[];
  opened: string[];
  close: () => void;
} {
  const all = Input.getPortNames();
  const wanted = all.filter((name) => /minilab/i.test(name));
  const targets = wanted.length > 0 ? wanted : all;
  const inputs = targets.map((name) => {
    const input = new Input();
    input.ignoreTypes(false, true, true); // keep sysex; drop clock + active sensing noise
    input.on("message", (_dt, bytes) => onEvent(name, bytes));
    input.openPortByName(name);
    return input;
  });
  return {
    all,
    opened: targets,
    close: () => inputs.forEach((i) => (i.closePort(), i.destroy())),
  };
}

async function runPass(
  program: string,
  steps: Step[],
  listen: (sink: ((port: string, bytes: number[]) => void) | undefined) => void,
): Promise<MidiPassResult> {
  const results: StepResult[] = [];
  for (const [i, step] of steps.entries()) {
    console.log(
      `\n${c.bold(`[${i + 1}/${steps.length}]`)} ${step.instruction}`,
    );
    const events: CapturedEvent[] = [];
    const t0 = performance.now();
    listen((port, bytes) => {
      const e: CapturedEvent = {
        ...decodeMidi(bytes),
        t: Math.round(performance.now() - t0),
        port,
        bytes,
      };
      events.push(e);
      process.stdout.write(
        c.dim(`  · ${e.kind} ${e.data1 ?? ""} ${e.value ?? ""}\n`),
      );
    });
    const answer = await ask(
      c.dim(
        "  Press Enter when done (s = skip, r = redo, or type a note then Enter):",
      ),
    );
    listen(undefined);

    if (answer.toLowerCase() === "r") {
      steps.splice(i + 1, 0, step); // run the same step again next
      continue;
    }
    const skipped = answer.toLowerCase() === "s";
    const summary = summarize(events, step.knob ?? false);
    results.push({
      id: step.id,
      instruction: step.instruction,
      skipped,
      events,
      summary,
      ...(answer && !skipped && { note: answer }),
    });

    if (events.length === 0 && !skipped)
      console.log(c.yellow("  ⚠ Nothing received for that step."));
    for (const s of summary.signatures.slice(0, 4))
      console.log(c.green(`  ✓ ${describeSignature(s)}`));
    if (summary.knobEncoding)
      console.log(c.green(`  ✓ knob encoding guess: ${summary.knobEncoding}`));
  }
  return { program, steps: results };
}

export async function runMidiSection(): Promise<MidiSection> {
  heading("MiniLab 3 (MIDI)");
  let sink: ((port: string, bytes: number[]) => void) | undefined;
  const ports = openInputs((port, bytes) => sink?.(port, bytes));
  const listen = (fn: typeof sink) => (sink = fn);

  console.log(
    `MIDI inputs found: ${ports.all.length ? ports.all.join(", ") : c.red("none")}`,
  );
  if (ports.all.length === 0) {
    console.log(
      c.red(
        "No MIDI devices. Is the MiniLab plugged in (and the hub powered)?",
      ),
    );
    ports.close();
    return { inputPorts: [], openedPorts: [], passes: [] };
  }
  console.log(`Listening on: ${ports.opened.join(", ")}`);

  const section: MidiSection = {
    inputPorts: ports.all,
    openedPorts: ports.opened,
    passes: [],
  };
  try {
    console.log(
      `\nPass 1 uses the MiniLab's ${c.bold("default Arturia program")}. ` +
        "If you've already switched programs, cycle back with SHIFT + pad 3 until the screen says Arturia.",
    );
    await pause();
    section.passes.push(await runPass("arturia", fullTour(), listen));

    console.log(
      `\nPass 2 uses your ${c.bold("User program with relative knobs")} (see probe/README.md). ` +
        "Switch to it now with SHIFT + pad 3.",
    );
    const go = await choose(
      "Ready for pass 2, or skip it?",
      ["go", "skip"] as const,
      "go",
    );
    if (go === "go") {
      const label =
        (await ask("Program name as shown on the screen (Enter = user):")) ||
        "user";
      section.passes.push(await runPass(label, userProgramTour(), listen));
    }
  } finally {
    ports.close();
  }
  return section;
}
