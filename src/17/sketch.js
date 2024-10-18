import p5 from "p5";
import { lights, lightsObj } from "../lib/lights";
import { cues } from "../lib/cues";
import { AudioSpectrum } from "../lib/audio-spectrum";
import getAverage from "../lib/average";

const s = (p) => {
  const yellow = p.color("yellow");
  const orange = p.color("orange");
  const purple = p.color("purple");
  const colors = [yellow, orange, purple];

  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: p.color(0),
      duration: 60,
    },

    [cues[1].key]: {
      background: p.color(0),
      duration: 52,
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
      duration: 60,
      color: p.color(0),
    },
  };

  let currentKey = null;
  let frameStart = 0;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const spectrum = new AudioSpectrum();
  const spectrumPoints = 21;
  let maxFrequency = Array(spectrumPoints).fill(0);

  const width = 1280;
  const height = 800;

  p.setup = async () => {
    await spectrum.startMicInput();
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/CHANGE/index.html", "_self");
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
    let frequencyData = spectrum.getFrequencyData();
    const { background, duration } = params[currentKey || cues[0].key];
    const lerpVal = Math.min((p.frameCount - frameStart) / duration, 1);

    switch (currentKey) {
      case cues[0].key:
        p.background(background);
        p.fill(255);
        p.stroke(0);

        lights.forEach((light, index) => {
          const thisColor =
            colors[p.floor(p.noise((index * 20 + p.frameCount) / 20) * 3)];
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
          light.master = 255;
        });

        break;

      case cues[1].key:
        p.background(background);

        lights.forEach((light, index) => {
          const thisColor =
            colors[p.floor(p.noise((index * 20 + p.frameCount) / 50) * 3)];
          light.master = p.lerp(255, 64, lerpVal);
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };

          lightsObj["TORI_SL"].color = {
            r: p.red(purple),
            g: p.green(purple),
            b: p.blue(purple),
          };
          lightsObj["TORI_SL"].master = 255;
          lightsObj["TORI_SR"].color = {
            r: p.red(orange),
            g: p.green(orange),
            b: p.blue(orange),
          };
          lightsObj["TORI_SR"].master = 255;
        });

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
        const thisLerp = p.lerp(255, 0, lerpVal);

        p.fill(thisLerp);
        lights.forEach((light) => (light.master = thisLerp));
        break;

      // INITIAL LOOK
      default:
        p.background(0);

        p.fill(0);
        p.stroke(0);

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

        const thisOrange = p.lerpColor(p.color(0), orange, lerpVal);
        lightsObj["JEREMY_SL"].color = {
          r: p.red(thisOrange),
          g: p.green(thisOrange),
          b: p.blue(thisOrange),
        };
        break;
    }

    p.translate(width / 2, height / 2);

    const points = [];

    for (let i = 0; i < spectrumPoints; i++) {
      const thisFrequency = frequencyData.slice(
        spectrumPoints * i,
        spectrumPoints * i + spectrumPoints,
      );
      const thisFrequencyAverage = getAverage(thisFrequency);
      maxFrequency[i] = Math.max(maxFrequency[i], thisFrequencyAverage);

      const theta = (p.TWO_PI / spectrumPoints) * i + p.PI;
      const r = (height * thisFrequencyAverage) / maxFrequency[i];
      const x = r * p.cos(theta);
      const y = r * p.sin(theta);

      points.push({ x, y });
    }

    p.beginShape();
    points.forEach(({ x, y }) => p.vertex(x, y));
    p.endShape(p.CLOSE);

    lights.forEach((l) => l.update());
  };
};

new p5(s, document.getElementById("sketch"));
