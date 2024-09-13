import p5 from "p5";
import { lights } from "../lib/lights";

const s = (p) => {
  const width = 1280;
  const height = 800;
  const squareSize = 20;

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
  };
};

new p5(s, document.getElementById("sketch"));
