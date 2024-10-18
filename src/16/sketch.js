import p5 from "p5";
import { lights, lightsObj } from "../lib/lights";
import { cues } from "../lib/cues";
import { linear, quadInOut } from "@bluehexagons/easing";

const s = (p) => {
  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: p.color(0),
      duration: 60,
    },

    [cues[1].key]: {
      background: p.color(0),
      duration: 360,
    },
    [cues[2].key]: {
      background: p.color(0),
      duration: 480,
    },
    [cues[3].key]: {
      background: p.color(0),
      duration: 1280,
    },

    // BLACKOUT
    [cues[4].key]: {
      background: p.color(0),
      duration: 120,
      color: p.color(0),
    },
  };

  let currentKey = null;
  let frameStart = 0;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const width = 1280 / 2;
  const height = 800 / 2;

  function drawClouds(color1, color2, lerpVal, ease) {
    const thisEase = ease || linear;

    p.noStroke();
    for (let x = 0; x < width; x += width / 60) {
      for (let y = 0; y < height; y += height / 40) {
        const noiseVal = p.noise(
          (x + p.frameCount) / 200,
          (y + p.frameCount) / 200,
        );
        const lerpNoiseVal = p.lerp(noiseVal, thisEase(noiseVal), lerpVal);
        p.fill(p.lerpColor(color1, color2, lerpNoiseVal));
        p.rect(x, y, width / 40, height / 40);
      }
    }
  }

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/17/index.html", "_self");
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
        p.background(background);
        drawClouds(p.color(25), p.color(150), lerpVal);

        lightsObj["TORI_SR"].color = {
          r: 255,
          g: 0,
          b: 0,
        };
        lightsObj["TORI_SR"].master = p.floor(p.lerp(0, 128, lerpVal));
        lightsObj["TORI_SL"].color = {
          r: 255,
          g: 255,
          b: 255,
        };
        lightsObj["TORI_SL"].master = p.floor(p.lerp(0, 100, lerpVal));

        break;

      case cues[1].key:
        p.background(background);
        drawClouds(p.color(25), p.color(150), lerpVal);

        ["JEREMY", "BECKY", "ARLO"].forEach((name) => {
          lightsObj[`${name}_SR`].color = {
            r: 255,
            g: 0,
            b: 0,
          };
          lightsObj[`${name}_SR`].master = p.floor(p.lerp(0, 100, lerpVal));
          lightsObj[`${name}_SL`].color = {
            r: 255,
            g: 255,
            b: 255,
          };
          lightsObj[`${name}_SL`].master = p.floor(p.lerp(0, 75, lerpVal));
        });
        break;

      case cues[2].key:
        p.background(background);
        drawClouds(
          p.lerpColor(p.color(25), p.color(25, 25, 50), lerpVal),
          p.lerpColor(p.color(150), p.color(200), lerpVal),
          lerpVal,
        );

        ["JEREMY", "BECKY", "ARLO"].forEach((name) => {
          lightsObj[`${name}_SR`].color = {
            r: 255,
            g: 0,
            b: 0,
          };
          lightsObj[`${name}_SR`].master = p.floor(p.lerp(100, 128, lerpVal));
          lightsObj[`${name}_SL`].color = {
            r: 255,
            g: 255,
            b: 255,
          };
          lightsObj[`${name}_SL`].master = p.floor(p.lerp(75, 100, lerpVal));
        });
        break;

      case cues[3].key:
        p.background(background);
        drawClouds(
          p.lerpColor(p.color(25, 25, 50), p.color("deepskyblue"), lerpVal),
          p.lerpColor(p.color(200), p.color(255), lerpVal),
          lerpVal,
          quadInOut,
        );
        const skyblue = p.lerpColor(
          p.color(255, 0, 0),
          p.color("skyblue"),
          lerpVal,
        );

        lights.forEach((light) => {
          if (light.name.includes("_SR")) {
            light.master = p.floor(p.lerp(100, 255, lerpVal));
            light.color = {
              r: p.red(skyblue),
              g: p.green(skyblue),
              b: p.blue(skyblue),
            };

            return;
          }

          light.master = p.floor(p.lerp(128, 255, lerpVal));
        });
        break;

      // BLACKOUT
      case cues[4].key:
        p.blendMode(p.BLEND);
        p.background(0);
        drawClouds(
          p.lerpColor(p.color("deepskyblue"), p.color(0), lerpVal),
          p.lerpColor(p.color(255), p.color(0), lerpVal),
          lerpVal,
          quadInOut,
        );

        lights.forEach((light) => {
          if (lerpVal === 1) {
            light.color = { r: 0, g: 0, b: 0 };
          }
          return (light.master = p.lerp(255, 0, lerpVal));
        });

        break;

      // INITIAL LOOK
      default:
        p.background(background);
        drawClouds(
          p.color(Math.min(p.frameCount / 4, 25)),
          p.color(Math.min(p.frameCount / 2, 150)),
          lerpVal,
          quadInOut,
        );

        lights.forEach((light, index) => {
          const { r, g, b, master } = currentLightsState
            ? currentLightsState[index]
            : previousLightsState[index];
          const currentColor = p.color(r, g, b);
          const thisColor = p.lerpColor(currentColor, background, lerpVal);
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
