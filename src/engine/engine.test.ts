import { describe, expect, it } from "vitest";
import type { Song } from "../setlist.ts";
import type { Rgb } from "./color.ts";
import { Engine, FADE_STEPS, SPEED_STEPS, TICKS_PER_STEP } from "./engine.ts";
import type { Look } from "./look.ts";

// Two trivial looks make expectations easy to read.
const solid = (id: string, color: Rgb): Look => ({
  id,
  name: id,
  render: (_ctx, out) => out.fill(color),
});
const RED = solid("red", { r: 1, g: 0, b: 0 });
const BLUE = solid("blue", { r: 0, g: 0, b: 1 });
const PALETTE = [{ id: "test", name: "Test", colors: [{ r: 0, g: 1, b: 0 }] }];

function engine(setlist: Song[] = []) {
  const e = new Engine({
    now: 0,
    bpm: 120,
    looks: [RED, BLUE],
    palettes: PALETTE,
    setlist,
  });
  e.controls.master = 1;
  e.controls.lookIntensity = 1;
  return e;
}

describe("Engine looks", () => {
  it("crossfades over the fade knob's length in beats", () => {
    const e = engine();
    e.controls.fadeIndex = FADE_STEPS.indexOf(2); // 2 beats = 1000ms at 120 BPM
    e.dispatch({ type: "look", index: 1, velocity: 1 }, 0);
    expect(e.render(0).lights[0]).toMatchObject({ r: 1, b: 0 });
    const mid = e.render(500).lights[0]!;
    expect(mid.r).toBeCloseTo(0.5);
    expect(mid.b).toBeCloseTo(0.5);
    expect(e.render(1000).lights[0]).toMatchObject({ r: 0, b: 1 });
  });

  it("switches instantly when fade is 0", () => {
    const e = engine();
    e.controls.fadeIndex = FADE_STEPS.indexOf(0);
    e.dispatch({ type: "look", index: 1, velocity: 1 }, 0);
    expect(e.render(0).lights[0]).toMatchObject({ r: 0, b: 1 });
  });

  it("key velocity sets intensity, but soft keys still show", () => {
    const e = engine();
    e.controls.fadeIndex = 0;
    e.dispatch({ type: "look", index: 1, velocity: 0 }, 0);
    expect(e.render(0).lights[0]!.b).toBeCloseTo(0.4);
  });
});

describe("Engine hits", () => {
  it("are momentary: blackout while held, look returns on release", () => {
    const e = engine();
    e.dispatch({ type: "hit", hit: "blackout", down: true }, 0);
    expect(e.render(0).lights.every((c) => c.r + c.g + c.b === 0)).toBe(true);
    e.dispatch({ type: "hit", hit: "blackout", down: false }, 10);
    expect(e.render(10).lights[0]!.r).toBe(1);
  });

  it("blackout beats strobe, and strobe is capped for safety", () => {
    const e = engine();
    e.dispatch({ type: "hit", hit: "strobe", down: true, pressure: 1 }, 0);
    expect(e.render(0).strobe).toBeCloseTo(e.maxStrobe);
    e.dispatch({ type: "hit", hit: "blackout", down: true }, 0);
    const frame = e.render(0);
    expect(frame.strobe).toBe(0);
    expect(frame.lights[0]).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("left flash only touches the left side", () => {
    const e = engine();
    e.dispatch({ type: "hit", hit: "left-flash", down: true }, 0);
    const { lights } = e.render(0);
    expect(lights[0]).toEqual({ r: 1, g: 1, b: 1 });
    expect(lights[7]).toEqual({ r: 1, g: 0, b: 0 });
  });
});

describe("Engine modifiers", () => {
  it("grand master scales everything, side faders scale their side", () => {
    const e = engine();
    e.dispatch({ type: "fader", fader: "master", value: 0.5 }, 0);
    e.dispatch({ type: "fader", fader: "right", value: 0 }, 0);
    const { lights } = e.render(0);
    expect(lights[0]!.r).toBeCloseTo(0.5);
    expect(lights[7]!.r).toBe(0);
  });

  it("stepped knobs need several ticks per step and don't overshoot", () => {
    const e = engine();
    const start = e.controls.speedIndex;
    e.dispatch({ type: "knob", knob: "speed", delta: TICKS_PER_STEP - 1 }, 0);
    expect(e.controls.speedIndex).toBe(start);
    e.dispatch({ type: "knob", knob: "speed", delta: 1 }, 0);
    expect(e.controls.speedIndex).toBe(start + 1);
    e.dispatch({ type: "knob", knob: "speed", delta: 100 }, 0);
    expect(e.controls.speedIndex).toBe(SPEED_STEPS.length - 1);
  });

  it("geometry knob cycles and wraps", () => {
    const e = engine();
    const turn = () =>
      e.dispatch({ type: "knob", knob: "geometry", delta: TICKS_PER_STEP }, 0);
    turn();
    expect(e.controls.geometry).toBe("mirror");
    turn();
    turn();
    expect(e.controls.geometry).toBe("linear");
  });

  it("hue knob wraps around the colour wheel", () => {
    const e = engine();
    e.dispatch({ type: "knob", knob: "hue", delta: -1 }, 0);
    expect(e.controls.hue).toBeGreaterThan(0.9);
  });
});

describe("Engine strips", () => {
  it("reports the touch strips so the display can mirror them", () => {
    const e = engine();
    expect(e.status(0)).toMatchObject({ spotlight: null, swell: 0 });
    e.dispatch({ type: "spotlight", value: 0.7 }, 0);
    e.dispatch({ type: "swell", value: 0.4 }, 0);
    expect(e.status(0)).toMatchObject({ spotlight: 0.7, swell: 0.4 });
    e.dispatch({ type: "spotlight", value: null }, 0); // finger lifted
    expect(e.status(0).spotlight).toBeNull();
  });
});

describe("Engine setlist", () => {
  const SET: Song[] = [{ name: "One", bpm: 90, look: "blue" }, { name: "Two" }];

  it("loading a song applies its preset and moves the cursor to the next song", () => {
    const e = engine(SET);
    e.controls.fadeIndex = 0;
    e.dispatch({ type: "setlist-load" }, 0);
    expect(e.clock.bpm).toBeCloseTo(90);
    expect(e.controls.lookIndex).toBe(1);
    expect(e.status(0).setlist).toMatchObject({ loaded: 0, cursor: 1 });
  });

  it("a song without a preset changes nothing but the position", () => {
    const e = engine(SET);
    e.dispatch({ type: "setlist-move", delta: 1 }, 0);
    e.dispatch({ type: "setlist-load" }, 0);
    expect(e.clock.bpm).toBeCloseTo(120);
    expect(e.controls.lookIndex).toBe(0);
  });
});

describe("Engine persistence", () => {
  it("round-trips through a snapshot", () => {
    const a = engine();
    a.dispatch({ type: "look", index: 1 }, 0);
    a.dispatch({ type: "knob", knob: "width", delta: 20 }, 0);
    a.clock.setBpm(97, 0);
    const b = engine();
    b.restore(JSON.parse(JSON.stringify(a.snapshot())), 0);
    expect(b.controls).toEqual(a.controls);
    expect(b.clock.bpm).toBeCloseTo(97);
  });

  it("survives a corrupt or old save", () => {
    const e = engine();
    e.restore({ controls: { lookIndex: 99, geometry: "spiral" } as never }, 0);
    expect(e.controls.lookIndex).toBe(1);
    expect(e.controls.geometry).toBe("linear");
  });
});
