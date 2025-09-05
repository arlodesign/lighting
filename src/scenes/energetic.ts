import type { Look, Scene } from "@/runtime/types";

// High-energy scene with dynamic lighting for upbeat songs
const StrobeLook: Look = {
  id: 1,
  name: "Strobe Flash",
  render: ({ lights, t }) => {
    if (!lights || !t) return;
    // Beat-driven white flash
    const onBeat = t.beat();
    lights.all.rgb(255, 255, 255).master(onBeat ? 255 : 0);
  },
};

const ColorChaseLook: Look = {
  id: 2,
  name: "Color Chase",
  render: ({ lights, t }) => {
    if (!lights || !t) return;
    const c = (t.nowMs / 1000) % 3;
    const r = c < 1 ? 255 : 0;
    const g = c >= 1 && c < 2 ? 255 : 0;
    const b = c >= 2 ? 255 : 0;
    lights.all.rgb(r, g, b).master(200);
  },
};

const PulseLook: Look = {
  id: 3,
  name: "Pulse",
  render: ({ lights, t }) => {
    if (!lights || !t) return;
    const x = t.sin01(t.beatPhase);
    const intensity = Math.floor(100 + 155 * x);
    lights.all.rgb(255, 100, 0).master(intensity);
  },
};

const BuildupLook: Look = {
  id: 4,
  name: "Buildup",
  render: ({ lights, t }) => {
    if (!lights || !t) return;
    const c = t.cycle(8000); // 8s
    const intensity = Math.floor(50 + 205 * c);
    const r = Math.floor(255 * c);
    const g = Math.floor(150 * c);
    const b = Math.floor(50 * c);
    lights.all.rgb(r, g, b).master(intensity);
  },
};

export const EnergeticScene: Scene = {
  id: "energetic",
  name: "High Energy",
  looks: [StrobeLook, ColorChaseLook, PulseLook, BuildupLook],
};
