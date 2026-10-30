import type { Song, SongSettings } from "../songs.ts";
import type { Action, FaderId, HitId, KnobId } from "./actions.ts";
import { BeatClock } from "./clock.ts";
import {
  adjust,
  BLACK,
  clamp01,
  mix,
  scale,
  screenMax,
  WHITE,
  type Rgb,
} from "./color.ts";
import type { Look, LookContext } from "./look.ts";
import { pick } from "./look.ts";
import { LOOKS } from "./looks/index.ts";
import { lightningAt } from "./looks/spooky.ts";
import { PALETTES, type Palette } from "./palettes.ts";
import {
  GEOMETRIES,
  LIGHT_COUNT,
  positions,
  sideOf,
  stepCount,
  type Geometry,
} from "./rig.ts";

/** Speed knob steps, as multiples of the beat. */
export const SPEED_STEPS = [0.25, 0.5, 1, 2, 4] as const;
/** Fade knob steps: crossfade length in beats. */
export const FADE_STEPS = [0, 0.25, 0.5, 1, 2, 4] as const;
/** Encoder ticks per step for stepped knobs. Tune once the probe shows real tick rates. */
export const TICKS_PER_STEP = 4;
/** Fine knobs: how far one encoder tick moves the value. */
const FINE_TICK = {
  hue: 1 / 96,
  saturation: 0.01,
  width: 0.01,
  sensitivity: 0.01,
} as const;

const KICK_DECAY_MS = 160;
const AUDIO_STALE_MS = 1000;

/** One rendered moment: what the lights should be doing. */
export interface Frame {
  /** One colour per light, channels clamped 0–1, brightness baked in. */
  lights: Rgb[];
  /** Hardware strobe, 0 = off, otherwise 0–1 slow → fast (already safety-capped). */
  strobe: number;
}

/** Everything the operator has set. This is what gets autosaved. */
export interface Controls {
  lookIndex: number;
  /** From key velocity: how hard the look was played. */
  lookIntensity: number;
  paletteIndex: number;
  /** Hue rotation in turns (0–1). */
  hue: number;
  /** 0 = washed to white, 1 = palette as designed. */
  saturation: number;
  speedIndex: number;
  fadeIndex: number;
  geometry: Geometry;
  width: number;
  /** Mic gain knob, 0–1 (0.5 = unity). */
  sensitivity: number;
  master: number;
  left: number;
  right: number;
  audio: number;
  swell: number;
  spotlight: number | null;
}

export interface Snapshot {
  version: 1;
  controls: Controls;
  bpm: number;
  setlistCursor: number;
  setlistLoaded: number | null;
}

export interface EngineOptions {
  setlist?: readonly Song[];
  bpm?: number;
  /** Highest strobe rate allowed (0–1 of the fixture's range). Photosensitivity safety. */
  maxStrobe?: number;
  now?: number;
  looks?: readonly Look[];
  palettes?: readonly Palette[];
}

export const DEFAULT_CONTROLS: Readonly<Controls> = Object.freeze({
  lookIndex: 0,
  lookIntensity: 0.8,
  paletteIndex: 0,
  hue: 0,
  saturation: 1,
  speedIndex: 2,
  fadeIndex: 3,
  geometry: "linear",
  width: 0.4,
  sensitivity: 0.5,
  master: 0.7, // start pleasant, not blinding
  left: 1,
  right: 1,
  audio: 0,
  swell: 0,
  spotlight: null,
});

interface HeldHit {
  pressure: number;
  since: number;
}

export class Engine {
  readonly clock: BeatClock;
  readonly looks: readonly Look[];
  readonly palettes: readonly Palette[];
  readonly maxStrobe: number;
  #setlist: readonly Song[];

  controls: Controls = { ...DEFAULT_CONTROLS };
  setlistCursor = 0;
  setlistLoaded: number | null = null;

  #held = new Map<HitId, HeldHit>();
  #bumpIndex = 0;
  #knobRemainder: Partial<Record<KnobId, number>> = {};
  /** The look we're fading away from, if a crossfade is running. */
  #fadeFrom: { lookIndex: number; intensity: number } | null = null;
  #fadeStartBeat = 0;
  #fadeBeats = 0;
  #audio = { level: 0, bass: 0, at: -Infinity };
  #kickAt = -Infinity;
  #bassEnv = 0;
  #lastRender: number | undefined;

  constructor(opts: EngineOptions = {}) {
    const now = opts.now ?? performance.now();
    this.clock = new BeatClock(opts.bpm ?? 120, now);
    this.looks = opts.looks ?? LOOKS;
    this.palettes = opts.palettes ?? PALETTES;
    this.#setlist = opts.setlist ?? [];
    this.maxStrobe = opts.maxStrobe ?? 1;
  }

  get setlist(): readonly Song[] {
    return this.#setlist;
  }

  /** Swap in a new setlist (e.g. after a preset is saved). Keeps the position in the set. */
  setSetlist(setlist: readonly Song[]): void {
    this.#setlist = setlist;
    this.setlistCursor = clampIndex(this.setlistCursor, setlist.length);
    if (this.setlistLoaded !== null && this.setlistLoaded >= setlist.length)
      this.setlistLoaded = null;
  }

  /**
   * The current settings as a song preset: what ⌘S saves. Real values (ids, beats), so the
   * preset survives looks being reordered or speed steps being added.
   */
  capture(): SongSettings & { bpm: number } {
    const c = this.controls;
    return {
      bpm: Math.round(this.clock.bpm * 10) / 10,
      look: this.looks[c.lookIndex]?.id,
      palette: this.palettes[c.paletteIndex]?.id,
      hue: round3(c.hue),
      saturation: round3(c.saturation),
      speed: SPEED_STEPS[c.speedIndex]!,
      fade: FADE_STEPS[c.fadeIndex]!,
      geometry: c.geometry,
      width: round3(c.width),
      swell: round3(c.swell),
    };
  }

  /** Load a song's preset (tempo, look, palette, dials, swell) and point "next" past it. */
  loadSong(index: number, now: number): void {
    const song = this.#setlist[index];
    if (!song) return;
    if (song.bpm) this.clock.setBpm(song.bpm, now);
    this.#applySettings(song, now);
    this.setlistLoaded = index;
    this.setlistCursor = clampIndex(index + 1, this.#setlist.length);
  }

  // ── input ────────────────────────────────────────────────────────────────────

  dispatch(action: Action, now: number): void {
    switch (action.type) {
      case "look":
        this.#setLook(action.index, action.velocity, now);
        break;
      case "hit":
        if (action.down) {
          const existing = this.#held.get(action.hit);
          if (!existing && action.hit === "color-bump") this.#bumpIndex++;
          this.#held.set(action.hit, {
            pressure: action.pressure ?? existing?.pressure ?? 0.5,
            since: existing?.since ?? now,
          });
        } else {
          this.#held.delete(action.hit);
        }
        break;
      case "knob":
        this.#turn(action.knob, action.delta);
        break;
      case "fader":
        this.controls[action.fader satisfies FaderId] = clamp01(action.value);
        break;
      case "spotlight":
        this.controls.spotlight =
          action.value === null ? null : clamp01(action.value);
        break;
      case "swell":
        this.controls.swell = clamp01(action.value);
        break;
      case "tap":
        this.clock.tap(now);
        break;
      case "setlist-move":
        this.setlistCursor = clampIndex(
          this.setlistCursor + action.delta,
          this.setlist.length,
        );
        break;
      case "setlist-load":
        this.loadSong(this.setlistCursor, now);
        break;
    }
  }

  /**
   * Feed one analysis frame from the HUD's microphone. Values are raw 0–1;
   * the sensitivity knob is applied here so the browser stays dumb.
   */
  setAudio(
    input: { level: number; bass: number; kick: boolean },
    now: number,
  ): void {
    const gain = 2 ** (this.controls.sensitivity * 4 - 2); // 0.25× … 4×
    this.#audio = {
      level: clamp01(input.level * gain),
      bass: clamp01(input.bass * gain),
      at: now,
    };
    if (input.kick) this.#kickAt = now;
  }

  // ── output ───────────────────────────────────────────────────────────────────

  render(now: number): Frame {
    const dt =
      this.#lastRender === undefined ? 0 : Math.max(0, now - this.#lastRender);
    this.#lastRender = now;
    const c = this.controls;
    const ctx = this.#context(now);

    // Layer 1: the look (crossfading from the previous one if needed).
    let lights = this.#renderLook(c.lookIndex, c.lookIntensity, ctx);
    if (this.#fadeFrom) {
      const t =
        this.#fadeBeats <= 0
          ? 1
          : (this.clock.beats(now) - this.#fadeStartBeat) / this.#fadeBeats;
      if (t >= 1) {
        this.#fadeFrom = null;
      } else {
        const from = this.#renderLook(
          this.#fadeFrom.lookIndex,
          this.#fadeFrom.intensity,
          ctx,
        );
        const k = clamp01(t);
        lights = lights.map((to, i) => mix(from[i]!, to, k));
      }
    }

    // Layer 2: modifiers.
    lights = this.#applyAudio(lights, now, dt);
    if (c.swell > 0)
      lights = lights.map((col) =>
        mix(col, fullBrightness(col, ctx.colors), c.swell),
      );
    if (c.spotlight !== null)
      lights = this.#applySpotlight(lights, c.spotlight);
    lights = lights.map((col, i) =>
      scale(col, sideOf(i) === "L" ? c.left : c.right),
    );

    // Layer 3: hits — momentary overrides, later entries win.
    let strobe = 0;
    const held = (id: HitId) => this.#held.get(id);
    if (held("color-bump")) {
      const bump = pick(ctx.colors, this.#bumpIndex);
      lights = lights.map(() => bump);
    }
    for (const [hit, side] of [
      ["left-flash", "L"],
      ["right-flash", "R"],
    ] as const) {
      if (held(hit))
        lights = lights.map((col, i) => (sideOf(i) === side ? WHITE : col));
    }
    if (held("lightning")) {
      lights = lights.map((_, i) =>
        scale(WHITE, lightningAt(ctx.time, i, 0.55)),
      );
    }
    if (held("white-flash")) lights = lights.map(() => WHITE);
    const strobeHit = held("strobe");
    if (strobeHit) {
      lights = lights.map(() => WHITE);
      // Pressure picks a point along the strobe range (light press = slowest usable flash).
      strobe = Math.max(0.02, strobeHit.pressure) * this.maxStrobe;
    }
    if (held("blackout")) {
      lights = lights.map(() => BLACK);
      strobe = 0;
    }

    // Grand master on top of everything.
    lights = lights.map((col) => ({
      r: clamp01(col.r * c.master),
      g: clamp01(col.g * c.master),
      b: clamp01(col.b * c.master),
    }));
    return { lights, strobe };
  }

  /** What the HUD shows. Plain data, safe to JSON-serialize every frame. */
  status(now: number) {
    const c = this.controls;
    const song = (i: number | null) =>
      i === null ? null : (this.setlist[i] ?? null);
    return {
      look: this.looks[c.lookIndex]?.name ?? "?",
      lookIndex: c.lookIndex,
      palette: this.palettes[c.paletteIndex]?.name ?? "?",
      paletteIndex: c.paletteIndex,
      bpm: Math.round(this.clock.bpm * 10) / 10,
      beatOfBar: this.clock.beatOfBar(now),
      beatPhase: this.clock.phase(now),
      tapCount: this.clock.tapCount(now),
      speed: SPEED_STEPS[c.speedIndex]!,
      fadeBeats: FADE_STEPS[c.fadeIndex]!,
      geometry: c.geometry,
      width: c.width,
      hue: c.hue,
      saturation: c.saturation,
      sensitivity: c.sensitivity,
      /** Pitch strip: spotlight position across the stage 0–1, or null when released. */
      spotlight: c.spotlight,
      /** Mod strip: brightness swell 0–1. */
      swell: c.swell,
      faders: {
        master: c.master,
        left: c.left,
        right: c.right,
        audio: c.audio,
      },
      hits: [...this.#held.keys()],
      audio: {
        level: this.#audio.level,
        bass: this.#bassEnv,
        kick: now - this.#kickAt < KICK_DECAY_MS,
      },
      setlist: {
        cursor: this.setlistCursor,
        loaded: this.setlistLoaded,
        current: song(this.setlistLoaded),
        next: song(this.setlistCursor),
        length: this.setlist.length,
      },
    };
  }

  // ── persistence ──────────────────────────────────────────────────────────────

  snapshot(): Snapshot {
    return {
      version: 1,
      controls: { ...this.controls },
      bpm: this.clock.bpm,
      setlistCursor: this.setlistCursor,
      setlistLoaded: this.setlistLoaded,
    };
  }

  /** Restore an autosave. Tolerates saves from older versions (missing fields → defaults). */
  restore(snapshot: Partial<Snapshot>, now: number): void {
    const controls = { ...DEFAULT_CONTROLS, ...snapshot.controls };
    controls.lookIndex = clampIndex(controls.lookIndex, this.looks.length);
    controls.paletteIndex = clampIndex(
      controls.paletteIndex,
      this.palettes.length,
    );
    controls.speedIndex = clampIndex(controls.speedIndex, SPEED_STEPS.length);
    controls.fadeIndex = clampIndex(controls.fadeIndex, FADE_STEPS.length);
    if (!GEOMETRIES.includes(controls.geometry))
      controls.geometry = DEFAULT_CONTROLS.geometry;
    this.controls = controls;
    if (snapshot.bpm) this.clock.setBpm(snapshot.bpm, now);
    this.setlistCursor = clampIndex(
      snapshot.setlistCursor ?? 0,
      this.setlist.length,
    );
    this.setlistLoaded = snapshot.setlistLoaded ?? null;
  }

  // ── internals ────────────────────────────────────────────────────────────────

  #context(now: number): LookContext {
    const c = this.controls;
    const palette = this.palettes[c.paletteIndex] ?? this.palettes[0]!;
    const stale = now - this.#audio.at > AUDIO_STALE_MS;
    return {
      beats: this.clock.beats(now) * SPEED_STEPS[c.speedIndex]!,
      time: now / 1000,
      colors: palette.colors.map((col) => adjust(col, c.hue, c.saturation)),
      width: c.width,
      geometry: c.geometry,
      pos: positions(c.geometry),
      side: Array.from({ length: LIGHT_COUNT }, (_, i) => sideOf(i)),
      steps: stepCount(c.geometry),
      audio: stale
        ? { level: 0, bass: 0 }
        : { level: this.#audio.level, bass: this.#audio.bass },
    };
  }

  #renderLook(index: number, intensity: number, ctx: LookContext): Rgb[] {
    const out: Rgb[] = Array.from({ length: LIGHT_COUNT }, () => ({
      ...BLACK,
    }));
    this.looks[index]?.render(ctx, out);
    return out.map((col) => scale(col, intensity));
  }

  #setLook(index: number, velocity: number | undefined, now: number): void {
    if (index < 0 || index >= this.looks.length) return;
    const c = this.controls;
    // Soft keys still read: velocity 0 → 40% intensity, full hit → 100%.
    const intensity =
      velocity === undefined ? c.lookIntensity : 0.4 + 0.6 * clamp01(velocity);
    if (index !== c.lookIndex) {
      this.#fadeFrom = { lookIndex: c.lookIndex, intensity: c.lookIntensity };
      this.#fadeStartBeat = this.clock.beats(now);
      this.#fadeBeats = FADE_STEPS[c.fadeIndex]!;
    }
    c.lookIndex = index;
    c.lookIntensity = intensity;
  }

  #turn(knob: KnobId, delta: number): void {
    const c = this.controls;
    if (knob in FINE_TICK) {
      const amount = delta * FINE_TICK[knob as keyof typeof FINE_TICK];
      if (knob === "hue") c.hue = (((c.hue + amount) % 1) + 1) % 1;
      else
        c[knob as "saturation" | "width" | "sensitivity"] = clamp01(
          c[knob as "width"] + amount,
        );
      return;
    }
    // Stepped knobs: accumulate ticks so a small nudge doesn't skip several steps.
    const total = (this.#knobRemainder[knob] ?? 0) + delta;
    const steps = Math.trunc(total / TICKS_PER_STEP);
    this.#knobRemainder[knob] = total - steps * TICKS_PER_STEP;
    if (steps === 0) return;
    switch (knob) {
      case "speed":
        c.speedIndex = clampIndex(c.speedIndex + steps, SPEED_STEPS.length);
        break;
      case "fade":
        c.fadeIndex = clampIndex(c.fadeIndex + steps, FADE_STEPS.length);
        break;
      case "palette": // wraps: scrolling past the last palette comes back to the first
        c.paletteIndex = wrapIndex(
          c.paletteIndex + steps,
          this.palettes.length,
        );
        break;
      case "geometry":
        c.geometry =
          GEOMETRIES[
            wrapIndex(GEOMETRIES.indexOf(c.geometry) + steps, GEOMETRIES.length)
          ]!;
        break;
    }
  }

  #applyAudio(lights: Rgb[], now: number, dt: number): Rgb[] {
    // Envelope follower: snap up fast, fall back slowly, so pulses read as pulses.
    const target = now - this.#audio.at > AUDIO_STALE_MS ? 0 : this.#audio.bass;
    const rate = target > this.#bassEnv ? 0.6 : 1 - Math.exp(-dt / 180);
    this.#bassEnv += (target - this.#bassEnv) * rate;

    const amount = this.controls.audio;
    if (amount <= 0) return lights;
    const kick = Math.exp((-(now - this.#kickAt) / KICK_DECAY_MS) * 3);
    const gain =
      1 - amount + amount * (0.2 + 0.8 * this.#bassEnv) + amount * 0.5 * kick;
    return lights.map((col) => scale(col, gain));
  }

  #applySpotlight(lights: Rgb[], at: number): Rgb[] {
    const pos = positions("linear"); // the strip is physically left → right
    return lights.map((col, i) => {
      const d = (pos[i]! - at) / 0.12;
      return screenMax(col, scale(WHITE, Math.exp(-d * d)));
    });
  }

  /** Apply whatever a preset mentions; leave everything else as the operator has it. */
  #applySettings(s: SongSettings, now: number): void {
    const c = this.controls;
    const pal = this.palettes.findIndex((p) => p.id === s.palette);
    if (pal >= 0) c.paletteIndex = pal;
    if (s.hue !== undefined) c.hue = clamp01(s.hue);
    if (s.saturation !== undefined) c.saturation = clamp01(s.saturation);
    if (s.width !== undefined) c.width = clamp01(s.width);
    if (s.swell !== undefined) c.swell = clamp01(s.swell);
    if (s.speed !== undefined)
      c.speedIndex = nearestIndex(SPEED_STEPS, s.speed);
    if (s.fade !== undefined) c.fadeIndex = nearestIndex(FADE_STEPS, s.fade);
    if (s.geometry && GEOMETRIES.includes(s.geometry)) c.geometry = s.geometry;
    // Look last, so its crossfade uses the preset's fade length.
    if (s.look) {
      const lookIndex = this.looks.findIndex((l) => l.id === s.look);
      if (lookIndex >= 0) this.#setLook(lookIndex, undefined, now);
    }
  }
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Index of the step closest to `value` (e.g. a saved speed of 2 → the "2×" step). */
function nearestIndex(steps: readonly number[], value: number): number {
  let best = 0;
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(steps[i]! - value) < Math.abs(steps[best]! - value)) best = i;
  }
  return best;
}

/** The same hue at full brightness — what the swell strip pushes toward. */
function fullBrightness(col: Rgb, colors: readonly Rgb[]): Rgb {
  const peak = Math.max(col.r, col.g, col.b);
  if (peak < 0.02) return colors[0] ?? WHITE;
  return scale(col, 1 / peak);
}

const clampIndex = (i: number, length: number) =>
  Math.max(0, Math.min(length - 1, Math.round(i)));
const wrapIndex = (i: number, length: number) =>
  ((i % length) + length) % length;
