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
