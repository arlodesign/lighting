import { allFixtures, allFixtureIds } from "@/data/fixtures";
import type { Look, Scene, VisualStyle } from "@/runtime/types";

// Persistent scene state (module-level closure for simplicity)
const CIRCLE_DIAMETER = 60;
const SPEED = 1.5; // px/frame at 60fps-ish
let pos = { x: 400, y: 300 };
let vel = { x: SPEED, y: SPEED * 0.8 };

function updatePosition(width: number, height: number) {
  pos.x += vel.x;
  pos.y += vel.y;
  if (pos.x < CIRCLE_DIAMETER / 2 || pos.x > width - CIRCLE_DIAMETER / 2) vel.x *= -1;
  if (pos.y < CIRCLE_DIAMETER / 2 || pos.y > height - CIRCLE_DIAMETER / 2) vel.y *= -1;
}

function drawCircle(p5: any, style?: VisualStyle) {
  const bg = style?.bg ?? [0, 0, 0];
  const fg = style?.fg ?? [255, 255, 255];
  p5.background(bg[0], bg[1], bg[2]);
  p5.noStroke();
  p5.fill(fg[0], fg[1], fg[2]);
  p5.circle(pos.x, pos.y, CIRCLE_DIAMETER);
}

// --- Looks ---
const Look1: Look = {
  id: 1,
  name: "Orange + White",
  visualStyle: () => ({ bg: [255, 140, 0], fg: [255, 255, 255] }),
  render: ({ universe }) => {
    // Most fixtures orange
    for (const [id, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), 180);
      universe.setAddress(f.getAddress("r" as any), 255);
      universe.setAddress(f.getAddress("g" as any), 120);
      universe.setAddress(f.getAddress("b" as any), 0);
    }

    // Choose one accent fixture to be white based on position bucket
    const bucket = Math.min(3, Math.max(0, Math.floor((pos.x / 800) * 4)));
    const ids = allFixtureIds();
    const idx = Math.min(ids.length - 1, bucket);
    const accentId = ids[idx];
    // set accent to white
    universe.setFixture(accentId, "master" as any, 220);
    universe.setFixture(accentId, "r" as any, 255);
    universe.setFixture(accentId, "g" as any, 255);
    universe.setFixture(accentId, "b" as any, 255);
  },
};

const Look2: Look = {
  id: 2,
  name: "Red + Pink",
  visualStyle: () => ({ bg: [200, 0, 40], fg: [255, 120, 200] }),
  render: ({ universe }) => {
    // All fixtures red/pink wash
    for (const [id, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), 180);
      universe.setAddress(f.getAddress("r" as any), 255);
      universe.setAddress(f.getAddress("g" as any), 50);
      universe.setAddress(f.getAddress("b" as any), 120);
    }

    // Keep the accent mapping based on position, but use pink accent
    const bucket = Math.min(3, Math.max(0, Math.floor((pos.x / 800) * 4)));
    const ids = allFixtureIds();
    const idx = Math.min(ids.length - 1, bucket);
    const accentId = ids[idx];
    universe.setFixture(accentId, "master" as any, 220);
    universe.setFixture(accentId, "r" as any, 255);
    universe.setFixture(accentId, "g" as any, 120);
    universe.setFixture(accentId, "b" as any, 200);
  },
};

export const RandomWalkerScene: Scene = {
  id: "random-walker",
  name: "Random Walker",
  looks: [Look1, Look2],
  updateVisual: ({ p5 }) => {
    if (!p5) return;
    updatePosition(p5.width, p5.height);
  },
  drawVisual: (p5, _ctx, style) => drawCircle(p5, style),
};

