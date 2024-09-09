import p5 from "p5";
import { lights } from "../lights";

const s = (p) => {
  const params = {
    5: {
      background: p.color(255),
    },
    m: {
      background: p.color(127),
    },
    "-": {
      background: p.color(255, 0, 0),
    },

    // INITIAL LOOK
    z: {
      background: p.color(0),
    },
  };

  let currentKey = "z";

  const width = 1280;
  const height = 800;

  p.setup = () => {
    p.createCanvas(width, height);
  };

  p.keyPressed = () => {
    currentKey = Object.keys(params).includes(p.key) ? p.key : currentKey;
  };

  p.draw = () => {
    const { background } = params[currentKey];
    p.background(background);

    switch (currentKey) {
      case "f":
        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(background),
              g: p.green(background),
              b: p.blue(background),
            }),
        );
        break;

      case "j":
        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(background),
              g: p.green(background),
              b: p.blue(background),
            }),
        );
        break;

      case ";":
        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(background),
              g: p.green(background),
              b: p.blue(background),
            }),
        );
        break;

      // INITIAL LOOK
      default:
        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(background),
              g: p.green(background),
              b: p.blue(background),
            }),
        );
        break;
    }
  };
};

new p5(s, document.getElementById("sketch"));
