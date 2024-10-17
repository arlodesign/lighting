import p5 from "p5";
import { lights, lightsObj } from "../lib/lights";
import { cues } from "../lib/cues";
import { AudioSpectrum } from "../lib/audio-spectrum";
import { quadOut as ease, quintIn } from "@bluehexagons/easing";
import getAverage from "../lib/average";

const s = (p) => {
  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: p.color(0, 0, 0),
      duration: 15,
    },

    [cues[1].key]: {
      background: p.color(0, 0, 255),
      duration: 30,
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
  let maxFrequency = [0, 0, 0, 0, 0, 0, 0];
  let thisLightColor;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const width = 1280 / 4;
  const height = 800 / 4;

  const spectrum = new AudioSpectrum();

  p.setup = async () => {
    await spectrum.startMicInput();
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/12/index.html", "_self");
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
    let frequencyData = spectrum.getFrequencyData().slice(128, 512);
    const bandSize = Math.floor(frequencyData.length / lights.length);

    const { background, duration } = params[currentKey || cues[0].key];
    const lerpVal = Math.min((p.frameCount - frameStart) / duration, 1);
    let thisBackground = background;

    lights.forEach((light, index) => {
      const thisFrequency = frequencyData.slice(
        bandSize * index,
        bandSize * index + bandSize,
      );

      const average = getAverage(thisFrequency) / thisFrequency.length / 60;
      const thisLerpVal = Math.min(ease(average), 1);
      light.master = p.round(p.lerp(64, 255, thisLerpVal));
      thisBackground.setAlpha(thisLerpVal * 255);
    });

    switch (currentKey) {
      case cues[0].key:
        p.background(background);
        lights.forEach((l) => (l.color = { r: 255, g: 255, b: 255 }));
        lightsObj["JEREMY_SR"].color = { r: 255, g: 125, b: 0 };
        lightsObj["JEREMY_SR"].master = p.round(p.lerp(64, 255, lerpVal));
        break;

      case cues[1].key:
      case cues[2].key:
        const barColor =
          cues[1].key === currentKey ? p.color(0, 0, 255) : p.color(128);
        const lightColor =
          cues[1].key === currentKey ? p.color(255, 128, 0) : p.color(0);
        p.background(0);

        for (let i = 0; i < 7; i++) {
          const thisFrequency = frequencyData.slice(7 * i, 7 * i + 7);
          const thisFrequencyAverage = getAverage(thisFrequency);
          const barHeight = (p.height * thisFrequencyAverage) / maxFrequency[i];

          p.fill(barColor);
          p.rect((width / 7) * i, height - barHeight, width / 7, barHeight);
          maxFrequency[i] = Math.max(maxFrequency[i], thisFrequencyAverage);
        }

        thisLightColor = p.lerpColor(
          p.color(255),
          lightColor,
          p.noise(p.frameCount / 100),
        );

        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(thisLightColor),
              g: p.green(thisLightColor),
              b: p.blue(thisLightColor),
            }),
        );
        break;

      case cues[3].key:
        p.colorMode(p.HSB);
        p.background(background);

        p.background(0);

        for (let i = 0; i < 7; i++) {
          const thisFrequency = frequencyData.slice(7 * i, 7 * i + 7);
          const thisFrequencyAverage = getAverage(thisFrequency);
          const barHeight = (p.height * thisFrequencyAverage) / maxFrequency[i];

          p.fill((360 / 7) * i, 100 * p.noise(p.frameCount / 10), 100);
          p.rect((width / 7) * i, height - barHeight, width / 7, barHeight);
          maxFrequency[i] = Math.max(maxFrequency[i], thisFrequencyAverage);
        }

        lights.forEach((light, index) => {
          thisLightColor = p.color(
            (360 / lights.length) * (lights.length - index),
            100 * p.noise(p.frameCount / 10),
            100,
          );
          light.color = {
            r: p.red(thisLightColor),
            g: p.green(thisLightColor),
            b: p.blue(thisLightColor),
          };
        });
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
        1;
        p.background(background);

        lights.forEach((light, index) => {
          const { r, g, b, master } = currentLightsState
            ? currentLightsState[index]
            : previousLightsState[index];
          const currentColor = p.color(r, g, b);
          const thisColor = p.lerpColor(currentColor, p.color(255), lerpVal);
          // light.master = p.round(p.lerp(master, 128, lerpVal));
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
