"use client";
import { FrameUniverseWriter } from "./universeWriter";
import { blendPatches } from "./crossfade";
import { SceneTempo } from "./tempo";
// import { allFixtures } from "@/data/fixtures";
import { createTimeHelpers } from "./timeHelpers";
import { createLightsFacade } from "./lightsFacade";
import type {
  CrossfadeInfo,
  DmxPatch,
  KeyMap,
  Look,
  LookRenderCtx,
  Scene,
  Show,
  UniverseWriter,
} from "./types";

export type SceneManagerState = {
  sceneIndex: number;
  lookIndex: 1 | 2 | 3 | 4; // target/active look index
  blackout: boolean;
  // Scene crossfade
  crossfadeActive: boolean;
  crossfadeStartMs: number;
  crossfadeDurationMs: number;
  // Look crossfade (within a scene)
  lookCrossfadeActive?: boolean;
  lookCrossfadeStartMs?: number;
  lookCrossfadeDurationMs?: number;
  prevLookIndex?: 1 | 2 | 3 | 4 | null;
};

export class SceneManager {
  private show: Show;
  private keymap: KeyMap;
  private state: SceneManagerState;
  private tempo: SceneTempo; // per-scene

  constructor(show: Show, keymap: KeyMap) {
    this.show = show;
    this.keymap = keymap;
    this.state = {
      sceneIndex: 0,
      lookIndex: 1,
      blackout: false,
      crossfadeActive: false,
      crossfadeStartMs: 0,
      crossfadeDurationMs: show.sceneCrossfadeMs,
    };
    this.tempo = new SceneTempo();
  }

  currentScene(): Scene {
    return this.show.scenes[this.state.sceneIndex];
  }

  currentLook(): Look {
    const looks = this.currentScene().looks;
    const idx = Math.min(looks.length, this.state.lookIndex) - 1;
    return looks[idx];
  }

  private getCrossfadeInfo(nowMs: number): CrossfadeInfo {
    if (!this.state.crossfadeActive)
      return { role: "none", alpha: 0, remainingMs: 0 };
    const t =
      (nowMs - this.state.crossfadeStartMs) / this.state.crossfadeDurationMs;
    const clamped = Math.max(0, Math.min(1, t));
    const remainingMs = Math.max(
      0,
      this.state.crossfadeDurationMs - (nowMs - this.state.crossfadeStartMs)
    );
    return { role: "incoming", alpha: clamped, remainingMs };
  }

  // Returns the final blended patch for this frame, and the LookRenderCtx used
  renderFrame(
    timeNowMs: number,
    deltaMs: number,
    extras?: { p5?: any; canvas?: CanvasRenderingContext2D | null }
  ): { patch: DmxPatch; ctx: LookRenderCtx } {
    const tempoInfo = this.tempo.info(timeNowMs);

    // Crossfade between scenes if active
    if (this.state.crossfadeActive) {
      const t =
        (timeNowMs - this.state.crossfadeStartMs) /
        this.state.crossfadeDurationMs;
      const alpha = Math.max(0, Math.min(1, t));
      const outgoingScene = this.show.scenes[this.prevSceneIndex()];
      const incomingScene = this.currentScene();

      const outWriter: UniverseWriter = new FrameUniverseWriter();
      const inWriter: UniverseWriter = new FrameUniverseWriter();

      const outLook = outgoingScene.looks[0]; // During scene change, we lock to Look 1
      const inLook = incomingScene.looks[0];

      const baseCtx = {
        time: { nowMs: timeNowMs, deltaMs },
        tempo: tempoInfo,
        p5: extras?.p5,
        canvas: extras?.canvas ?? null,
      } as const;

      outLook.render({
        ...baseCtx,
        crossfade: { role: "outgoing", alpha: 1 - alpha, remainingMs: 0 },
        universe: outWriter,
      });
      inLook.render({
        ...baseCtx,
        crossfade: { role: "incoming", alpha, remainingMs: 0 },
        universe: inWriter,
      });

      const blended = blendPatches(
        (outWriter as FrameUniverseWriter).patch,
        (inWriter as FrameUniverseWriter).patch,
        alpha
      );

      // End crossfade
      if (alpha >= 1) this.state.crossfadeActive = false;

      // Clear projection during crossfade so previous scene's visuals don't linger
      if (extras?.p5 && typeof extras.p5.clear === "function") {
        try {
          extras.p5.clear();
        } catch {}
      }
      return {
        patch: this.state.blackout ? {} : blended,
        ctx: {
          time: { nowMs: timeNowMs, deltaMs },
          tempo: tempoInfo,
          crossfade: this.getCrossfadeInfo(timeNowMs),
          universe: inWriter,
          p5: extras?.p5,
          canvas: extras?.canvas ?? null,
        },
      };
    }

    // Normal frame: single scene + current look (with optional look crossfade)
    const writer: UniverseWriter = new FrameUniverseWriter();
    const sceneA = this.currentScene();
    const look = this.currentLook();

    // Handle look crossfade blending if active
    if (this.state.lookCrossfadeActive && this.state.prevLookIndex) {
      const start = this.state.lookCrossfadeStartMs ?? timeNowMs;
      const dur = this.state.lookCrossfadeDurationMs ?? 0;
      const t =
        dur > 0 ? Math.max(0, Math.min(1, (timeNowMs - start) / dur)) : 1;
      const outLook = sceneA.looks[(this.state.prevLookIndex as number) - 1];
      const inLook = look;
      const outWriter: UniverseWriter = new FrameUniverseWriter();
      const inWriter: UniverseWriter = new FrameUniverseWriter();

      const baseCtx = {
        time: { nowMs: timeNowMs, deltaMs },
        tempo: tempoInfo,
        p5: extras?.p5,
        canvas: extras?.canvas ?? null,
      } as const;

      outLook.render({
        ...(baseCtx as any),
        crossfade: { role: "outgoing", alpha: 1 - t, remainingMs: 0 },
        universe: outWriter,
      } as any);
      inLook.render({
        ...(baseCtx as any),
        crossfade: { role: "incoming", alpha: t, remainingMs: 0 },
        universe: inWriter,
      } as any);

      const blended = blendPatches(
        (outWriter as FrameUniverseWriter).patch,
        (inWriter as FrameUniverseWriter).patch,
        t
      );

      if (t >= 1) {
        this.state.lookCrossfadeActive = false;
        this.state.prevLookIndex = null;
      }

      return {
        patch: this.state.blackout ? {} : blended,
        ctx: {
          time: { nowMs: timeNowMs, deltaMs },
          tempo: tempoInfo,
          crossfade: { role: "incoming", alpha: t, remainingMs: 0 },
          universe: inWriter,
          p5: extras?.p5,
          canvas: extras?.canvas ?? null,
        } as any,
      };
    }

    // Create helpers and facade
    const t = createTimeHelpers({ nowMs: timeNowMs, deltaMs }, tempoInfo);
    const lights = createLightsFacade(writer);

    // Helper to safely sample the current projection frame (if available)
    const sample = (x: number, y: number): [number, number, number, number] => {
      const p5 = extras?.p5 as any;
      if (p5 && typeof p5.get === "function") {
        const c = p5.get(x, y);
        // p5.get returns [r,g,b,a]
        return c as [number, number, number, number];
      }
      return [0, 0, 0, 255];
    };

    const ctx: LookRenderCtx = {
      time: { nowMs: timeNowMs, deltaMs },
      tempo: tempoInfo,
      crossfade: { role: "none", alpha: 0, remainingMs: 0 },
      universe: writer,
      p5: extras?.p5,
      canvas: extras?.canvas ?? null,
      lights,
      t,
      sample,
    };

    // Draw visuals first (scene-level), then render lights
    const scene2 = this.currentScene();
    if (extras?.p5) {
      // Always clear before drawing scene visuals to avoid lingering from previous scene
      if (typeof extras.p5.clear === "function") {
        try {
          extras.p5.clear();
        } catch {}
      }
      if (scene2.updateVisual) scene2.updateVisual(ctx);
      const style = look.visualStyle ? look.visualStyle(ctx) : undefined;
      if (scene2.drawVisual) scene2.drawVisual(extras.p5, ctx, style);
    }

    look.render(ctx);

    const patch = (writer as FrameUniverseWriter).patch;
    return { patch: this.state.blackout ? {} : patch, ctx };
  }

  // --- Controls ---

  setLook(i: 1 | 2 | 3 | 4) {
    const sc = this.currentScene();
    if (i > sc.looks.length) return;
    if (i === this.state.lookIndex) return;
    const targetLook = sc.looks[i - 1];
    const now = performance.now();
    const duration = (i === 1 ? 0 : targetLook.enterCrossfadeMs ?? 0) | 0; // ignore Look 1 per spec
    if (duration > 0) {
      // Start a look crossfade from previous look to new look
      this.state.prevLookIndex = this.state.lookIndex;
      this.state.lookIndex = i; // target becomes active index for reading currentLook
      this.state.lookCrossfadeActive = true;
      this.state.lookCrossfadeStartMs = now;
      this.state.lookCrossfadeDurationMs = duration;
    } else {
      // Instant switch
      this.state.prevLookIndex = null;
      this.state.lookIndex = i;
      this.state.lookCrossfadeActive = false;
      this.state.lookCrossfadeStartMs = 0;
      this.state.lookCrossfadeDurationMs = 0;
    }
  }

  /**
   * Jump to a specific scene by id without triggering a crossfade.
   * Resets Look to 1 (caller may set a different Look immediately after).
   */
  setSceneById(sceneId: string) {
    const idx = this.show.scenes.findIndex((s) => s.id === sceneId);
    if (idx < 0) return;
    this._prevSceneIndex = this.state.sceneIndex;
    this.state.sceneIndex = idx;
    this.state.lookIndex = 1;
    this.state.crossfadeActive = false;
    this.state.crossfadeStartMs = 0;
    this.state.crossfadeDurationMs = this.show.sceneCrossfadeMs;
    this.tempo = new SceneTempo();
  }

  nextScene(nowMs: number) {
    if (this.state.sceneIndex < this.show.scenes.length - 1) {
      this.startSceneTransition(nowMs, this.state.sceneIndex + 1);
    }
  }

  prevScene(nowMs: number) {
    if (this.state.sceneIndex > 0) {
      this.startSceneTransition(nowMs, this.state.sceneIndex - 1);
    }
  }

  private startSceneTransition(nowMs: number, toIndex: number) {
    // start crossfade: new scene becomes current; remember previous for blending
    this._prevSceneIndex = this.state.sceneIndex;
    this.state.sceneIndex = toIndex;
    this.state.lookIndex = 1; // per spec: scenes start at Look 1
    this.state.crossfadeActive = true;
    this.state.crossfadeStartMs = nowMs;
    this.state.crossfadeDurationMs = this.show.sceneCrossfadeMs;
    // new per-scene tempo instance
    this.tempo = new SceneTempo();
  }

  private _prevSceneIndex: number | null = null;
  private prevSceneIndex(): number {
    return this._prevSceneIndex ?? Math.max(0, this.state.sceneIndex - 1);
  }

  toggleBlackout() {
    this.state.blackout = !this.state.blackout;
  }

  // --- Tempo controls ---
  tap(nowMs: number) {
    this.tempo.tap(nowMs);
  }
  tempoHalf() {
    this.tempo.halve();
  }
  tempoDouble() {
    this.tempo.double();
  }
  tempoReset() {
    this.tempo.reset();
  }

  // --- Key handling ---
  handleKey(e: KeyboardEvent, nowMs: number) {
    // Build a key id like "Alt+t" or "ArrowUp"
    const keyId = `${e.altKey ? "Alt+" : ""}${e.shiftKey ? "Shift+" : ""}${
      e.key
    }`;
    const matches = (keys: string[]) =>
      keys.includes(e.key) || keys.includes(keyId);

    for (const binding of this.keymap) {
      if (!matches(binding.keys)) continue;
      switch (binding.action) {
        case "LOOK_1":
          this.setLook(1);
          break;
        case "LOOK_2":
          this.setLook(2);
          break;
        case "LOOK_3":
          this.setLook(3);
          break;
        case "LOOK_4":
          this.setLook(4);
          break;
        case "NEXT_SCENE":
          this.nextScene(nowMs);
          break;
        case "PREV_SCENE":
          this.prevScene(nowMs);
          break;
        case "BLACKOUT_TOGGLE":
          this.toggleBlackout();
          break;
        case "TAP_TEMPO":
          this.tap(nowMs);
          break;
        case "TEMPO_HALF":
          this.tempoHalf();
          break;
        case "TEMPO_DOUBLE":
          this.tempoDouble();
          break;
        case "TEMPO_RESET":
          this.tempoReset();
          break;
        case "HELP_TOGGLE":
          // handled at UI layer
          break;
      }
      // First match wins
      e.preventDefault();
      return true;
    }
    return false;
  }

  getState() {
    return this.state;
  }
}
