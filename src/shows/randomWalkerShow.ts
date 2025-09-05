import type { Show } from "@/runtime/types";
import { RandomWalkerScene } from "@/scenes/randomWalker";

export const RandomWalkerShow: Show = {
  name: "Random Walker Demo",
  scenes: [RandomWalkerScene],
  sceneCrossfadeMs: 1200,
};

