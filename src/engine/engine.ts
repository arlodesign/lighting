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
import {
  balanceGains,
  blendFeel,
  blendLevels,
  blendPosition,
  deriveLevel,
  editingLevel,
  LEVEL_FIELDS,
  pickLevel,
  type Level,
  type LevelId,
  type LevelOverrides,
} from "./energy.ts";
import { PALETTES, vary, type Palette } from "./palettes.ts";
import {
  GEOMETRIES,
  LIGHT_COUNT,
  positions,
  sideOf,
  stepCount,
  type Geometry,
} from "./rig.ts";

/** Speed knob steps, as multiples of the beat. */
export const SPEED_STEPS = [0.25, 0.5, 1, 2, 4, 8] as const;
/** Fade knob steps: crossfade length in beats. */
export const FADE_STEPS = [0, 0.25, 0.5, 1, 2, 4] as const;

/** Counts in one full sweep of a MiniLab knob (its 0–127 range). */
export const KNOB_SWEEP = 127;

/**
 * How each knob responds to turning, in MiniLab counts.
 * - Knobs with ends: one full sweep covers the whole range, so they feel the same
 *   everywhere. Stepped ones (speed, fade) spread their steps evenly across the sweep.
 * - Wrapping knobs (hue, palette, shape) are endless; shape has few options, so it takes
 *   about a quarter sweep per option and feels like clicking through positions.
 */
export const KNOB_FEEL = {
  speed: { steps: KNOB_SWEEP / (SPEED_STEPS.length - 1) },
  fade: { steps: KNOB_SWEEP / (FADE_STEPS.length - 1) },
  palette: { steps: 4 },
  geometry: { steps: 30 },
  hue: { perCount: 1 / 96 },
  saturation: { perCount: 1 / KNOB_SWEEP },
  width: { perCount: 1 / KNOB_SWEEP },
  variety: { perCount: 1 / KNOB_SWEEP },
} as const satisfies Record<KnobId, { steps: number } | { perCount: number }>;

/** Counts needed to move a stepped knob by one step (handy for tests and the preview). */
export function countsPerStep(knob: KnobId): number {
  const feel = KNOB_FEEL[knob];
  return "steps" in feel ? Math.ceil(feel.steps) : 1;
}

const KICK_DECAY_MS = 160;
const AUDIO_STALE_MS = 1000;
/** How quickly the strobe rate follows pad pressure (time constant). */
const STROBE_SMOOTH_MS = 150;

// Automatic mic leveling: the gain aims to keep the room's typical loudness at
// LEVEL_TARGET. It catches up with a louder room in a couple of seconds, and backs off
// slowly when the room goes quiet, so a breakdown still reads as quieter for a while.
const LEVEL_TARGET = 0.5;
const LEVEL_ATTACK_MS = 2000;
const LEVEL_RELEASE_MS = 12000;
/** Never boost more than this, so a silent room stays dark instead of amplifying hiss. */
const LEVEL_MAX_GAIN = 4;
const LEVEL_MIN_GAIN = 0.5;

// Energy autopilot: loudness over a few seconds compared with over the last minute.
const ENERGY_SHORT_MS = 4000;
const ENERGY_LONG_MS = 60000;
/** How far the autopilot can push Energy (0–1 of the fader) with the Audio fader all the way up. */
const ENERGY_NUDGE = 0.3;

function followLoudness(ref: number, x: number, dt: number): number {
  const tau = x > ref ? LEVEL_ATTACK_MS : LEVEL_RELEASE_MS;
  return ref + (x - ref) * (1 - Math.exp(-dt / tau));
}

const autoGain = (loudness: number) =>
  Math.min(
    LEVEL_MAX_GAIN,
    Math.max(LEVEL_MIN_GAIN, LEVEL_TARGET / Math.max(loudness, 1e-3)),
  );

/** One rendered moment: what the lights should be doing. */
export interface Frame {
  /** One color per light, channels clamped 0–1, brightness baked in. */
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
  /** Color scheme spread 0–1: monochrome → analogous → triadic → complementary. */
  variety: number;
  master: number;
  /** Fader 2: 0 = the song's Low (verse) version, 0.5 = Mid, 1 = High (chorus). */
  energy: number;
  /** Fader 3: 0.5 = both sides full; toward 0 fades the right side out, toward 1 the left. */
  balance: number;
  audio: number;
  swell: number;
  spotlight: number | null;
}

export interface Snapshot {
  version: 1;
  controls: Controls;
  /** What was changed in the Low and High versions of the song (on top of Mid). */
  levels?: { low: LevelOverrides; high: LevelOverrides };
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
  variety: 1 / 3, // analogous
  master: 0.7, // start pleasant, not blinding
  energy: 0.5,
  balance: 0.5,
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
  /** The palette's colors we're fading away from (raw, before hue/saturation). */
  #paletteFrom: {
    colors: readonly Rgb[];
    startBeat: number;
    beats: number;
  } | null = null;
  /** Strobe pressure after smoothing; null while the pad is up. */
  #strobePressure: number | null = null;
  /** What was changed in the song's Low and High versions (Mid lives in `controls`). */
  #overrides: { low: LevelOverrides; high: LevelOverrides } = {
    low: {},
    high: {},
  };
  /** The look and palette on the lights at the last render, to notice changes and fade. */
  #shown: { lookIndex: number; paletteIndex: number };
  /** Room loudness over a few seconds vs. over a minute: the Energy autopilot. */
  #energyLoudness = { short: 0, long: 0 };
  #audio = { level: 0, bass: 0, at: -Infinity };
  /** Slow-moving loudness of the room, for automatic mic leveling. */
  #loudness = { level: LEVEL_TARGET, bass: LEVEL_TARGET };
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
    this.#shown = this.#shownNow(now);
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
    return {
      bpm: Math.round(this.clock.bpm * 10) / 10,
      ...this.#toSettings(this.controls),
      swell: round3(this.controls.swell),
    };
  }

  /** What's been changed in the song's Low or High version, as preset values. */
  captureLevel(id: "low" | "high"): SongSettings {
    return this.#toSettings(this.#overrides[id]);
  }

  /** The version of the song the knobs and keys (and ⌘S) are working on. */
  get editingLevel(): LevelId {
    return editingLevel(this.controls.energy);
  }

  /** One version of the song: Mid as set, or Low/High worked out from Mid plus changes. */
  level(id: LevelId): Level {
    const mid = pickLevel(this.controls);
    if (id === "mid") return mid;
    return {
      ...deriveLevel(mid, id, SPEED_STEPS.length),
      ...this.#overrides[id],
    };
  }

  /** Load a song's preset (tempo, look, palette, dials, swell) and point "next" past it. */
  loadSong(index: number, now: number): void {
    const song = this.#setlist[index];
    if (!song) return;
    if (song.bpm) this.clock.setBpm(song.bpm, now);
    this.#applySettings(song);
    this.setlistLoaded = index;
    this.setlistCursor = clampIndex(index + 1, this.#setlist.length);
  }

  // ── input ────────────────────────────────────────────────────────────────────

  dispatch(action: Action, now: number): void {
    switch (action.type) {
      case "look":
        this.#setLook(action.index, action.velocity);
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
   * Feed one analysis frame from the HUD's microphone. Values are raw 0–1. The engine
   * levels them itself (so the browser stays dumb): a slow loudness tracker sets the gain,
   * so a quiet song and a loud one both drive the lights the same way.
   */
  setAudio(
    input: { level: number; bass: number; kick: boolean },
    now: number,
  ): void {
    const dt = Math.min(1000, Math.max(0, now - this.#audio.at));
    this.#loudness.level = followLoudness(
      this.#loudness.level,
      input.level,
      dt,
    );
    this.#loudness.bass = followLoudness(this.#loudness.bass, input.bass, dt);
    const el = this.#energyLoudness;
    el.short +=
      (input.level - el.short) * (1 - Math.exp(-dt / ENERGY_SHORT_MS));
    el.long += (input.level - el.long) * (1 - Math.exp(-dt / ENERGY_LONG_MS));
    this.#audio = {
      level: clamp01(input.level * autoGain(this.#loudness.level)),
      bass: clamp01(input.bass * autoGain(this.#loudness.bass)),
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
    const live = this.#live(now);
    this.#startFades(live.level, now);
    const ctx = this.#context(now, live.level);

    // Layer 1: the look (crossfading from the previous one if needed).
    let lights = this.#renderLook(live.level.lookIndex, c.lookIntensity, ctx);
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
    // The swell strip and the Energy level's lift both push toward full brightness.
    const swell = 1 - (1 - c.swell) * (1 - live.feel.lift);
    if (swell > 0)
      lights = lights.map((col) =>
        mix(col, fullBrightness(col, ctx.colors), swell),
      );
    if (live.feel.brightness < 1)
      lights = lights.map((col) => scale(col, live.feel.brightness));
    if (c.spotlight !== null)
      lights = this.#applySpotlight(lights, c.spotlight);
    const sides = balanceGains(c.balance);
    lights = lights.map((col, i) =>
      scale(col, sideOf(i) === "L" ? sides.left : sides.right),
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
      // Smoothed, because aftertouch jitters and each new rate restarts the flash timer.
      const target = Math.max(0.02, strobeHit.pressure);
      this.#strobePressure =
        this.#strobePressure === null
          ? target
          : this.#strobePressure +
            (target - this.#strobePressure) *
              (1 - Math.exp(-dt / STROBE_SMOOTH_MS));
      strobe = this.#strobePressure * this.maxStrobe;
    } else {
      this.#strobePressure = null;
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
    const { level: l, energy } = this.#live(now);
    const song = (i: number | null) =>
      i === null ? null : (this.setlist[i] ?? null);
    return {
      // What's on the lights right now (the Energy fader may be blending versions).
      look: this.looks[l.lookIndex]?.name ?? "?",
      lookIndex: l.lookIndex,
      palette: this.palettes[l.paletteIndex]?.name ?? "?",
      paletteIndex: l.paletteIndex,
      /** The colors in use after the palette fade, Variety, hue and color knobs (0–1 RGB). */
      colors: this.#colors(now, l).map(
        ({ r, g, b }) => [round3(r), round3(g), round3(b)] as const,
      ),
      bpm: Math.round(this.clock.bpm * 10) / 10,
      beatOfBar: this.clock.beatOfBar(now),
      beatPhase: this.clock.phase(now),
      tapCount: this.clock.tapCount(now),
      speed: SPEED_STEPS[l.speedIndex]!,
      fadeBeats: FADE_STEPS[l.fadeIndex]!,
      geometry: l.geometry,
      width: l.width,
      hue: l.hue,
      saturation: l.saturation,
      variety: l.variety,
      /** Pitch strip: spotlight position across the stage 0–1, or null when released. */
      spotlight: c.spotlight,
      /** Mod strip: brightness swell 0–1. */
      swell: c.swell,
      faders: {
        master: c.master,
        energy: c.energy,
        balance: c.balance,
        audio: c.audio,
      },
      energy: {
        /** Where Energy really is, after the autopilot's nudge (0–1). */
        value: energy,
        /** The version of the song the knobs, keys and ⌘S work on. */
        editing: this.editingLevel,
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
      levels: {
        low: { ...this.#overrides.low },
        high: { ...this.#overrides.high },
      },
      bpm: this.clock.bpm,
      setlistCursor: this.setlistCursor,
      setlistLoaded: this.setlistLoaded,
    };
  }

  /** Restore an autosave. Tolerates saves from older versions (missing fields → defaults). */
  restore(snapshot: Partial<Snapshot>, now: number): void {
    const controls = { ...DEFAULT_CONTROLS, ...snapshot.controls };
    Object.assign(controls, this.#validLevel(controls));
    if (!GEOMETRIES.includes(controls.geometry))
      controls.geometry = DEFAULT_CONTROLS.geometry;
    for (const f of ["energy", "balance", "master", "audio", "swell"] as const)
      controls[f] = clamp01(controls[f]);
    this.controls = controls;
    this.#overrides = {
      low: this.#validLevel(snapshot.levels?.low ?? {}),
      high: this.#validLevel(snapshot.levels?.high ?? {}),
    };
    this.#shown = this.#shownNow(now); // a restore shouldn't fade in from the old state
    if (snapshot.bpm) this.clock.setBpm(snapshot.bpm, now);
    this.setlistCursor = clampIndex(
      snapshot.setlistCursor ?? 0,
      this.setlist.length,
    );
    this.setlistLoaded = snapshot.setlistLoaded ?? null;
  }

  /** The colors the looks are using right now: palette (mid-fade), Variety, hue, color. */
  colors(now: number): Rgb[] {
    return this.#colors(now, this.#live(now).level);
  }

  // ── internals ────────────────────────────────────────────────────────────────

  /**
   * What's on the lights right now: the song's Low/Mid/High versions blended by the Energy
   * fader (nudged by the room's loudness when the Audio fader is up).
   */
  #live(now: number): {
    level: Level;
    feel: { brightness: number; lift: number };
    energy: number;
  } {
    const energy = clamp01(this.controls.energy + this.#energyNudge(now));
    const { from, to, t } = blendPosition(energy);
    const level =
      from === to
        ? this.level(from)
        : blendLevels(this.level(from), this.level(to), t);
    return { level, feel: blendFeel(from, to, t), energy };
  }

  /**
   * Energy autopilot: when the room gets louder than it has been over the last minute
   * (a chorus), push Energy up a little; quieter (a verse), down. Scaled by the Audio fader,
   * so it's off when that's down.
   */
  #energyNudge(now: number): number {
    const amount = this.controls.audio;
    const { short, long } = this.#energyLoudness;
    if (amount <= 0 || now - this.#audio.at > AUDIO_STALE_MS || long < 0.02)
      return 0;
    const swing = Math.max(-1, Math.min(1, Math.log2(short / long)));
    return swing * ENERGY_NUDGE * amount;
  }

  /** Start a crossfade whenever the look or palette on the lights changes, whatever changed it. */
  #shownNow(now: number): { lookIndex: number; paletteIndex: number } {
    const { lookIndex, paletteIndex } = this.#live(now).level;
    return { lookIndex, paletteIndex };
  }

  #startFades(live: Level, now: number): void {
    const shown = this.#shown;
    this.#shown = {
      lookIndex: live.lookIndex,
      paletteIndex: live.paletteIndex,
    };
    const beats = FADE_STEPS[live.fadeIndex]!;
    if (live.lookIndex !== shown.lookIndex) {
      this.#fadeFrom = {
        lookIndex: shown.lookIndex,
        intensity: this.controls.lookIntensity,
      };
      this.#fadeStartBeat = this.clock.beats(now);
      this.#fadeBeats = beats;
    }
    if (live.paletteIndex !== shown.paletteIndex) {
      this.#paletteFrom = {
        // Start from what was showing, so changing again mid-fade doesn't jump.
        colors: this.#paletteColors(now, shown.paletteIndex),
        startBeat: this.clock.beats(now),
        beats,
      };
    }
  }

  #colors(now: number, l: Level): Rgb[] {
    return vary(this.#paletteColors(now, l.paletteIndex), l.variety).map(
      (col) => adjust(col, l.hue, l.saturation),
    );
  }

  #context(now: number, l: Level): LookContext {
    const stale = now - this.#audio.at > AUDIO_STALE_MS;
    const beats = this.clock.beats(now) * SPEED_STEPS[l.speedIndex]!;
    return {
      beats,
      time: now / 1000,
      colors: this.#colors(now, l),
      width: l.width,
      geometry: l.geometry,
      // Scatter reshuffles once per bar of the look's own time.
      pos: positions(l.geometry, Math.floor(beats / 4)),
      side: Array.from({ length: LIGHT_COUNT }, (_, i) => sideOf(i)),
      steps: stepCount(l.geometry),
      audio: stale
        ? { level: 0, bass: 0 }
        : { level: this.#audio.level, bass: this.#audio.bass },
    };
  }

  /** A palette's colors, crossfading from the previous palette if one is changing. */
  #paletteColors(now: number, index: number): readonly Rgb[] {
    const to = (this.palettes[index] ?? this.palettes[0]!).colors;
    const from = this.#paletteFrom;
    if (!from) return to;
    const t =
      from.beats <= 0
        ? 1
        : (this.clock.beats(now) - from.startBeat) / from.beats;
    if (t >= 1) {
      this.#paletteFrom = null;
      return to;
    }
    // Palettes differ in length: color i fades from whatever the old palette had there.
    return to.map((col, i) => mix(pick(from.colors, i), col, clamp01(t)));
  }

  #renderLook(index: number, intensity: number, ctx: LookContext): Rgb[] {
    const out: Rgb[] = Array.from({ length: LIGHT_COUNT }, () => ({
      ...BLACK,
    }));
    this.looks[index]?.render(ctx, out);
    return out.map((col) => scale(col, intensity));
  }

  /**
   * Change part of the version of the song being edited. Mid is `controls` itself; Low and
   * High keep the change as an override on top of what they'd work out from Mid.
   */
  #edit(change: (target: Level) => void): void {
    const id = this.editingLevel;
    if (id === "mid") return change(this.controls);
    const target = this.level(id);
    const before = { ...target };
    change(target);
    for (const f of LEVEL_FIELDS)
      if (target[f] !== before[f])
        (this.#overrides[id] as Record<string, unknown>)[f] = target[f];
  }

  #setLook(index: number, velocity: number | undefined): void {
    if (index < 0 || index >= this.looks.length) return;
    // Soft keys still read: velocity 0 → 40% intensity, full hit → 100%.
    if (velocity !== undefined)
      this.controls.lookIntensity = 0.4 + 0.6 * clamp01(velocity);
    this.#edit((l) => (l.lookIndex = index));
  }

  #turn(knob: KnobId, delta: number): void {
    const feel: { steps?: number; perCount?: number } = KNOB_FEEL[knob];
    if (feel.perCount !== undefined) {
      const amount = delta * feel.perCount;
      this.#edit((l) => {
        if (knob === "hue") l.hue = (((l.hue + amount) % 1) + 1) % 1;
        else {
          const k = knob as "saturation" | "width" | "variety";
          l[k] = clamp01(l[k] + amount);
        }
      });
      return;
    }
    // Stepped knobs: accumulate counts so a small nudge doesn't skip several steps.
    const perStep = feel.steps!;
    const total = (this.#knobRemainder[knob] ?? 0) + delta;
    const steps = Math.trunc(total / perStep);
    this.#knobRemainder[knob] = total - steps * perStep;
    if (steps === 0) return;
    this.#edit((l) => {
      switch (knob) {
        case "speed":
          l.speedIndex = clampIndex(l.speedIndex + steps, SPEED_STEPS.length);
          break;
        case "fade":
          l.fadeIndex = clampIndex(l.fadeIndex + steps, FADE_STEPS.length);
          break;
        case "palette": // wraps: scrolling past the last palette comes back to the first
          l.paletteIndex = wrapIndex(
            l.paletteIndex + steps,
            this.palettes.length,
          );
          break;
        case "geometry":
          l.geometry =
            GEOMETRIES[
              wrapIndex(
                GEOMETRIES.indexOf(l.geometry) + steps,
                GEOMETRIES.length,
              )
            ]!;
          break;
      }
    });
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

  /**
   * Load a song: Mid takes whatever its preset mentions (everything else stays as the
   * operator has it); Low and High start over from the song's own changes, if any.
   */
  #applySettings(s: Song): void {
    Object.assign(this.controls, this.#fromSettings(s));
    if (s.swell !== undefined) this.controls.swell = clamp01(s.swell);
    this.#overrides = {
      low: this.#fromSettings(s.low ?? {}),
      high: this.#fromSettings(s.high ?? {}),
    };
  }

  /** Preset values (ids, beats) → positions in this engine's lists. */
  #fromSettings(s: SongSettings): LevelOverrides {
    const out: LevelOverrides = {};
    const look = this.looks.findIndex((l) => l.id === s.look);
    if (look >= 0) out.lookIndex = look;
    const pal = this.palettes.findIndex((p) => p.id === s.palette);
    if (pal >= 0) out.paletteIndex = pal;
    if (s.hue !== undefined) out.hue = clamp01(s.hue);
    if (s.saturation !== undefined) out.saturation = clamp01(s.saturation);
    if (s.width !== undefined) out.width = clamp01(s.width);
    if (s.variety !== undefined) out.variety = clamp01(s.variety);
    if (s.speed !== undefined)
      out.speedIndex = nearestIndex(SPEED_STEPS, s.speed);
    if (s.fade !== undefined) out.fadeIndex = nearestIndex(FADE_STEPS, s.fade);
    if (s.geometry && GEOMETRIES.includes(s.geometry))
      out.geometry = s.geometry;
    return out;
  }

  /** Positions in this engine's lists → preset values (only the fields present). */
  #toSettings(l: LevelOverrides): SongSettings {
    const out: SongSettings = {};
    if (l.lookIndex !== undefined) out.look = this.looks[l.lookIndex]?.id;
    if (l.paletteIndex !== undefined)
      out.palette = this.palettes[l.paletteIndex]?.id;
    if (l.hue !== undefined) out.hue = round3(l.hue);
    if (l.saturation !== undefined) out.saturation = round3(l.saturation);
    if (l.speedIndex !== undefined) out.speed = SPEED_STEPS[l.speedIndex]!;
    if (l.fadeIndex !== undefined) out.fade = FADE_STEPS[l.fadeIndex]!;
    if (l.geometry !== undefined) out.geometry = l.geometry;
    if (l.width !== undefined) out.width = round3(l.width);
    if (l.variety !== undefined) out.variety = round3(l.variety);
    return out;
  }

  /** Keep a (possibly old or hand-edited) saved level within this engine's lists. */
  #validLevel(l: LevelOverrides): LevelOverrides {
    const out: LevelOverrides = { ...l };
    if (out.lookIndex !== undefined)
      out.lookIndex = clampIndex(out.lookIndex, this.looks.length);
    if (out.paletteIndex !== undefined)
      out.paletteIndex = clampIndex(out.paletteIndex, this.palettes.length);
    if (out.speedIndex !== undefined)
      out.speedIndex = clampIndex(out.speedIndex, SPEED_STEPS.length);
    if (out.fadeIndex !== undefined)
      out.fadeIndex = clampIndex(out.fadeIndex, FADE_STEPS.length);
    if (out.geometry !== undefined && !GEOMETRIES.includes(out.geometry))
      delete out.geometry;
    for (const f of ["hue", "saturation", "width", "variety"] as const)
      if (out[f] !== undefined) out[f] = clamp01(out[f]);
    return out;
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
