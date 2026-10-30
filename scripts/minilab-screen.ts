/**
 * Test the MiniLab 3's screen on its own (the show app does this itself while it runs). Quit the
 * show app first so only one program talks to the MiniLab.
 *
 *   npm run minilab-screen                 cycle through the setlist, 3 s per song
 *   npm run minilab-screen -- --no-daw     skip the DAW-mode switch (see if text shows anyway)
 *   npm run minilab-screen -- --text "Hello" --text2 "Halloween"
 *
 * Ctrl-C puts the MiniLab back in its normal mode. If the controller ever seems stuck,
 * unplug it and plug it back in: that always resets it.
 */
import { Output } from "@julusian/midi";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import {
  ENTER_DAW_MODE,
  EXIT_DAW_MODE,
  screenMessage,
  songScreen,
} from "../src/midi/minilabScreen.ts";
import { SETLIST } from "../src/setlist.ts";

const { values } = parseArgs({
  options: {
    "no-daw": { type: "boolean", default: false },
    text: { type: "string" },
    text2: { type: "string" },
  },
});

const names = Output.getPortNames();
console.log("MIDI output ports:", names.join(" | ") || "(none)");
const portName =
  names.find((n) => /minilab.*midi(?!.*(din|mcu|hui|alv))/i.test(n)) ??
  names.find((n) => /minilab/i.test(n));
if (!portName) {
  console.error(
    "\nNo MiniLab output found. Is it plugged in (and the show app quit)?",
  );
  process.exit(1);
}

const out = new Output();
out.openPortByName(portName);
console.log(`Using "${portName}".`);

const send = (bytes: readonly number[]) => out.sendMessage([...bytes]);
let leaving = false;
async function leave(): Promise<never> {
  if (leaving) process.exit(0);
  leaving = true;
  try {
    if (!values["no-daw"]) send(EXIT_DAW_MODE);
    await sleep(200);
    out.closePort();
  } catch {
    // best effort
  }
  console.log("\nBack to normal mode.");
  process.exit(0);
}
process.on("SIGINT", () => void leave());
process.on("SIGTERM", () => void leave());

if (!values["no-daw"]) {
  console.log("Switching the MiniLab into DAW mode…");
  send(ENTER_DAW_MODE);
  await sleep(500);
}

console.log("Watch the small screen above the big knob. Ctrl-C to stop.\n");

if (values.text !== undefined || values.text2 !== undefined) {
  send(screenMessage(values.text ?? "", values.text2 ?? ""));
  console.log(`Sent: "${values.text ?? ""}" / "${values.text2 ?? ""}"`);
  await sleep(60_000);
  await leave();
}

for (;;) {
  for (const [i, song] of SETLIST.entries()) {
    send(songScreen(i, SETLIST.length, song.name));
    console.log(
      `  ${String(i + 1).padStart(2)}/${SETLIST.length}  ${song.name}`,
    );
    await sleep(3000);
  }
}
