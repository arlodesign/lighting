import type { Show } from "@/runtime/types";
import { CalibrationScene } from "@/scenes/calibration";
import { BlackoutScene } from "@/scenes/blackout";
import { DemoSong } from "@/scenes/demoSong";

export const DemoShow: Show = {
  name: "Demo",
  scenes: [CalibrationScene, BlackoutScene, DemoSong],
  sceneCrossfadeMs: 1200,
};
