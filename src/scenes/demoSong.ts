import type { Look, Scene } from "@/runtime/types";

// Simple two-look scene to validate the loop
const Look1: Look = {
  id: 1,
  name: "Warm Wash",
  render: ({ lights }) => {
    lights?.all.rgb(200, 90, 20).master(160);
  },
};

const Look2: Look = {
  id: 2,
  name: "Cool Pulse",
  render: ({ t, lights }) => {
    if (!t || !lights) return;
    const base = 120 + 80 * Math.sin(t.nowMs * 0.002);
    lights.all
      .rgb(40, 120, 220)
      .master(Math.round(Math.max(0, Math.min(255, base))));
  },
};

export const DemoSong: Scene = {
  id: "demo-song",
  name: "Demo Song",
  looks: [Look1, Look2],
};
