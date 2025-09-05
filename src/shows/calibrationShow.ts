import type { Show } from "@/runtime/types";
import { CalibrationScene } from "@/scenes/calibration";
import { BlackoutScene } from "@/scenes/blackout";

/**
 * Calibration Show - focused on technical setup and testing
 * Ideal for venue setup, fixture testing, and projector alignment
 */
export const CalibrationShow: Show = {
  name: "Calibration & Testing",
  scenes: [CalibrationScene, BlackoutScene],
  sceneCrossfadeMs: 500, // Quick transitions for technical work
};
