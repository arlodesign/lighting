import p5 from "p5";
import { lights } from "../lib/lights";
import { cues } from "../lib/cues";

const s = (p) => {
  const pink = p.color("#EF65A7");
  const purple = p.color("#330099");
  const gold = p.color("#FFD700");
  const black = p.color(0);

  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: black,
      duration: 60,
    },

    [cues[1].key]: {
      background: black,
      duration: 200,
    },
    [cues[2].key]: {
      background: black,
      duration: 200,
    },
    [cues[3].key]: {
      background: pink,
      duration: 45,
    },

    // BLACKOUT
    [cues[4].key]: {
      background: black,
      color: black,
    },
  };

  let currentKey = cues[0].key;
  let frameStart = 0;

  const width = 1280 / 4;
  const height = 800 / 4;
  const diameter = 10;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;
  let alternate = true;

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
    p.stroke(0);
    p.strokeWeight(4);
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/03/index.html", "_self");
      return;
    }
    const thisKey = Object.keys(params).includes(p.key) ? p.key : currentKey;
    if (thisKey !== currentKey) {
      currentKey = thisKey;
      frameStart = p.frameCount;
      currentLightsState = JSON.parse(JSON.stringify(lights));
      cues.forEach((c) => (c.isCurrent = c.key === currentKey));
    }
  };

  p.draw = () => {
    const { background, duration } = params[currentKey];
    const lerpVal = (p.frameCount - frameStart) / duration;

    switch (currentKey) {
      case cues[1].key:
      case cues[2].key:
        p.background(background);
        for (let x = 0; x < width; x += diameter * 2) {
          for (let y = 0; y < height; y += diameter * 2) {
            p.fill(
              p.noise(
                x / 50,
                y / 50,
                p.frameCount / (currentKey === "5" ? 1000 : 100),
              ) < 0.5
                ? pink
                : purple,
            );
            p.circle(x + diameter / 2, y + diameter / 2, diameter);
          }
        }

        if (p.frameCount % 100 === 0) alternate = !alternate;

        lights.forEach((light, index) => {
          const thisColor =
            index % 2 ? (alternate ? gold : black) : alternate ? black : gold;
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });
        break;

      case cues[3].key:
        const currentColor = p.lerpColor(gold, p.color(0), lerpVal);

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
      case cues[4].key:
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

        lights.forEach((light, index) => {
          const { r, g, b } = Boolean(currentLightsState)
            ? currentLightsState[index]
            : previousLightsState[index];
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
