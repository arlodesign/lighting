import type { Look, Scene } from "@/runtime/types";

// --- Scene-level visual state (ported from the provided p5 sketch) ---
type Pt = { x: number; y: number; vx: number; vy: number };
type Shape = { points: Pt[]; cf: ((a: number) => number)[] };
let shapes: Shape[] | null = null;
let lastSize: { w: number; h: number } | null = null;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const colorFns = [
  (a: number) => Math.max(15, Math.abs(Math.sin(a)) * 240),
  (a: number) => Math.max(15, Math.abs(Math.sin(a + Math.PI)) * 240),
  (a: number) => Math.max(15, Math.abs(Math.cos(-a)) * 240),
  (a: number) => Math.max(15, Math.abs(Math.cos(-a + Math.PI)) * 240),
];

const makeShape = (w: number, h: number): Shape => ({
  cf: [pick(colorFns), pick(colorFns), pick(colorFns)],
  points: new Array(10).fill(0).map(() => ({
    x: rand(0, w),
    y: rand(0, h),
    vx: rand(-1, 1),
    vy: rand(-1, 1),
  })),
});

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
  updateVisual: (ctx) => {
    const p5 = ctx.p5 as any;
    if (!p5) return;
    // (Re)create shapes if first frame or size changed
    const w = p5.width,
      h = p5.height;
    if (!shapes || !lastSize || lastSize.w !== w || lastSize.h !== h) {
      shapes = new Array(3).fill(0).map(() => makeShape(w, h));
      lastSize = { w, h };
    }
    // Move points and bounce within bounds
    for (const s of shapes!)
      for (const p of s.points) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
  },
  drawVisual: (p5, ctx) => {
    if (!p5 || !shapes) return;
    const a = ctx.t ? ctx.t.nowMs / 1000 : p5.frameCount / 60;
    p5.background(0);
    shapes.forEach((s, i) => {
      const col = p5.color(s.cf[0](a), s.cf[1](a), s.cf[2](a), 128);
      if (i !== 1) {
        p5.noStroke();
        p5.fill(col);
      } else {
        p5.noFill();
        p5.strokeWeight(4);
        p5.stroke(col);
      }
      p5.beginShape();
      s.points.forEach((p) => p5.vertex(p.x, p.y));
      p5.endShape(p5.CLOSE);
    });
  },
};
