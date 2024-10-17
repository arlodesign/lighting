import p5 from "p5";
import { lights, lightsObj } from "../lib/lights";
import { cues } from "../lib/cues";
import tinycolor from "tinycolor2";
import { quadInOut } from "@bluehexagons/easing";

const s = (p) => {
  const lightBlue = p.color("#1c91ae");
  const darkBlue = p.color("#174f9d");
  const green = p.color("#236177");
  const yellow = p.color("#e1cf15");

  const colors = [lightBlue, darkBlue, green];
  const colorsBrighter = colors.map((color) => {
    const newColor = tinycolor(
      `rgb(${p.red(color)},${p.green(color)},${p.blue(color)})`,
    )
      .brighten(20)
      .toString();
    return p.color(newColor);
  });

  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: p.color(0),
      duration: 30,
    },

    [cues[1].key]: {
      background: p.color(0),
      duration: 20,
    },
    [cues[2].key]: {
      background: p.color(0),
      duration: 15,
    },
    [cues[3].key]: {
      background: p.color(255, 0, 255),
      duration: 0,
    },

    // BLACKOUT
    [cues[4].key]: {
      background: p.color(0),
      duration: 7 * 30,
      color: p.color(0),
    },
  };

  let currentKey = null;
  let frameStart = 0;
  let flipFlop = false;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const width = 1280 / 2;
  const height = 800 / 2;

  function drawWater(theseColors = colors) {
    const noiseFactor = 6000 - p.frameCount;

    for (let i = 0; i <= 30; i++) {
      const y = (height / 30) * i;
      p.fill(theseColors[i % theseColors.length]);
      p.beginShape();
      p.curveVertex(0, y);
      for (let x = 0; x <= width; x += width / 20) {
        const noiseVal =
          p.noise(
            (y + p.frameCount) / noiseFactor,
            (x + p.frameCount) / noiseFactor,
          ) - 0.5;
        p.curveVertex(x, y + noiseVal * (width / 20));
      }
      p.curveVertex(width, y);
      p.endShape();
    }
  }

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/15/index.html", "_self");
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

        let thisGreen = p.lerpColor(p.color(0), green, lerpVal);
        let thisYellow = p.lerpColor(p.color(0), yellow, lerpVal);
        ["JEREMY_SL", "TORI_SL", "BECKY_SR", "ARLO_SR"].forEach(
          (light) =>
            (lightsObj[light].color = {
              r: p.red(thisGreen),
              g: p.green(thisGreen),
              b: p.blue(thisGreen),
            }),
        );
        ["JEREMY_SR", "TORI_SR", "BECKY_SL", "ARLO_SL"].forEach(
          (light) =>
            (lightsObj[light].color = {
              r: p.red(thisYellow),
              g: p.green(thisYellow),
              b: p.blue(thisYellow),
            }),
        );
        drawWater();
        break;

      case cues[1].key:
        p.background(background);

        if (p.frameCount % duration === 0) flipFlop = !flipFlop;

        const color1 = p.lerpColor(
          p.color(0),
          flipFlop ? yellow : green,
          lerpVal,
        );
        const color2 = p.lerpColor(
          p.color(0),
          flipFlop ? green : yellow,
          lerpVal,
        );
        ["JEREMY_SL", "TORI_SL", "BECKY_SR", "ARLO_SR"].forEach(
          (light) =>
            (lightsObj[light].color = {
              r: p.red(color1),
              g: p.green(color1),
              b: p.blue(color1),
            }),
        );
        ["JEREMY_SR", "TORI_SR", "BECKY_SL", "ARLO_SL"].forEach(
          (light) =>
            (lightsObj[light].color = {
              r: p.red(color2),
              g: p.green(color2),
              b: p.blue(color2),
            }),
        );
        drawWater(colorsBrighter);
        break;

      case cues[2].key:
        p.background(background);

        if (p.frameCount % duration === 0) {
          lights.forEach((light) => {
            const thisColor = colorsBrighter[p.floor(p.random() * 3)];
            return (light.color = {
              r: p.red(thisColor),
              g: p.green(thisColor),
              b: p.blue(thisColor),
            });
          });
        }
        drawWater(colorsBrighter);
        break;

      // BLACKOUT
      case cues[4].key:
        p.blendMode(p.BLEND);
        p.background(background);

        lights.forEach((light, index) => {
          const { r, g, b, master } = currentLightsState
            ? currentLightsState[index]
            : previousLightsState[index];
          const currentColor = p.color(r, g, b);
          light.master = p.round(p.lerp(master, 0, lerpVal));
        });

        drawWater(
          colorsBrighter.map((c) => p.lerpColor(c, p.color(0), lerpVal)),
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
          const thisColor = p.lerpColor(currentColor, background, lerpVal);
          light.master = p.round(p.lerp(master, 255, lerpVal));
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });

        drawWater(colors.map((c) => p.lerpColor(p.color(0), c, lerpVal)));
        break;
    }

    lights.forEach((l) => l.update());
  };
};

new p5(s, document.getElementById("sketch"));
