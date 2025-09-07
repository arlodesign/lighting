// Domain types for Scenes, Looks, Shows and render context
// Note: We keep this p5-agnostic so we can stub visuals without the p5 dependency.

import type { FixtureId, LedParLabel } from "@/data/fixtures";
import type { LightsFacade } from "./lightsFacade";
import type { TimeHelpers } from "./timeHelpers";

export type DmxAddress = number; // 1-based DMX address
export type DmxValue = number; // 0-255
export type DmxPatch = Record<DmxAddress, DmxValue>;

export type KeyBinding = {
  action:
    | "LOOK_1"
    | "LOOK_2"
    | "LOOK_3"
    | "LOOK_4"
    | "NEXT_SCENE"
    | "PREV_SCENE"
    | "BLACKOUT_TOGGLE"
    | "TAP_TEMPO"
    | "TEMPO_HALF"
    | "TEMPO_DOUBLE"
    | "TEMPO_RESET"
    | "HELP_TOGGLE";
  keys: string[]; // KeyboardEvent.key values
};

export type KeyMap = KeyBinding[];

export type CrossfadeRole = "none" | "outgoing" | "incoming";

export type CrossfadeInfo = {
  role: CrossfadeRole;
  /** 0..1 */
  alpha: number;
  /** milliseconds remaining, for convenience */
  remainingMs: number;
};

export type RenderTime = {
  nowMs: number;
  deltaMs: number;
};

export type TempoInfo = {
  bpm: number | null;
  beatPhase: number; // 0..1
  barPhase: number; // 0..1 (4/4 assumption for now)
  lastTapAt: number | null; // ms
};

// Minimal surface we expose to looks for writing channel values without mutating Fixture objects
export interface UniverseWriter {
  /** Set by absolute 1-based DMX address */
  setAddress(address: DmxAddress, value: DmxValue): void;
  /** Set by fixture id + label (uses static config for addressing; does not mutate fixtures) */
  setFixture(fixtureId: FixtureId, label: LedParLabel, value: DmxValue): void;
  /** Merge a sparse patch (address->value) */
  addPatch(patch: DmxPatch): void;
  /** Read-only snapshot for inspection (e.g., sim/HUD) */
  readonly patch: DmxPatch;
}

export type LookRenderCtx = {
  time: RenderTime;
  tempo: TempoInfo;
  crossfade: CrossfadeInfo;
  universe: UniverseWriter;
  /** Optional drawing surface when p5 is not present yet */
  canvas?: CanvasRenderingContext2D | null;
  /** Optional p5 instance for visuals */
  p5?: any;
  /** Ergonomic lights facade */
  lights?: LightsFacade;
  /** Time helpers */
  t?: TimeHelpers;
  /** Sample RGBA from current projection frame */
  sample?: (x: number, y: number) => [number, number, number, number];
  /** Scene-level persistent state (created by visual.init) */
  sceneState?: any;
};

// Visual style for scene-level drawing provided by active Look
export type VisualStyle = {
  bg: [number, number, number]; // background RGB
  fg: [number, number, number]; // foreground RGB (e.g., circle)
};

export type Look = {
  id: 1 | 2 | 3 | 4;
  name: string;
  /** Optional crossfade duration in ms to apply when entering this Look (ignored for Look 1 for now) */
  enterCrossfadeMs?: number;
  onEnter?(ctx: LookRenderCtx): void;
  onExit?(ctx: LookRenderCtx): void;
  /** Optional visual style to be used by the Scene's drawVisual */
  visualStyle?(ctx: LookRenderCtx): VisualStyle;
  /** Called every frame. Set channel values via ctx.universe and draw visuals using p5/canvas */
  render(ctx: LookRenderCtx): void;
};

export type Scene = {
  id: string; // song-like id
  name: string; // human label
  looks: Look[]; // 1..4
  preload?(): Promise<void> | void; // placeholder for p5 preload when added
  /** Optional per-frame update of scene visual state (e.g., moving circle position) */
  updateVisual?(ctx: LookRenderCtx): void;
  /** Optional scene-level draw using p5, styled by the active look's visualStyle */
  drawVisual?(p5: any, ctx: LookRenderCtx, style?: VisualStyle): void;
};

export type Show = {
  name: string;
  scenes: Scene[];
  sceneCrossfadeMs: number; // default crossfade length between scenes
};

export type Transport = {
  send(diff: DmxPatch): Promise<void>;
};
