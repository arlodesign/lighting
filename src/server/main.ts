/**
 * The show. One process: MIDI in → engine → DMX out, plus a WebSocket for the HUD.
 *
 *   npm start                 build the HUD, then run (what you do at the gig)
 *   npm run dev               HUD with live reload + server, for development
 *   node src/server/main.ts --dmx fake     no hardware (preview only; --fake is the same)
 *   node src/server/main.ts --dmx usb      straight to the Open DMX over USB (quit QLC+ first)
 *   node src/server/main.ts --dmx serial   straight to the Open DMX over the OS serial driver
 *   node src/server/main.ts --dmx qlc      through QLC+ instead (it must be running, web access on)
 *   (default is --dmx usb: straight to the Open DMX; QLC+ must NOT be running)
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { WebSocketServer, type WebSocket } from "ws";
import { RIG } from "../config.ts";
import { DmxManager } from "../dmx/dmxManager.ts";
import { writeFrame } from "../dmx/fixtures.ts";
import { Engine } from "../engine/engine.ts";
import { LIGHT_IDS } from "../engine/rig.ts";
import { MINILAB_MAPPING } from "../midi/mapping.ts";
import { MidiInput } from "../midi/midiInput.ts";
import { MiniLabDisplay } from "../midi/minilabDisplay.ts";
import { SetlistScreen } from "../midi/minilabScreen.ts";
import { SETLIST } from "../setlist.ts";
import { loadAutosave, saveAutosave } from "./autosave.ts";
import {
  applyPresets,
  exportSetlist,
  loadPresets,
  savePresets,
  withoutPreset,
  withPreset,
} from "./presets.ts";
import {
  DEFAULT_PORT,
  EXPORT_PATH,
  WS_PATH,
  type ServerMessage,
} from "./protocol.ts";
import { isAllowedOrigin, parseClientMessage } from "./validate.ts";

const { values: args } = parseArgs({
  options: {
    fake: { type: "boolean", default: false },
    dmx: { type: "string", default: "usb" },
    port: { type: "string", default: String(DEFAULT_PORT) },
    "no-caffeinate": { type: "boolean", default: false },
    // Listen on the network (e.g. for a future iPad remote). Off by default: anyone on
    // the bar's Wi-Fi could otherwise drive the lights.
    lan: { type: "boolean", default: false },
    // Leave the MiniLab's screen alone (and the MiniLab out of its "DAW connected" mode).
    "no-screen": { type: "boolean", default: false },
  },
});
const port = Number(args.port);
const host = args.lan ? "0.0.0.0" : "127.0.0.1";
// Pages allowed to open the WebSocket: this app (and the Vite dev server) on this laptop,
// plus — only with --lan — the same app reached via this laptop's own network addresses
// (what a tablet's browser would send). Any other website is refused either way.
const ownHosts = [
  "localhost",
  "127.0.0.1",
  ...(args.lan
    ? Object.values(networkInterfaces())
        .flat()
        .filter((i) => i?.family === "IPv4" && !i.internal)
        .map((i) => i!.address)
    : []),
];
const ALLOWED_ORIGINS = [port, 5173].flatMap((p) =>
  ownHosts.map((h) => `http://${h}:${p}`),
);

const FRAME_MS = 1000 / 30;
const AUTOSAVE_MS = 3000;
const HUD_DIR = path.join(import.meta.dirname, "..", "..", "dist", "hud");
const now = () => performance.now();

// ── engine + devices ─────────────────────────────────────────────────────────────

// The setlist the show uses: the repo's src/setlist.json with any presets saved on site
// (state/presets.json) layered on top.
let presets = await loadPresets();
const presetCount = Object.keys(presets.songs).length;
if (presetCount)
  console.log(`[presets] ${presetCount} song preset(s) saved on site`);

const engine = new Engine({
  setlist: applyPresets(SETLIST, presets),
  maxStrobe: RIG.maxStrobe,
});
const saved = await loadAutosave();
if (saved) {
  engine.restore(saved, now());
  console.log("[state] restored autosave");
}

const backend = args.fake ? "fake" : args.dmx;
if (
  backend !== "qlc" &&
  backend !== "usb" &&
  backend !== "serial" &&
  backend !== "fake"
) {
  console.error(`Unknown --dmx "${backend}". Use qlc, usb, serial or fake.`);
  process.exit(1);
}
const dmx = new DmxManager({ backend, fps: RIG.fps });
await dmx.start();

const midi = new MidiInput({
  mapping: MINILAB_MAPPING,
  onAction: (a) => engine.dispatch(a, now()),
});
midi.start();

// Song names on the MiniLab's screen, above the big knob.
const screen = args["no-screen"] ? null : new MiniLabDisplay();
const screenText = new SetlistScreen();
screen?.start();

// Keep the Mac awake for as long as this process runs (macOS only).
if (process.platform === "darwin" && !args["no-caffeinate"]) {
  spawn("caffeinate", ["-dims", "-w", String(process.pid)], {
    stdio: "ignore",
  }).unref();
}

// ── HTTP (serves the built HUD) + WebSocket ──────────────────────────────────────

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === EXPORT_PATH) {
    // The setlist with on-site saves merged in, ready to replace src/setlist.json.
    res
      .writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="setlist.json"',
        "cache-control": "no-store",
      })
      .end(exportSetlist(engine.setlist));
    return;
  }
  const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const file = path.join(HUD_DIR, path.normalize(rel));
  if (!file.startsWith(HUD_DIR)) return void res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res
      .writeHead(200, {
        "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
      })
      .end(body);
  } catch {
    res
      .writeHead(404, { "content-type": "text/plain" })
      .end(
        "HUD not built. Run `npm start` (or `npm run build:hud`), or use `npm run dev`.",
      );
  }
});

const wss = new WebSocketServer({
  server,
  path: WS_PATH,
  // Blocks other websites open in a browser from quietly driving the lights.
  verifyClient: ({ origin }: { origin?: string }) =>
    isAllowedOrigin(origin, ALLOWED_ORIGINS),
});
const send = (ws: WebSocket, msg: ServerMessage) =>
  ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg));

wss.on("connection", (ws) => {
  send(ws, {
    type: "hello",
    looks: engine.looks.map((l) => ({
      id: l.id,
      name: l.name,
      spooky: l.spooky ?? false,
    })),
    palettes: engine.palettes.map((p) => ({
      id: p.id,
      name: p.name,
      colors: p.colors.map((c) => [c.r, c.g, c.b] as [number, number, number]),
    })),
    setlist: engine.setlist,
    lights: LIGHT_IDS,
  });
  ws.on("message", (raw) => {
    const msg = parseClientMessage(String(raw));
    if (!msg) return;
    if (msg.type === "action") engine.dispatch(msg.action, now());
    else if (msg.type === "audio") engine.setAudio(msg, now());
    else if (msg.type === "preset-save") void savePreset();
    else if (msg.type === "preset-reset") void resetPreset();
  });
});

const LEVEL_NAMES = { low: "Low", mid: "Mid", high: "High" } as const;

function notify(text: string, tone: "ok" | "warn" = "ok"): void {
  const json = JSON.stringify({
    type: "notice",
    text,
    tone,
  } satisfies ServerMessage);
  for (const ws of wss.clients) if (ws.readyState === ws.OPEN) ws.send(json);
  console.log(`[presets] ${text}`);
}

/** ⌘S: make the current settings the loaded song's preset (saved on this laptop). */
async function savePreset(): Promise<void> {
  const index = engine.setlistLoaded;
  const song = index === null ? undefined : engine.setlist[index];
  if (!song) {
    notify("Load a song first (click the big knob), then save.", "warn");
    return;
  }
  // Saves the version of the song the Energy fader is in, and keeps the other two.
  const level = engine.editingLevel;
  const existing = presets.songs[song.name] ?? {};
  presets = withPreset(
    presets,
    song.name,
    level === "mid"
      ? { ...existing, ...engine.capture() }
      : { ...existing, [level]: engine.captureLevel(level) },
  );
  try {
    await savePresets(presets);
    engine.setSetlist(applyPresets(SETLIST, presets));
    notify(`Saved “${song.name}” (${LEVEL_NAMES[level]})`);
  } catch (err) {
    notify(
      `Couldn't save: ${err instanceof Error ? err.message : err}`,
      "warn",
    );
  }
}

/** Forget the loaded song's on-site preset and reload the repo's default for it. */
async function resetPreset(): Promise<void> {
  const index = engine.setlistLoaded;
  const song = index === null ? undefined : engine.setlist[index];
  if (!song) {
    notify("Load a song first (click the big knob), then reset.", "warn");
    return;
  }
  if (!presets.songs[song.name]) {
    notify(`“${song.name}” is already the default.`);
    return;
  }
  presets = withoutPreset(presets, song.name);
  try {
    await savePresets(presets);
    engine.setSetlist(applyPresets(SETLIST, presets));
    engine.loadSong(index!, now());
    notify(`Reset “${song.name}” to the default`);
  } catch (err) {
    notify(
      `Couldn't reset: ${err instanceof Error ? err.message : err}`,
      "warn",
    );
  }
}

server.listen(port, host, () =>
  console.log(
    `[hud] http://localhost:${port}${args.lan ? " (also on the network)" : ""}`,
  ),
);

// ── the frame loop ──────────────────────────────────────────────────────────────

const frameTimer = setInterval(() => {
  const t = now();
  const frame = engine.render(t);
  writeFrame(frame, RIG, dmx.universe);
  const status = engine.status(t);
  screen?.show(...screenText.text(status.setlist, t));

  if (wss.clients.size === 0) return;
  const msg: ServerMessage = {
    type: "state",
    lights: frame.lights.map((c) => [round3(c.r), round3(c.g), round3(c.b)]),
    strobe: frame.strobe,
    status,
    devices: { dmx: dmx.status, midi: midi.status },
  };
  const json = JSON.stringify(msg);
  for (const ws of wss.clients) if (ws.readyState === ws.OPEN) ws.send(json);
}, FRAME_MS);

let lastSaved = "";
const saveTimer = setInterval(() => void autosave(), AUTOSAVE_MS);
async function autosave(): Promise<void> {
  const snapshot = engine.snapshot();
  const json = JSON.stringify(snapshot);
  if (json === lastSaved) return; // nothing changed
  lastSaved = json;
  await saveAutosave(snapshot).catch((err) =>
    console.log(`[state] autosave failed: ${err}`),
  );
}

// ── shutdown ────────────────────────────────────────────────────────────────────

let stopping = false;
async function shutdown(): Promise<void> {
  if (stopping) process.exit(1); // second Ctrl-C: just go
  stopping = true;
  console.log("\n[server] stopping… (the lights hold their last look)");
  clearInterval(frameTimer);
  clearInterval(saveTimer);
  await autosave();
  midi.stop();
  await screen?.stop();
  wss.close();
  server.close();
  await dmx.stop();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
