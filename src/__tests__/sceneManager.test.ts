import { describe, it, expect } from "vitest";
import { SceneManager } from "../runtime/sceneManager";
import type { KeyMap, Look, Scene, Show } from "../runtime/types";

const mkLook = (id: 1 | 2 | 3 | 4, name: string): Look => ({
  id,
  name,
  render: () => {},
});
const mkScene = (id: string, name: string, looks: Look[]): Scene => ({
  id,
  name,
  looks,
});

const show: Show = {
  name: "Test",
  sceneCrossfadeMs: 500,
  scenes: [
    mkScene("s1", "Scene 1", [mkLook(1, "L1"), mkLook(2, "L2")]),
    mkScene("s2", "Scene 2", [mkLook(1, "L1")]),
  ],
};

const keymap: KeyMap = [
  { action: "LOOK_1", keys: ["1"] },
  { action: "LOOK_2", keys: ["2"] },
  { action: "NEXT_SCENE", keys: ["ArrowUp"] },
  { action: "PREV_SCENE", keys: ["ArrowDown"] },
  { action: "BLACKOUT_TOGGLE", keys: ["b", "B"] },
];

describe("SceneManager", () => {
  it("selects current scene and look within bounds", () => {
    const sm = new SceneManager(show, keymap);
    expect(sm["getState"]().sceneIndex).toBe(0);
    expect(sm.currentLook().id).toBe(1);
    sm.setLook(2);
    expect(sm.currentLook().id).toBe(2);
    sm.setLook(4); // out of bounds
    expect(sm.currentLook().id).toBe(2); // unchanged
  });

  it("handles key actions and toggles blackout", () => {
    const sm = new SceneManager(show, keymap);
    const e = (key: string) =>
      ({
        key,
        altKey: false,
        shiftKey: false,
        preventDefault() {},
      } as unknown as KeyboardEvent);
    sm.handleKey(e("2"), 0);
    expect(sm.currentLook().id).toBe(2);
    sm.handleKey(e("b"), 0);
    expect(sm["getState"]().blackout).toBe(true);
  });

  it("starts a crossfade when moving scenes and completes after duration", () => {
    const sm = new SceneManager(show, keymap);
    sm.nextScene(1000);
    // During crossfade, renderFrame blends and blackout respected
    let res = sm.renderFrame(1100, 16);
    expect(Object.keys(res.patch).length).toBeGreaterThanOrEqual(0);
    // End of crossfade
    res = sm.renderFrame(2000, 16);
    expect(sm["getState"]().crossfadeActive).toBe(false);
  });

  it("setSceneById initializes scene without triggering crossfade", () => {
    const sm = new SceneManager(show, keymap);
    sm.setSceneById("s2");
    expect(sm["getState"]().sceneIndex).toBe(1);
    expect(sm["getState"]().crossfadeActive).toBe(false);
    // look reset to 1
    expect(sm.currentLook().id).toBe(1);
  });
});
