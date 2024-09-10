import p5 from "p5";
import { lights } from "../lights";

const s = (p) => {
  const params = {
    // INITIAL LOOK
    z: {
      background: p.color(255, 0, 0),
    },

    5: {
      background: p.color(0, 255, 0),
    },
    m: {
      background: p.color(0, 0, 255),
    },
    "-": {
      background: p.color(255, 0, 255),
    },

    // BLACKOUT
    Enter: {
      background: p.color(0),
      color: p.color(0),
    },
  };

  let currentKey = "z";

  const width = 1280;
  const height = 800;

  p.setup = () => {
    p.createCanvas(width, height);
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") window.open("/02/index.html");
    currentKey = Object.keys(params).includes(p.key) ? p.key : currentKey;
  };

  p.draw = () => {
    const { background } = params[currentKey];

    switch (currentKey) {
      case "f":
        p.background(background);

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
        p.background(background);

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
        p.background(background);

        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(background),
              g: p.green(background),
              b: p.blue(background),
            }),
        );
        break;

      // BLACKOUT
      case "Enter":
        p.background(0);

        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(0),
              g: p.green(0),
              b: p.blue(0),
            }),
        );

      // INITIAL LOOK
      default:
        p.background(background);

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
