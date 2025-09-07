import { describe, it, expect } from "vitest";
import { ShowRunner } from "../runtime/ShowRunner";
import { SceneManager } from "../runtime/sceneManager";
import type { KeyMap, Look, Scene, Show } from "../runtime/types";

const mkLook = (id: 1|2|3|4, name: string): Look => ({ id, name, render: () => {} });
const mkScene = (id: string, name: string, looks: Look[]): Scene => ({ id, name, looks });

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

// These tests focus on the state initialization & manager API (URL sync is exercised via props)
describe("URL/state initialization", () => {
  it("SceneManager.setSceneById jumps to scene without crossfade and resets look to 1", () => {
    const sm = new SceneManager(show, keymap);
    expect(sm["getState"]().sceneIndex).toBe(0);
    sm.setLook(2);
    expect(sm.currentLook().id).toBe(2);

    sm.setSceneById("s2");
    expect(sm["getState"]().sceneIndex).toBe(1);
    expect(sm["getState"]().crossfadeActive).toBe(false);
    // Look resets to 1 on scene jump; caller can set a different one immediately after
    expect(sm.currentLook().id).toBe(1);
  });

  it("ignores unknown scene ids", () => {
    const sm = new SceneManager(show, keymap);
    sm.setSceneById("nope");
    expect(sm["getState"]().sceneIndex).toBe(0);
  });
});

