import p5 from "p5";
import { lights } from "../lib/lights";
import { cues } from "../lib/cues";
import { quadIn as ease } from "@bluehexagons/easing";

const s = (p) => {
  p.colorMode(p.HSB);
  const hue = 90;
  let colors = [
    p.color(hue, 75, 100),
    p.color((hue + 120) % 360, 50, 75),
    p.color((hue + 240) % 360, 100, 50),
  ];

  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: colors[0],
      duration: 15,
    },

    [cues[1].key]: {
      background: colors[0],
      duration: 15 * 8,
    },
    [cues[2].key]: {
      background: p.color(0),
      duration: 15,
    },
    [cues[3].key]: {
      background: p.color(255, 0, 255),
      duration: 15,
    },

    // BLACKOUT
    [cues[4].key]: {
      background: colors[0],
      duration: 30,
      color: colors[0],
    },
  };

  let currentKey = null;
  let frameStart = 0;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const width = 1280;
  const height = 800;

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/11/index.html", "_self");
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
    const { background, duration } = params[currentKey || cues[0].key];
    const lerpVal = Math.min((p.frameCount - frameStart) / duration, 1);

    switch (currentKey) {
      case cues[0].key:
      case cues[1].key:
        p.background(colors[0]);

        lights.forEach(
          (light, index) =>
            (light.color = {
              r: p.red(colors[index > 3 ? 1 : 2]),
              g: p.green(colors[index > 3 ? 1 : 2]),
              b: p.blue(colors[index > 3 ? 1 : 2]),
            }),
        );

        if (p.frameCount % duration === 1) {
          colors = [colors[1], colors[2], colors[0]];
        }
        break;

      case cues[2].key:
      case cues[3].key:
        // p.noStroke();
        p.rectMode(p.CENTER);
        p.background(background);

        const gridSize = width / 10;
        let squares = [];

        for (let x = gridSize / 2; x < width; x += gridSize) {
          for (let y = gridSize / 2; y <= height; y += gridSize) {
            const squareSize =
              gridSize *
              (currentKey === cues[2].key
                ? 1
                : p.noise(
                    (x + (p.frameCount % duration)) / 25,
                    (y + (p.frameCount % duration)) / 25,
                  ) + 1);

            squares.push({
              color:
                colors[
                  p.floor(
                    p.noise(
                      (x + p.frameCount) / 100,
                      (y + p.frameCount) / 100,
                    ) * colors.length,
                  )
                ],
              x,
              y,
              squareSize,
            });
          }
        }

        squares.sort((a, b) => a.squareSize - b.squareSize);
        squares.forEach(({ color, x, y, squareSize }) => {
          p.fill(color);
          p.square(x, y, squareSize);
        });

        lights.forEach((light, index) => {
          const thisColor =
            colors[
              p.floor(p.noise((index + p.frameCount) / 10) * colors.length)
            ];
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });
        break;

      // BLACKOUT
      case cues[4].key:
        p.blendMode(p.BLEND);

        const thisColor = p.lerpColor(background, p.color(0), ease(lerpVal));
        p.background(thisColor);

        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(thisColor),
              g: p.green(thisColor),
              b: p.blue(thisColor),
            }),
        );
        break;

      // INITIAL LOOK
      default:
        p.background(p.lerpColor(p.color(0), background, lerpVal));

        lights.forEach((light, index) => {
          const { r, g, b, master } = currentLightsState
            ? currentLightsState[index]
            : previousLightsState[index];
          const currentColor = p.color(r, g, b);
          const thisColor = p.lerpColor(
            currentColor,
            index > 3 ? colors[1] : colors[2],
            lerpVal,
          );
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
