import type { Look, Scene } from "@/runtime/types";
import { allFixtures } from "@/data/fixtures";

// Calibration scene: provides projector alignment and fixture check without creative content.
// Look 1: Projector test grid + all fixtures to neutral white at mid intensity.
const CalibrationLook: Look = {
  id: 1,
  name: "Calibration",
  render: ({ p5, universe }) => {
    // DMX: neutral white mid-intensity across all fixtures
    for (const [_, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), 160);
      universe.setAddress(f.getAddress("r" as any), 200);
      universe.setAddress(f.getAddress("g" as any), 200);
      universe.setAddress(f.getAddress("b" as any), 200);
    }

    // Visuals: draw only if p5 is available (no placeholder drawing otherwise)
    if (!p5) return;

    const w = p5.width, h = p5.height;
    p5.clear();
    p5.background(0);

    // Outer safe frame
    p5.stroke(255);
    p5.noFill();
    p5.strokeWeight(2);
    p5.rect(8, 8, w - 16, h - 16, 2);

    // Grid lines (rule of thirds)
    p5.stroke(120);
    p5.strokeWeight(1);
    for (const x of [w / 3, (2 * w) / 3]) p5.line(x, 8, x, h - 8);
    for (const y of [h / 3, (2 * h) / 3]) p5.line(8, y, w - 8, y);

    // Center crosshair
    p5.stroke(255);
    p5.strokeWeight(1.5);
    p5.line(w / 2 - 16, h / 2, w / 2 + 16, h / 2);
    p5.line(w / 2, h / 2 - 16, w / 2, h / 2 + 16);

    // Corner markers
    p5.stroke(200);
    const m = 18;
    p5.line(8, 8 + m, 8, 8); p5.line(8, 8, 8 + m, 8);
    p5.line(w - 8, 8 + m, w - 8, 8); p5.line(w - 8 - m, 8, w - 8, 8);
    p5.line(8, h - 8 - m, 8, h - 8); p5.line(8, h - 8, 8 + m, h - 8);
    p5.line(w - 8, h - 8 - m, w - 8, h - 8); p5.line(w - 8 - m, h - 8, w - 8, h - 8);

    // Label
    p5.noStroke();
    p5.fill(255);
    p5.textAlign(p5.CENTER, p5.TOP);
    p5.textSize(16);
    p5.text("Calibration — Align projector; fixtures at neutral white", w / 2, 12);
  },
};

export const CalibrationScene: Scene = {
  id: "calibration",
  name: "Calibration",
  looks: [CalibrationLook],
};

