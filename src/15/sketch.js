import p5 from "p5";
import { lights } from "../lib/lights";
import { cues } from "../lib/cues";

const s = (p) => {
  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: p.color("pink"),
      duration: 60,
    },

    [cues[1].key]: {
      background: p.color("pink"),
      duration: 14,
    },
    [cues[2].key]: {
      background: p.color(0, 0, 255),
      duration: 0,
    },
    [cues[3].key]: {
      background: p.color(255, 0, 255),
      duration: 0,
    },

    // BLACKOUT
    [cues[4].key]: {
      background: p.color(0),
      duration: 0,
      color: p.color(0),
    },
  };

  let currentKey = null;
  let frameStart = 0;
  let flipFlop = true;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const width = 1280;
  const height = 800;

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
    p.ellipseMode(p.CENTER);
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/16/index.html", "_self");
      return;
    }
    const thisKey = Object.keys(params).includes(p.key) ? p.key : currentKey;
    if (thisKey !== currentKey) {
      frameStart = p.frameCount;
      currentKey = thisKey;
      currentLightsState = JSON.parse(JSON.stringify(lights));
      cues.forEach((c) => (c.isCurrent = c.key === currentKey));
    }
  };

  p.draw = () => {
    const { background, duration } = params[currentKey || cues[0].key];
    const lerpVal = Math.min((p.frameCount - frameStart) / duration, 1);

    switch (currentKey) {
      case cues[0].key:
        lights.forEach((light) => {
          const color = light.name.includes("_SR")
            ? p.color("pink")
            : p.color("green");
          const thisColor = p.lerpColor(p.color(0), color, lerpVal);
          light.master = 255 * lerpVal;
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });
        break;

      case cues[1].key:
        if (p.frameCount % duration === 0) {
          flipFlop = !flipFlop;

          p.fill(
            [p.color("pink"), p.color("blue"), p.color(0)][p.frameCount % 3],
          );
          p.noStroke();
          p.circle(p.random(width), p.random(height), p.random(height / 2));

          lights.forEach(
            (light) =>
              (light.color = {
                r: p.red(
                  light.name.includes(flipFlop ? "_SR" : "_SL")
                    ? p.color("pink")
                    : p.color("green"),
                ),
                g: p.green(
                  light.name.includes(flipFlop ? "_SR" : "_SL")
                    ? p.color("pink")
                    : p.color("green"),
                ),
                b: p.blue(
                  light.name.includes(flipFlop ? "_SR" : "_SL")
                    ? p.color("pink")
                    : p.color("green"),
                ),
              }),
          );
        }
        break;

      case cues[2].key:
        lights.forEach((light) => {
          const thisColor = light.name.includes("_SR")
            ? p.color("pink")
            : p.color("green");
          return (light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          });
        });
        break;

      case cues[3].key:
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
      case cues[4].key:
        p.blendMode(p.BLEND);
        p.background(0);

        lights.forEach((light) => {
          light.master = 0;
          light.color = {
            r: p.red(0),
            g: p.green(0),
            b: p.blue(0),
          };
        });
        break;

      // INITIAL LOOK
      default:
        p.background(p.lerpColor(p.color(0), background, lerpVal));

        lights.forEach((light, index) => {
          const { r, g, b, master } = currentLightsState
            ? currentLightsState[index]
            : previousLightsState[index];
          const currentColor = p.color(r, g, b);
          const thisColor = p.lerpColor(currentColor, p.color(0), lerpVal);
          light.master = p.round(p.lerp(master, 255, lerpVal));
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });
        break;
    }

    lights.forEach((l) => l.update());
  };
};

new p5(s, document.getElementById("sketch"));
