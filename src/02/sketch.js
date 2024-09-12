import p5 from "p5";
import { lights } from "../lights";

const s = (p) => {
  const pink = p.color("#EF65A7");
  const purple = p.color("#330099");

  const params = {
    // INITIAL LOOK
    z: {
      background: p.color(0),
      duration: 60,
    },

    5: {
      background: purple,
      duration: 200,
    },
    m: {
      background: pink,
      duration: 45,
    },

    // BLACKOUT
    Enter: {
      background: p.color(0),
      color: p.color(0),
    },
  };

  let currentKey = "z";
  let frameStart = 0;

  const width = 1280 / 4;
  const height = 800 / 4;
  const boxSize = 20;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;
  let alternate = true;

  p.setup = () => {
    p.createCanvas(width, height);
    p.stroke(0);
    p.strokeWeight(2);
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") window.open("/03/index.html");
    currentKey = Object.keys(params).includes(p.key) ? p.key : currentKey;
    frameStart = p.frameCount;
    currentLightsState = JSON.parse(JSON.stringify(lights));
  };

  p.draw = () => {
    const { background, duration } = params[currentKey];
    const lerpVal = (p.frameCount - frameStart) / duration;

    switch (currentKey) {
      case "5":
        p.background(background);
        for (let x = 0; x < width; x += boxSize) {
          for (let y = 0; y < height; y += boxSize) {
            p.fill(
              p.noise(x / 50, y / 50, p.frameCount / 100) < 0.5 ? pink : purple,
            );
            p.rect(x, y, boxSize, boxSize);
          }
        }

        if (p.frameCount % 100 === 0) alternate = !alternate;

        lights.forEach((light, index) => {
          const thisColor =
            index % 2 ? (alternate ? pink : purple) : alternate ? purple : pink;
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });
        break;

      case "m":
        const currentColor = p.lerpColor(pink, p.color(0), lerpVal);

        p.background(currentColor);

        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(currentColor),
              g: p.green(currentColor),
              b: p.blue(currentColor),
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
        break;

      // INITIAL LOOK
      default:
        p.background(background);
        const { r, g, b } = currentLightsState || previousLightsState;

        lights.forEach((light, index) => {
          const currentColor = p.color(r, g, b);
          const thisColor =
            index % 2
              ? p.lerpColor(currentColor, pink, lerpVal)
              : p.lerpColor(currentColor, purple, lerpVal);
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });
        break;
    }
  };
};

new p5(s, document.getElementById("sketch"));
