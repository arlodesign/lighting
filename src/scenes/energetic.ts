import { allFixtures } from "@/data/fixtures";
import type { Look, Scene } from "@/runtime/types";

// High-energy scene with dynamic lighting for upbeat songs
const StrobeLook: Look = {
  id: 1,
  name: "Strobe Flash",
  render: ({ universe, tempo }) => {
    // Use tempo to drive strobe timing
    const intensity = tempo.beat % 2 === 0 ? 255 : 0;
    const r = 255, g = 255, b = 255; // Bright white strobe
    
    for (const [_, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), intensity);
      universe.setAddress(f.getAddress("r" as any), r);
      universe.setAddress(f.getAddress("g" as any), g);
      universe.setAddress(f.getAddress("b" as any), b);
    }
  },
};

const ColorChaseLook: Look = {
  id: 2,
  name: "Color Chase",
  render: ({ universe, time }) => {
    const intensity = 200;
    // Cycle through colors based on time
    const cycle = (time.nowMs / 1000) % 3;
    let r = 0, g = 0, b = 0;
    
    if (cycle < 1) {
      r = 255; // Red
    } else if (cycle < 2) {
      g = 255; // Green  
    } else {
      b = 255; // Blue
    }
    
    for (const [_, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), intensity);
      universe.setAddress(f.getAddress("r" as any), r);
      universe.setAddress(f.getAddress("g" as any), g);
      universe.setAddress(f.getAddress("b" as any), b);
    }
  },
};

const PulseLook: Look = {
  id: 3,
  name: "Pulse",
  render: ({ universe, tempo }) => {
    // Pulse intensity with the beat
    const beatProgress = tempo.beatProgress;
    const intensity = Math.floor(100 + (155 * Math.sin(beatProgress * Math.PI)));
    const r = 255, g = 100, b = 0; // Orange pulse
    
    for (const [_, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), intensity);
      universe.setAddress(f.getAddress("r" as any), r);
      universe.setAddress(f.getAddress("g" as any), g);
      universe.setAddress(f.getAddress("b" as any), b);
    }
  },
};

const BuildupLook: Look = {
  id: 4,
  name: "Buildup",
  render: ({ universe, time }) => {
    // Gradually increase intensity over time
    const cycle = (time.nowMs / 8000) % 1; // 8 second cycle
    const intensity = Math.floor(50 + (205 * cycle));
    const r = Math.floor(255 * cycle);
    const g = Math.floor(150 * cycle);
    const b = Math.floor(50 * cycle);
    
    for (const [_, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), intensity);
      universe.setAddress(f.getAddress("r" as any), r);
      universe.setAddress(f.getAddress("g" as any), g);
      universe.setAddress(f.getAddress("b" as any), b);
    }
  },
};

export const EnergeticScene: Scene = {
  id: "energetic",
  name: "High Energy",
  looks: [StrobeLook, ColorChaseLook, PulseLook, BuildupLook],
};
