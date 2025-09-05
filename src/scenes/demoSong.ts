import { allFixtures } from "@/data/fixtures";
import type { Look, Scene } from "@/runtime/types";

// Simple two-look scene to validate the loop
const Look1: Look = {
  id: 1,
  name: "Warm Wash",
  render: ({ universe, tempo }) => {
    const intensity = 160; // default master
    const r = 200, g = 90, b = 20;
    for (const [id, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), intensity);
      universe.setAddress(f.getAddress("r" as any), r);
      universe.setAddress(f.getAddress("g" as any), g);
      universe.setAddress(f.getAddress("b" as any), b);
    }
  },
};

const Look2: Look = {
  id: 2,
  name: "Cool Pulse",
  render: ({ time, universe, tempo }) => {
    const t = time.nowMs * 0.002; // slow LFO
    const base = 120 + 80 * Math.sin(t);
    const r = 40, g = 120, b = 220;
    for (const [id, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), Math.round(Math.max(0, Math.min(255, base))));
      universe.setAddress(f.getAddress("r" as any), r);
      universe.setAddress(f.getAddress("g" as any), g);
      universe.setAddress(f.getAddress("b" as any), b);
    }
  },
};

export const DemoSong: Scene = {
  id: "demo-song",
  name: "Demo Song",
  looks: [Look1, Look2],
};

