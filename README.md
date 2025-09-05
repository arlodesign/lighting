# Lighting (v2) — Simple, sketch‑friendly authoring for lights + projections

This branch is a typed rewrite focused on making it as easy as your original p5 sketch to author coordinated lighting and projection looks — while keeping the stronger safety and structure of v2.

- Default frame pipeline: draw first, then lights. You can sample projection pixels and apply them to fixtures in the same frame.
- Ergonomic authoring: lights facade, time helpers, and small builder functions.
- Sensible defaults: predefined groups (front/back/left/right + quadrants), strobe safety, and WCAG‑aware guidance for projections.

## Quick start

- Start the dev server: `pnpm dev`
- Open http://localhost:3000
- Launch a show, e.g. “Live Concert” or “Random Walker Demo”
- Press the “Enable controls” button to use keyboard:
  - 1–4: switch looks
  - Arrow Up/Down: next/previous scene
  - B: blackout, T: tap tempo (Shift+T double, Alt+T half, R reset)

## Core concepts

- Fixture config

  - Defined in `src/data/fixtures/config.ts`. Channels use labels: `master`, `r`, `g`, `b` (others like `rgb`, `strobe`, `mode` exist but aren’t exposed in the ergonomic API yet).

- Universe

  - Frame buffer for DMX values. A diff of changes is sent each frame to the transport (Noop in dev).

- Scenes and Looks

  - A Scene contains 1–4 Looks. The active Look runs every frame to set light values. Scene visuals are drawn once per frame before the look runs.

- Default pipeline (per frame)
  1. Update time / tempo
  2. Draw Scene visuals (p5) — you can build state that persists across looks
  3. Run active Look — set lights (and optionally read pixels from the just‑drawn frame)
  4. DMX diff is sent

## Authoring: ergonomic layer

### Scene visuals: single draw vs update+draw

You can author visuals in one of two ergonomic styles:

- Single draw (p5-like): put both state updates and drawing inside `drawVisual`. This matches p5’s `draw()` mental model and is simplest to start with.
- Split update+draw: put motion/physics in `updateVisual` and presentation in `drawVisual`. This unlocks fixed‑timestep updates, headless (lights‑only) runs, and the ability to throttle drawing without affecting state.

Both hooks are optional.

Example — Single draw (update + render in one place):

```ts
export const MyScene: Scene = {
  id: "my",
  name: "My Scene",
  looks: [
    /* ... */
  ],
  drawVisual: (p5, ctx) => {
    if (!p5) return;
    // (re)create state on first frame or size change
    // update state (move points, bounce, envelopes, etc.)
    // render state
    p5.background(0);
    // ... draw your visuals ...
  },
};
```

Example — Split update + draw:

```ts
export const MyScene: Scene = {
  id: "my",
  name: "My Scene",
  looks: [
    /* ... */
  ],
  updateVisual: (ctx) => {
    // advance scene state (no p5 required)
  },
  drawVisual: (p5, ctx) => {
    if (!p5) return;
    // render the current state
  },
};
```

Why split can help later:

- Fixed‑timestep updates: keep motion consistent even if the browser drops frames.
- Headless runs: state can evolve and drive lights even when the projector/canvas isn’t mounted.
- Performance: you can throttle drawing (e.g., 30 fps) but keep updates smooth.

### Look-provided visualStyle (optional)

Looks can provide a `visualStyle(ctx)` object to theme how a scene is drawn (palette, stroke/fill, weights, backgrounds, blend). The scene owns the “what” (state/geometry); looks own the “how” (treatment).

Look defines a style:

```ts
const WarmFill: Look = {
  id: 1,
  name: "Warm Fill",
  visualStyle: () => ({
    background: (p5) => p5.background(0),
    fill: (p5) => p5.color(240, 120, 40, 160),
    stroke: null,
    strokeWeight: 0,
  }),
  render: ({ lights }) => lights?.all.rgb(240, 120, 40).master(150),
};
```

Scene applies it in `drawVisual`:

```ts
drawVisual: (p5, ctx, style) => {
  if (!p5) return;
  style?.background?.(p5);
  // example: draw a polygon list using the style
  const applyFill = style?.fill?.(p5);
  if (applyFill) {
    p5.noStroke();
    p5.fill(applyFill);
  } else if (style?.stroke) {
    p5.noFill();
    p5.strokeWeight(style.strokeWeight ?? 1);
    p5.stroke(style.stroke(p5));
  }
  // ... draw shapes ...
};
```

This separation lets you A/B creative treatments (outline vs fill, warm vs cool palettes) without touching simulation logic. It also makes it easy to add “safe” looks (reduced brightness/contrast) for WCAG‑aware contexts.

### Look render (per frame)

A Look’s `render(ctx)` runs every frame and is responsible for setting DMX values. It can also read from the just‑drawn projection and use time helpers.

What you get in `ctx`:

- `lights`: ergonomic facade for groups/fixtures (preferred)
- `t`: time helpers (`nowMs`, `deltaMs`, `cycle`, `pulse`, etc.)
- `sample(x, y)`: read `[r,g,b,a]` from the current p5 frame
- `crossfade`: `{ role: 'none'|'incoming'|'outgoing', alpha, remainingMs }`
- `p5`/`canvas`: optional drawing surfaces (usually not needed inside looks)
- `universe`: low‑level writer (escape hatch; avoid when the facade suffices)

Recommended patterns

- Keep render stateless. Persist evolving state in the scene visual if needed.
- Prefer `lights.group(...)`/`lights.all` to per‑fixture loops.
- Use `t` for LFO/tempo logic; clamp values to 0..255.
- It’s safe to `sample()` the projection: visuals are drawn before looks run.

Examples

Basic wash:

```ts
const WarmWash: Look = {
  id: 1,
  name: "Warm Wash",
  render: ({ lights }) => lights?.all.rgb(200, 90, 20).master(160),
};
```

Time‑based pulse:

```ts
const CoolPulse: Look = {
  id: 2,
  name: "Cool Pulse",
  render: ({ t, lights }) => {
    const base = 120 + 80 * Math.sin((t?.nowMs ?? 0) * 0.002);
    lights?.all
      .rgb(40, 120, 220)
      .master(Math.round(Math.max(0, Math.min(255, base))));
  },
};
```

Sample the projection to color SL/SR groups:

```ts
const SampledSides: Look = {
  id: 3,
  name: "Sampled Sides",
  render: ({ lights, p5, sample, t }) => {
    if (!lights || !sample) return;
    const w = p5?.width ?? 800,
      h = p5?.height ?? 600;
    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));

    const avgSample = (cx: number, cy: number): [number, number, number] => {
      const offsets = [-20, 0, 20];
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (const ox of offsets)
        for (const oy of offsets) {
          const [rr, gg, bb] = sample(
            clamp(cx + ox, 0, w - 1),
            clamp(cy + oy, 0, h - 1)
          );
          r += rr;
          g += gg;
          b += bb;
          n++;
        }
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    };

    const [rL, gL, bL] = avgSample(Math.round(w * 0.25), Math.round(h * 0.5));
    const [rR, gR, bR] = avgSample(Math.round(w * 0.75), Math.round(h * 0.5));

    const master = Math.round(120 + 80 * Math.sin((t?.nowMs ?? 0) * 0.002));
    lights.group("left").rgb(rL, gL, bL).master(master);
    lights.group("right").rgb(rR, gR, bR).master(master);
  },
};
```

Crossfade‑aware dimming (optional):

```ts
render: ({ crossfade, lights }) => {
  const dim =
    crossfade.role === "incoming"
      ? crossfade.alpha
      : crossfade.role === "outgoing"
      ? 1 - crossfade.alpha
      : 1;
  lights?.all.master(Math.round(160 * dim));
};
```

A11y notes

- Avoid rapid duty‑cycle modulation (>3 flashes/sec). Favor smooth transitions.
- Keep average brightness reasonable for projection legibility; use `master` to cap peaks.

### Lights facade

Target selectors:

- `lights.all`
- `lights.group(name)` — predefined groups include: `all`, `front`, `back`, `left`, `right`, `front-left`, `front-right`, `back-left`, `back-right`
- `lights.fixture(id)`
- `lights.groups([name1, name2])`, `lights.fixtures([id1, id2])`

Core ops (chainable):

- `.rgb(r, g, b)`
- `.master(value)`
- `.off()` / `.blackout()`
- Escape hatch: `.set(label, value)`, `.setValues({ ... })`

Example:

```ts
look("Warm Wash", ({ lights }) => {
  lights.all.rgb(200, 90, 20).master(160);
});
```

### Time helpers (t)

- `t.nowMs`, `t.deltaMs`
- `t.cycle(periodMs, phase?) -> 0..1`
- `t.pulse(periodMs, width?, phase?) -> 0..1`
- `t.beat(division=1) -> boolean` (true when a divided beat boundary occurs)
- `t.beatPhase`, `t.barPhase`
- `t.step(array, periodMs, phase?) -> element`
- Easing/utils: `t.lerp`, `t.easeInOutQuad`, `t.sin01`, `t.tri01`

Example:

```ts
look("White Chase", ({ lights, t }) => {
  const phase = t.cycle(500); // loop every 500ms
  lights.chase({
    group: "all",
    colors: [
      { r: 255, g: 255, b: 255 },
      { r: 0, g: 0, b: 0 },
    ],
    width: 1,
    phase,
  });
});
```

### Builders (optional, for less boilerplate)

- `look(name, render, options?)`
- `scene(id, name, looks, { visual? })` where `visual` is `{ init?, update?, draw? }`
- `show(name, scenes, { sceneCrossfadeMs })` (shows live at `src/shows/*`)

### Sampling projection pixels in your look

The default pipeline draws visuals before the look. Use `sample(x, y)` to read `[r,g,b,a]` from the current frame.

```ts
look("Sampled Color", ({ lights, sample }) => {
  const [r, g, b] = sample(400, 300);
  lights.group("front").rgb(r, g, b).master(180);
});
```

## Patterns (initial set) and how to create more

Included now:

- `lights.chase({ group, colors|values, width, phase, target })`
- `lights.pulse({ group, base, peak, ... })`
- `lights.sparkle({ group, density, value })`

Author your own in ~20 lines using `lights` + `t`. Example custom wave:

```ts
look("Blue Wave", ({ lights, t }) => {
  const ids = [
    /* your fixture ids */
  ];
  const phase = t.cycle(1200);
  ids.forEach((id, i) => {
    const local = (phase + i / ids.length) % 1;
    const v = Math.floor(80 + 120 * t.sin01(local));
    lights.fixture(id).rgb(0, 80, v).master(160);
  });
});
```

## Groups: predefined and custom

- Predefined groups are built from `FIXTURE_CONFIG` coordinates: `front/back/left/right` and quadrants.
- Add a custom group in `src/data/fixtures/groups.ts`:

```ts
import { FIXTURE_CONFIG, type FixtureId } from "./config";
import { registerGroup } from "./groups";

const center: FixtureId[] = FIXTURE_CONFIG.filter(
  (f) => f.location.slot === 2 || f.location.slot === 3
).map((f) => f.id);
registerGroup("center", center);
```

## Accessibility & safety (WCAG 2.1 AA)

- Projection contrast: prefer high-contrast fg/bg pairs; avoid conveying information with color alone; use shape/size/position.
- Strobe safety (recommended defaults): cap frequency and duty cycle; clearly label any seizure‑risk effects.
- Keyboard operability: the UI includes focus styles and aria labels; controls can be toggled on/off.

## Reference: where things live

- Scenes: `src/scenes/*`, Shows: `src/shows/*`
- Runner & pipeline: `src/runtime/ShowRunner.tsx`, `src/runtime/sceneManager.ts`
- Ergonomic layer: `src/runtime/lightsFacade.ts`, `src/runtime/timeHelpers.ts`, `src/runtime/builders.ts`
- Fixtures & groups: `src/data/fixtures/*`

## Roadmap

- Add more patterns (wave/rainbow/gradient with spatial mapping)
- Optional “sketch look” helper for draw+lights in one place (if you want the main‑branch vibe)
- Extended labels (rgb macro, strobe, mode) once you’re ready
