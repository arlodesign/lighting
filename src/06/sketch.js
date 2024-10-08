import p5 from "p5";
import { lights } from "../lib/lights";
import { cues } from "../lib/cues";
import randomInteger from "random-int";

const s = (p) => {
  const params = {
    // INITIAL LOOK
    z: {
      background: p.color(255, 0, 0),
      duration: 30,
    },

    5: {
      background: p.color(0),
      duration: 0,
    },
    m: {
      background: p.color(255),
      duration: 15,
    },
    "-": {
      background: p.color(255, 0, 0),
      duration: 45,
    },

    // BLACKOUT
    Enter: {
      background: p.color(0),
      duration: 0,
      color: p.color(0),
    },
  };

  let currentKey = cues[0].key;
  let frameStart = 0;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const width = 1280 / 4;
  const height = 800 / 4;

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/7/index.html", "_self");
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
    const lerpVal = Math.min((p.frameCount - frameStart) / duration, 1);

    switch (currentKey) {
      case cues[1].key:
        p.background(background);

        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(255),
              g: p.green(0),
              b: p.blue(0),
            }),
        );
        break;

      case cues[2].key:
        if (p.frameCount % duration === 0) {
          lights.forEach(
            (light) =>
              (light.color = {
                r: 0,
                g: 0,
                b: 0,
              }),
          );

          lights[randomInteger(lights.length - 1)].color = {
            r: 255,
            g: 255,
            b: 255,
          };
        }

        if (p.frameCount % (duration * 2) === 0) {
          p.background(background);
          p.noStroke();

          let y = (p.height / 7) * randomInteger(6);
          p.fill("black");
          p.rect(0, y, p.width, p.height / 7);

          const x = (p.width / 5) * randomInteger(4);
          p.fill("red");
          p.rect(x, 0, p.width / 5, p.height);

          y = (p.height / 9) * randomInteger(8);
          p.fill("black");
          p.rect(0, y, p.width, p.height / 9);
        }

        break;

      case cues[3].key:
        if (p.frameCount % duration === 0) {
          lights.forEach(
            (light) =>
              (light.color = {
                r: p.red(p.color("gold")),
                g: p.green(p.color("gold")),
                b: p.blue(p.color("gold")),
              }),
          );

          lights[randomInteger(lights.length - 1)].color = {
            r: 255,
            g: 255,
            b: 255,
          };
        }

        p.background(background);

        for (let index = 0; index < 20; index++) {
          p.stroke("white");
          p.line(
            0,
            p.noise((p.frameCount / 2000) * index) * height,
            p.width,
            p.noise((p.frameCount / 2000) * index) * height,
          );

          p.stroke("black");
          p.rect(
            p.noise((p.frameCount / 5000) * index) * width,
            0,
            p.noise((p.frameCount / 5000) * index) * width,
            p.height,
          );
        }

        const maskColor = p.color("white");
        maskColor.setAlpha((1 - lerpVal) * 255);

        p.noStroke();
        p.fill(maskColor);
        p.rect(0, 0, width, height);
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
        p.background(p.lerpColor(p.color("black"), p.color("red"), lerpVal));

        lights.forEach((light, index) => {
          const { r, g, b } = currentLightsState
            ? currentLightsState[index]
            : previousLightsState[index];
          const currentColor = p.color(r, g, b);
          const thisColor = p.lerpColor(
            currentColor,
            p.color("black"),
            lerpVal,
          );
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
