import type { Show } from "@/runtime/types";
import { CalibrationScene } from "@/scenes/calibration";
import { MellowScene } from "@/scenes/mellow";
import { EnergeticScene } from "@/scenes/energetic";
import { DemoSong } from "@/scenes/demoSong";
import { BlackoutScene } from "@/scenes/blackout";

/**
 * Concert Show - a full performance setup with varied moods and energy levels
 * Designed for live performances with smooth transitions between different song types
 */
export const ConcertShow: Show = {
  name: "Live Concert",
  scenes: [
    CalibrationScene,  // Pre-show setup
    MellowScene,       // Opening/slow songs
    DemoSong,          // Mid-tempo songs
    EnergeticScene,    // High-energy climax
    BlackoutScene,     // Finale/intermission
  ],
  sceneCrossfadeMs: 2000, // Smooth transitions for performance
};
