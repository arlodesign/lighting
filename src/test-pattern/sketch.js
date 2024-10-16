import p5 from "p5";
import { lights } from "../lib/lights";

const s = (p) => {
  const width = 1280;
  const height = 800;
  const squareSize = 20;

  // Tap tempo
  let start;
  let end;
  let values = [];

  p.keyPressed = () => {
    if (p.key === "`") {
      if (start) {
        end = window.performance.now();
        values.push(end - start);
        start = window.performance.now();
        console.log(values.reduce((a, b) => a + b, 0) / values.length / 1000);
      }
      start = window.performance.now();
    }
  };

  p.setup = () => {
    p.createCanvas(width, height);
    p.background(0);
    p.noFill();
    p.strokeWeight(2);
    p.stroke(255);
    for (let x = 0; x <= width; x += squareSize) {
      for (let y = 0; y <= height; y += squareSize) {
        p.point(x, y);
      }
    }

    p.stroke("green");
    [720, 640, 480, 320].forEach((d) => p.circle(width / 2, height / 2, d));

    lights.forEach(
      (light, index) =>
        (light.color = {
          r: index % 2 ? 255 : 0,
          g: index % 2 ? 0 : 255,
          b: 127,
        }),
    );

    lights.forEach((l) => l.update());
  };
};

new p5(s, document.getElementById("sketch"));
