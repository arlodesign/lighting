import type { Look, Scene } from "@/runtime/types";

// Mellow, atmospheric scene for slower songs and ambient moments
const SoftWashLook: Look = {
  id: 1,
  name: "Soft Wash",
  render: ({ lights }) => {
    lights?.all.rgb(150, 100, 200).master(120);
  },
};

const BreatheLook: Look = {
  id: 2,
  name: "Breathe",
  render: ({ t, lights }) => {
    if (!t || !lights) return;
    const breathe = Math.sin((t.nowMs / 3000) * Math.PI) * 0.5 + 0.5;
    const intensity = Math.floor(80 + 100 * breathe);
    lights.all.rgb(100, 150, 255).master(intensity);
  },
};

const SunsetLook: Look = {
  id: 3,
  name: "Sunset",
  render: ({ t, lights }) => {
    if (!t || !lights) return;
    const cycle = (t.nowMs / 10000) % 1; // 10 second cycle
    const r = Math.floor(255 - 100 * cycle);
    const g = Math.floor(120 - 60 * cycle);
    const b = Math.floor(30 + 50 * cycle);
    lights.all.rgb(r, g, b).master(140);
  },
};

const MoonlightLook: Look = {
  id: 4,
  name: "Moonlight",
  render: ({ lights }) => {
    lights?.all.rgb(180, 200, 255).master(90);
  },
};

export const MellowScene: Scene = {
  id: "mellow",
  name: "Mellow Vibes",
  looks: [SoftWashLook, BreatheLook, SunsetLook, MoonlightLook],
};
