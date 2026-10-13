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

  $("pads").replaceChildren(
    ...MINILAB_MAPPING.pads.roles.map((role) => {
      const pad = el("div", "pad", HIT_LABELS[role]);
      padEls.push(pad);
      return pad;
    }),
  );

  $("knobs").replaceChildren(
    ...MINILAB_MAPPING.knobs.roles.map((role) => {
      const knob = el("div", "knob");
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "40");
      svg.setAttribute("height", "40");
      svg.setAttribute("viewBox", "0 0 40 40");
      svg.innerHTML = `<path d="${arc(1)}" fill="none" stroke="#2b2824" stroke-width="4" stroke-linecap="round"/>`;
      const fill = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      fill.setAttribute("fill", "none");
      fill.setAttribute("stroke", "currentColor");
      fill.setAttribute("stroke-width", "4");
      fill.setAttribute("stroke-linecap", "round");
      fill.style.color = "var(--ink)";
      svg.append(fill);
      const value = el("span", "value", "—");
      knob.append(svg, value, document.createTextNode(KNOB_LABELS[role]));
      knobEls.push({ arc: fill, value });
      return knob;
    }),
  );

  $("faders").replaceChildren(
    ...MINILAB_MAPPING.faders.roles.map((role) => {
      const fader = el("div", "fader");
      const track = el("div", "track");
      const fill = el("div", "fill");
      track.append(fill);
      fader.append(track, document.createTextNode(FADER_LABELS[role]));
      faderFills.push(fill);
      return fader;
    }),
  );
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
  setDevice(
    "dev-dmx",
    dmx.connected,
    dmx.connected
      ? "Lights"
      : dmx.fake
        ? "Lights: no Open DMX (preview only)"
        : "Lights",
  );
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
