import { describe, it, expect } from "vitest";
import { SceneManager } from "../runtime/sceneManager";
import type { KeyMap, Look, Scene, Show } from "../runtime/types";

const mkLook = (id: 1|2|3|4, name: string, enterCrossfadeMs?: number): Look => ({ id, name, enterCrossfadeMs, render: () => {} });
const mkScene = (id: string, name: string, looks: Look[]): Scene => ({ id, name, looks });

const show: Show = {
  name: "Test",
  sceneCrossfadeMs: 500,
  scenes: [
    mkScene("s1", "Scene 1", [mkLook(1, "L1"), mkLook(2, "L2", 200)]),
  ],
};

const keymap: KeyMap = [
  { action: "LOOK_1", keys: ["1"] },
  { action: "LOOK_2", keys: ["2"] },
];

describe("Look crossfade", () => {
  it("activates look crossfade when moving to a look with enterCrossfadeMs", () => {
    const sm = new SceneManager(show, keymap);
    sm.setLook(2);
    const st = sm["getState"]();
    expect(st.lookIndex).toBe(2);
    expect(st.lookCrossfadeActive).toBe(true);
    expect(st.prevLookIndex).toBe(1);
  });
});

