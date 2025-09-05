import { allFixtures } from "@/data/fixtures";
import type { Look, Scene } from "@/runtime/types";

// Mellow, atmospheric scene for slower songs and ambient moments
const SoftWashLook: Look = {
  id: 1,
  name: "Soft Wash",
  render: ({ universe }) => {
    const intensity = 120; // Gentle intensity
    const r = 150, g = 100, b = 200; // Soft purple
    
    for (const [_, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), intensity);
      universe.setAddress(f.getAddress("r" as any), r);
      universe.setAddress(f.getAddress("g" as any), g);
      universe.setAddress(f.getAddress("b" as any), b);
    }
  },
};

const BreatheLook: Look = {
  id: 2,
  name: "Breathe",
  render: ({ universe, time }) => {
    // Slow breathing effect
    const breathe = Math.sin((time.nowMs / 3000) * Math.PI) * 0.5 + 0.5;
    const intensity = Math.floor(80 + (100 * breathe));
    const r = 100, g = 150, b = 255; // Soft blue
    
    for (const [_, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), intensity);
      universe.setAddress(f.getAddress("r" as any), r);
      universe.setAddress(f.getAddress("g" as any), g);
      universe.setAddress(f.getAddress("b" as any), b);
    }
  },
};

const SunsetLook: Look = {
  id: 3,
  name: "Sunset",
  render: ({ universe, time }) => {
    // Warm sunset colors that slowly shift
    const cycle = (time.nowMs / 10000) % 1; // 10 second cycle
    const intensity = 140;
    const r = Math.floor(255 - (100 * cycle));
    const g = Math.floor(120 - (60 * cycle));
    const b = Math.floor(30 + (50 * cycle));
    
    for (const [_, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), intensity);
      universe.setAddress(f.getAddress("r" as any), r);
      universe.setAddress(f.getAddress("g" as any), g);
      universe.setAddress(f.getAddress("b" as any), b);
    }
  },
};

const MoonlightLook: Look = {
  id: 4,
  name: "Moonlight",
  render: ({ universe }) => {
    const intensity = 90; // Very soft
    const r = 180, g = 200, b = 255; // Cool moonlight blue
    
    for (const [_, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), intensity);
      universe.setAddress(f.getAddress("r" as any), r);
      universe.setAddress(f.getAddress("g" as any), g);
      universe.setAddress(f.getAddress("b" as any), b);
    }
  },
};

export const MellowScene: Scene = {
  id: "mellow",
  name: "Mellow Vibes",
  looks: [SoftWashLook, BreatheLook, SunsetLook, MoonlightLook],
};
