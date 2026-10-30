/**
 * Hardware probe: a guided tour of the MiniLab 3, Open DMX + lights, and microphone on the
 * show laptop. Writes probe-reports/probe-<time>.json for the app to be built from.
 *
 *   npm run probe              everything
 *   npm run probe -- midi dmx  just those sections (any of: midi, dmx, mic)
 */
import { runDmxSection } from "./dmx.ts";
import { runMicSection } from "./mic.ts";
import { runMidiSection } from "./midi.ts";
import { ask, c, closePrompt, heading } from "./prompt.ts";
import { createReport, saveReport } from "./report.ts";

const SECTIONS = {
  midi: runMidiSection,
  dmx: runDmxSection,
  mic: runMicSection,
} as const;
type SectionName = keyof typeof SECTIONS;

const requested = process.argv
  .slice(2)
  .filter((a): a is SectionName => a in SECTIONS);
const toRun: SectionName[] =
  requested.length > 0 ? requested : ["midi", "dmx", "mic"];

const report = createReport();
let file = await saveReport(report);

// Ctrl-C mid-run still leaves a usable (partial) report on disk.
process.on("SIGINT", () => {
  report.errors.push("interrupted (Ctrl-C)");
  saveReport(report).finally(() => {
    console.log(`\nPartial report saved to ${file}`);
    process.exit(130);
  });
});

heading("Lighting hardware probe");
console.log(
  `Machine: ${report.machine.cpu}, ${report.machine.totalMemGb} GB, Node ${report.machine.node}`,
);
console.log(
  `Sections: ${toRun.join(", ")}. Answers are saved after every section.`,
);

for (const name of toRun) {
  try {
    report[name] = await SECTIONS[name]();
  } catch (err) {
    const msg = `${name}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`;
    report.errors.push(msg);
    console.log(c.red(`\n${name} section failed: ${msg}`));
  }
  file = await saveReport(report);
}

const note = await ask(
  "\nAnything else worth noting (weird behavior, ideas)? Enter to skip:",
);
if (note) report.notes.final = note;
report.finishedAt = new Date().toISOString();
file = await saveReport(report);

heading("Done");
console.log(`Report: ${c.bold(file)}`);
console.log(
  "Bring that file back (git push, AirDrop, or email) — see probe/README.md.",
);
closePrompt();
process.exit(0);
