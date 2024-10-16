import p5 from "p5";
import { lights } from "../lib/lights";
import { cues } from "../lib/cues";

const s = (p) => {
  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: p.color(0),
      duration: 60,
    },

    [cues[1].key]: {
      background: p.color(0),
      duration: 60,
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

  let currentKey = cues[0].key;
  let frameStart = 0;
  let fadeInFrameStart = 0;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const width = 1280 / 10;
  const height = 800 / 10;

  const scale = 4;
  const cols = width / scale;
  const rows = height / scale;

  let chaseLightColors = [
    p.color("#72b4d8"),
    p.color("#c8ebfb"),
    p.color("#acd7ee"),
    p.color("#82c1e5"),
    p.color("#338dc4"),
    p.color("#4da1d1"),
    p.color("#11659c"),
    p.color("#96c2e0"),
  ];
  let nextChaseLightColors = chaseLightColors
    .slice(1)
    .concat(chaseLightColors[0]);

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/08/index.html", "_self");
      return;
    }
    const thisKey = Object.keys(params).includes(p.key) ? p.key : currentKey;
    if (thisKey !== currentKey) {
      currentKey = thisKey;
      frameStart = p.frameCount;
      fadeInFrameStart = p.frameCount;
      currentLightsState = JSON.parse(JSON.stringify(lights));
      cues.forEach((c) => (c.isCurrent = c.key === currentKey));
    }
  };

  p.draw = () => {
    const { background, duration } = params[currentKey];
    const lerpVal = Math.min((p.frameCount - frameStart) / duration, 1);

    switch (currentKey) {
      case cues[1].key:
        p.background(background);
        const waterColor = p.lerpColor(
          chaseLightColors[0],
          nextChaseLightColors[0],
          lerpVal,
        );
        waterColor.setAlpha(
          Math.min((p.frameCount - fadeInFrameStart) / (duration * 10), 1) *
            192,
        );
        p.fill(waterColor);
        p.noStroke();

        p.scale(scale);
        // https://editor.p5js.org/ManualDoCodigo/sketches/lm-Cqws8K
        const t = p.frameCount / 100;
        for (let x = 0; x <= cols; x++) {
          for (let y = 0; y <= rows; y++) {
            p.rect(
              x,
              rows - y,
              ((p.sin(y * y + x / y - t * 7) +
                p.cos(y ** 5 - (x / y) * 6 + t) ** 3) *
                y) /
                50,
              1,
            );
          }
        }

        lights.forEach((light, index) => {
          const prevColor = chaseLightColors[index];
          const nextColor = nextChaseLightColors[index];
          const thisColor = p.lerpColor(prevColor, nextColor, lerpVal);
          light.master = p.round(
            p.lerp(
              255,
              128,
              Math.min((p.frameCount - fadeInFrameStart) / (duration * 10), 1),
            ),
          );
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });

        if (lerpVal === 1) {
          chaseLightColors = nextChaseLightColors;
          nextChaseLightColors = chaseLightColors
            .slice(1)
            .concat(chaseLightColors[0]);
          frameStart = p.frameCount;
        }

        break;

      case cues[2].key:
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
          const { r, g, b, master } = currentLightsState
            ? currentLightsState[index]
            : previousLightsState[index];
          const currentColor = p.color(r, g, b);
          const thisColor = p.lerpColor(
            currentColor,
            chaseLightColors[index],
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
