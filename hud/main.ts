// Bundled locally: the bar has no reliable internet for web fonts.
import "@fontsource/big-shoulders-display/600";
import "@fontsource/big-shoulders-display/800";
import "./style.css";
import type { Action, HitId } from "../src/engine/actions.ts";
import { MINILAB_MAPPING } from "../src/midi/mapping.ts";
import {
  WS_PATH,
  type ClientMessage,
  type EngineStatus,
  type ServerMessage,
} from "../src/server/protocol.ts";
import { startMic } from "./audio.ts";

type Hello = Extract<ServerMessage, { type: "hello" }>;
type State = Extract<ServerMessage, { type: "state" }>;

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const el = (tag: string, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const HIT_LABELS: Record<HitId | "tap", string> = {
  strobe: "Strobe",
  "white-flash": "White flash",
  blackout: "Blackout",
  "color-bump": "Colour bump",
  "left-flash": "Left flash",
  "right-flash": "Right flash",
  lightning: "Lightning",
  tap: "Tap tempo",
};

const KNOB_LABELS = {
  speed: "Speed",
  hue: "Hue",
  saturation: "Colour",
  palette: "Palette",
  width: "Width",
  fade: "Fade",
  geometry: "Shape",
  sensitivity: "Mic",
} as const;

const GEOMETRY_LABELS = {
  linear: "Sweep",
  mirror: "Centre",
  split: "Split",
} as const;
const FADER_LABELS = {
  master: "Master",
  left: "Left",
  right: "Right",
  audio: "Audio",
} as const;

// ── connection ───────────────────────────────────────────────────────────────────

let ws: WebSocket | undefined;
let hello: Hello | undefined;

function connect(): void {
  const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${WS_PATH}`;
  ws = new WebSocket(url);
  ws.onopen = () => showBanner(null);
  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data)) as ServerMessage;
    if (msg.type === "hello") {
      hello = msg;
      build(msg);
    } else if (hello) {
      update(msg);
    }
  };
  ws.onclose = () => {
    showBanner(
      "Can't reach the light server. Is `npm start` running? Retrying…",
    );
    setTimeout(connect, 1000);
  };
}

function send(msg: ClientMessage): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
const act = (action: Action) => send({ type: "action", action });

function showBanner(text: string | null): void {
  const banner = $("banner");
  banner.hidden = text === null;
  banner.textContent = text ?? "";
}

// ── build once (on hello) ────────────────────────────────────────────────────────

const lampGlows: HTMLElement[] = [];
const padEls: HTMLElement[] = [];
const knobEls: { arc: SVGPathElement; value: HTMLElement }[] = [];
const faderFills: HTMLElement[] = [];

function build(h: Hello): void {
  lampGlows.length = padEls.length = knobEls.length = faderFills.length = 0;

  for (const side of ["L", "R"]) $(`side-${side}`).replaceChildren();
  h.lights.forEach((id) => {
    const lamp = el("div", "lamp");
    const glow = el("div", "glow");
    lamp.append(glow, el("span", "label", id));
    $(`side-${id[0]}`).append(lamp);
    lampGlows.push(glow);
  });

  const layer = $("layer");
  const cells: HTMLElement[] = [];

  // Pads: one row of eight under the knobs and faders, as on the device.
  MINILAB_MAPPING.pads.roles.forEach((role, i) => {
    const pad = cell("pad", PAD_COLS[i]!, 7.2, 75, 22);
    pad.append(
      el("span", "num", String(i + 1)),
      el("span", "name", HIT_LABELS[role]),
    );
    padEls.push(pad);
    cells.push(pad);
  });

  // Knobs 1–4 on top, 5–8 below.
  MINILAB_MAPPING.knobs.roles.forEach((role, i) => {
    const knob = cell(
      "knob",
      KNOB_COLS[i % 4]!,
      9,
      KNOB_ROW_TOPS[i < 4 ? 0 : 1]!,
      24,
    );
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 40 40");
    const track = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    track.setAttribute("d", arc(1));
    track.setAttribute("fill", "none");
    track.setAttribute("stroke", "#2b2824");
    track.setAttribute("stroke-width", "4");
    track.setAttribute("stroke-linecap", "round");
    const fill = document.createElementNS("http://www.w3.org/2000/svg", "path");
    fill.setAttribute("fill", "none");
    fill.setAttribute("stroke", "currentColor");
    fill.setAttribute("stroke-width", "4");
    fill.setAttribute("stroke-linecap", "round");
    fill.style.color = "var(--ink)";
    svg.append(track, fill);
    const value = el("span", "value", "—");
    const label = el("span", "label");
    label.append(el("span", "num", String(i + 1)), KNOB_LABELS[role]);
    knob.append(svg, value, label);
    knobEls.push({ arc: fill, value });
    cells.push(knob);
  });

  // Faders 1–4 to the right of the knobs.
  MINILAB_MAPPING.faders.roles.forEach((role, i) => {
    const fader = cell("fader", FADER_COLS[i]!, 5.6, 19, 47);
    const track = el("div", "track");
    const fill = el("div", "fill");
    track.append(fill);
    const label = el("span", "label");
    label.append(el("span", "num", String(i + 1)), FADER_LABELS[role]);
    fader.append(track, label);
    faderFills.push(fill);
    cells.push(fader);
  });

  layer.replaceChildren(...cells);
  buildKeyboard(h);
}

// Centres (% of the board's width) and tops (% of its height), measured from the real panel.
const KNOB_COLS = [35.8, 45.2, 54.5, 63.7];
const KNOB_ROW_TOPS = [13.6, 44.5];
const FADER_COLS = [72.7, 78.7, 84.7, 90.7];
const PAD_COLS = [26.5, 35.9, 45.3, 54.5, 63.7, 72.9, 81.9, 90.9];

function cell(cls: string, centreX: number, w: number, y: number, h: number) {
  const node = el("div", `cell ${cls}`);
  node.style.setProperty("--x", `${centreX - w / 2}%`);
  node.style.setProperty("--y", `${y}%`);
  node.style.setProperty("--w", `${w}%`);
  node.style.setProperty("--h", `${h}%`);
  return node;
}

// ── the 25 keys: which look each one plays ───────────────────────────────────────

const keyEls: HTMLElement[] = [];
/** C C♯ D D♯ E F F♯ G G♯ A A♯ B: true = black key. The MiniLab's keys run C to C. */
const BLACK_KEY = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0].map(Boolean);
const KEY_COUNT = 25;
const WHITE_KEY_COUNT = 15;

function buildKeyboard(h: Hello): void {
  keyEls.length = 0;
  const row = el("div", "keys-row");
  const blacks: HTMLElement[] = [];
  let whites = 0;
  for (let k = 0; k < KEY_COUNT; k++) {
    const look = h.looks[k];
    const black = BLACK_KEY[k % 12]!;
    const key = el("button", `key ${black ? "black" : "white"}`);
    key.setAttribute("type", "button");
    if (look) {
      key.append(el("span", undefined, look.name));
      key.title = `Look ${k + 1}: ${look.name}`;
      if (look.spooky) key.classList.add("spooky");
      key.addEventListener("pointerdown", () =>
        act({ type: "look", index: k, velocity: 0.8 }),
      );
    } else {
      key.classList.add("spare");
      key.setAttribute("disabled", "");
    }
    if (black) {
      key.style.left = `${whites * (100 / WHITE_KEY_COUNT) - 2.1}%`;
      blacks.push(key);
    } else {
      row.append(key);
      whites++;
    }
    keyEls.push(key);
  }
  $("keyboard").replaceChildren(row, ...blacks);
}

/** SVG arc for a knob dial: 270° sweep starting bottom-left, `t` 0–1 of the way round. */
function arc(t: number): string {
  const start = Math.PI * 0.75;
  const end = start + Math.PI * 1.5 * Math.max(0.001, Math.min(1, t));
  const r = 16;
  const p = (a: number) => `${20 + r * Math.cos(a)} ${20 + r * Math.sin(a)}`;
  return `M ${p(start)} A ${r} ${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${p(end)}`;
}

// ── update every frame ───────────────────────────────────────────────────────────

function update(state: State): void {
  const s = state.status;
  const h = hello!;

  state.lights.forEach(([r, g, b], i) => {
    const glow = lampGlows[i];
    if (!glow) return;
    const css = `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
    const level = Math.max(r, g, b);
    glow.style.background = css;
    glow.style.boxShadow = `0 0 ${12 + level * 60}px ${level * 18}px ${css}`;
  });
  document
    .querySelector(".stage")!
    .classList.toggle("strobing", state.strobe > 0);

  const palette = h.palettes[s.paletteIndex];
  if (palette) {
    // The HUD's accent is the palette's brightest colour, so it stays readable on black.
    const [r, g, b] = palette.colors.reduce((a, c) =>
      sum(c) > sum(a) ? c : a,
    );
    document.documentElement.style.setProperty(
      "--accent",
      `rgb(${r * 255} ${g * 255} ${b * 255})`,
    );
    $("palette-swatches").replaceChildren(
      ...palette.colors.map(([cr, cg, cb]) => {
        const sw = el("i");
        sw.style.background = `rgb(${cr * 255} ${cg * 255} ${cb * 255})`;
        return sw;
      }),
    );
  }
  $("look-name").textContent = s.look;
  $("palette-name").textContent = s.palette;
  $("bpm").textContent = String(Math.round(s.bpm));
  [...$("beats").children].forEach((dot, i) =>
    dot.classList.toggle("on", i === s.beatOfBar),
  );
  $("tapping").textContent = s.tapCount > 0 ? `Tapping… ${s.tapCount}` : "";

  MINILAB_MAPPING.pads.roles.forEach((role, i) => {
    const held =
      role === "tap"
        ? s.tapCount > 0 && s.beatPhase < 0.15
        : s.hits.includes(role);
    padEls[i]?.classList.toggle("held", held);
  });

  MINILAB_MAPPING.knobs.roles.forEach((role, i) => {
    const knob = knobEls[i];
    if (!knob) return;
    const [text, t] = knobDisplay(role, s, h);
    knob.value.textContent = text;
    knob.arc.setAttribute("d", arc(t));
  });

  MINILAB_MAPPING.faders.roles.forEach((role, i) => {
    const fill = faderFills[i];
    if (fill) fill.style.height = `${s.faders[role] * 100}%`;
  });

  const spotlight = $("spotlight-mark");
  spotlight.style.opacity = s.spotlight === null ? "0" : "1";
  if (s.spotlight !== null) spotlight.style.bottom = `${s.spotlight * 100}%`;
  $("swell-fill").style.height = `${s.swell * 100}%`;
  keyEls.forEach((key, i) => key.classList.toggle("on", i === s.lookIndex));

  $("song-now").textContent = s.setlist.current?.name ?? "—";
  $("song-notes").textContent = s.setlist.current?.notes ?? "";
  const nextIsNew = s.setlist.next && s.setlist.cursor !== s.setlist.loaded;
  $("song-next").textContent = nextIsNew ? s.setlist.next!.name : "—";

  $("mic-level").style.width = `${s.audio.level * 100}%`;
  $("kick").classList.toggle("on", s.audio.kick);

  const { dmx, midi } = state.devices;
  setDevice(
    "dev-midi",
    midi.connected,
    midi.connected ? "MiniLab" : "MiniLab not found",
  );
  setDevice("dev-dmx", dmx.connected, lightsLabel(dmx));
}

function lightsLabel(dmx: State["devices"]["dmx"]): string {
  if (dmx.backend === "qlc") {
    return dmx.connected ? "Lights (via QLC+)" : "Lights: waiting for QLC+";
  }
  if (dmx.backend === "fake") return "Lights: preview only (no DMX output)";
  if (dmx.backend === "usb") {
    return dmx.connected
      ? "Lights (USB)"
      : "Lights: can't open Open DMX (quit QLC+?)";
  }
  return dmx.connected ? "Lights" : "Lights: no Open DMX found";
}

function knobDisplay(
  role: keyof typeof KNOB_LABELS,
  s: EngineStatus,
  h: Hello,
): [string, number] {
  switch (role) {
    case "speed":
      return [`×${s.speed}`, Math.log2(s.speed / 0.25) / 4];
    case "hue":
      return [`${Math.round(s.hue * 360)}°`, s.hue];
    case "saturation":
      return [`${Math.round(s.saturation * 100)}%`, s.saturation];
    case "palette":
      return [
        `${s.paletteIndex + 1}`,
        s.paletteIndex / Math.max(1, h.palettes.length - 1),
      ];
    case "width":
      return [`${Math.round(s.width * 100)}%`, s.width];
    case "fade":
      return [
        s.fadeBeats === 0 ? "Cut" : `${s.fadeBeats} b`,
        Math.log2(1 + s.fadeBeats) / Math.log2(5),
      ];
    case "geometry":
      return [
        GEOMETRY_LABELS[s.geometry],
        ["linear", "mirror", "split"].indexOf(s.geometry) / 2,
      ];
    case "sensitivity":
      return [`${Math.round(s.sensitivity * 100)}%`, s.sensitivity];
  }
}

function setDevice(id: string, ok: boolean, text: string): void {
  const node = $(id);
  node.textContent = text;
  node.classList.toggle("ok", ok);
  node.classList.toggle("bad", !ok);
}

const sum = (c: readonly number[]) => c.reduce((a, b) => a + b, 0);

// ── laptop keyboard (backup controls) ────────────────────────────────────────────

const HOLD_KEYS: Record<string, HitId> = {
  Escape: "blackout",
  s: "strobe",
  f: "white-flash",
  l: "lightning",
};

const heldByKeyboard = new Set<HitId>();
const holdKey = (e: KeyboardEvent) =>
  HOLD_KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];

addEventListener("keydown", (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey) return;
  const hit = holdKey(e);
  if (hit) {
    heldByKeyboard.add(hit);
    act({ type: "hit", hit, down: true, pressure: 0.6 });
  } else if (e.key === " ") act({ type: "tap" });
  else if (e.key === "ArrowUp") act({ type: "setlist-move", delta: -1 });
  else if (e.key === "ArrowDown") act({ type: "setlist-move", delta: 1 });
  else if (e.key === "Enter") act({ type: "setlist-load" });
  else if (/^[1-9]$/.test(e.key))
    act({ type: "look", index: Number(e.key) - 1, velocity: 0.8 });
  else return;
  e.preventDefault();
});

addEventListener("keyup", (e) => {
  const hit = holdKey(e);
  if (hit && heldByKeyboard.delete(hit)) act({ type: "hit", hit, down: false });
});

// If the window loses focus mid-press the keyup never arrives; release what the keyboard
// was holding so nothing gets stuck on. (Hits held on the MiniLab are left alone.)
addEventListener("blur", () => {
  for (const hit of heldByKeyboard) act({ type: "hit", hit, down: false });
  heldByKeyboard.clear();
});

// ── mic ──────────────────────────────────────────────────────────────────────────

$("mic-on").addEventListener("click", async () => {
  const button = $<HTMLButtonElement>("mic-on");
  try {
    await startMic((frame) => send({ type: "audio", ...frame }));
    button.textContent = "Mic on";
    button.disabled = true;
  } catch (err) {
    button.textContent = "Mic blocked. Allow it in the browser and click again";
    console.error(err);
  }
});

connect();
