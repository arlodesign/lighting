/**
 * Terminal preview of the engine — no hardware needed. Draws the 8 lights as colour blocks.
 *
 *   npm run preview
 *
 * Keys:  ←/→ look   ↑/↓ palette   g geometry   [ ] speed   - = fade   w/W width
 *        space tap   b blackout   s strobe   f white flash   l lightning   (hits last 0.4s)
 *        n next song (load)   q quit
 */
import { emitKeypressEvents } from "node:readline";
import type { HitId, KnobId } from "../src/engine/actions.ts";
import { Engine, TICKS_PER_STEP } from "../src/engine/engine.ts";
import { LOOKS } from "../src/engine/looks/index.ts";
import { LIGHT_IDS } from "../src/engine/rig.ts";
import { SETLIST } from "../src/setlist.ts";

const engine = new Engine({ setlist: SETLIST });
engine.controls.master = 1;

const now = () => performance.now();
const turn = (knob: KnobId, steps: number) =>
  engine.dispatch({ type: "knob", knob, delta: steps * TICKS_PER_STEP }, now());
const flash = (hit: HitId) => {
  engine.dispatch({ type: "hit", hit, down: true, pressure: 0.7 }, now());
  setTimeout(
    () => engine.dispatch({ type: "hit", hit, down: false }, now()),
    400,
  );
};

emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on(
  "keypress",
  (str: string | undefined, key: { name?: string; ctrl?: boolean }) => {
    const c = engine.controls;
    if (key.name === "q" || (key.ctrl && key.name === "c")) quit();
    else if (key.name === "right")
      engine.dispatch(
        { type: "look", index: (c.lookIndex + 1) % LOOKS.length, velocity: 1 },
        now(),
      );
    else if (key.name === "left")
      engine.dispatch(
        {
          type: "look",
          index: (c.lookIndex + LOOKS.length - 1) % LOOKS.length,
          velocity: 1,
        },
        now(),
      );
    else if (key.name === "up") turn("palette", 1);
    else if (key.name === "down") turn("palette", -1);
    else if (str === "g") turn("geometry", 1);
    else if (str === "]") turn("speed", 1);
    else if (str === "[") turn("speed", -1);
    else if (str === "=") turn("fade", 1);
    else if (str === "-") turn("fade", -1);
    else if (str === "w")
      engine.dispatch({ type: "knob", knob: "width", delta: -10 }, now());
    else if (str === "W")
      engine.dispatch({ type: "knob", knob: "width", delta: 10 }, now());
    else if (key.name === "space") engine.dispatch({ type: "tap" }, now());
    else if (str === "b") flash("blackout");
    else if (str === "s") flash("strobe");
    else if (str === "f") flash("white-flash");
    else if (str === "l") flash("lightning");
    else if (str === "n") engine.dispatch({ type: "setlist-load" }, now());
  },
);

const block = (r: number, g: number, b: number) =>
  `\x1b[48;2;${Math.round(r * 255)};${Math.round(g * 255)};${Math.round(b * 255)}m        \x1b[0m`;

process.stdout.write("\x1b[?25l\x1b[2J"); // hide cursor, clear
const timer = setInterval(() => {
  const t = now();
  const frame = engine.render(t);
  const s = engine.status(t);
  const strobeOn =
    frame.strobe > 0 &&
    Math.floor(t / (40 + (1 - frame.strobe) * 160)) % 2 === 0;
  const row = frame.lights
    .map(
      (c, i) =>
        (frame.strobe > 0 && !strobeOn
          ? block(0, 0, 0)
          : block(c.r, c.g, c.b)) + (i === 3 ? "      " : " "),
    )
    .join("");
  const labels = LIGHT_IDS.map(
    (id, i) => id.padEnd(9) + (i === 3 ? "      " : ""),
  ).join("");
  const beat = [0, 1, 2, 3]
    .map((b) => (b === s.beatOfBar ? "●" : "○"))
    .join(" ");
  const song = s.setlist.current ? `${s.setlist.current.name}` : "—";
  process.stdout.write(
    "\x1b[H" +
      `\n  ${row}\n  ${row}\n  ${labels}\n\n` +
      `  ${s.look.padEnd(16)} ${s.palette.padEnd(14)} ${String(s.bpm).padStart(5)} BPM  ${beat}   \n` +
      `  speed ×${s.speed}  fade ${s.fadeBeats} beats  ${s.geometry.padEnd(6)}  width ${s.width.toFixed(2)}  ` +
      `${s.hits.join(",").padEnd(20)}\n` +
      `  song: ${song.padEnd(20)} next: ${(s.setlist.next?.name ?? "—").padEnd(20)}\n\n` +
      "  \x1b[2m←/→ look  ↑/↓ palette  g geometry  [ ] speed  - = fade  w/W width\n" +
      "  space tap  b blackout  s strobe  f flash  l lightning  n next song  q quit\x1b[0m\n",
  );
}, 1000 / 30);

function quit(): never {
  clearInterval(timer);
  process.stdout.write("\x1b[?25h\n");
  process.exit(0);
}
