import p5 from "p5";
import { lights, lightsObj } from "../lib/lights";
import { cues } from "../lib/cues";
import { AudioSpectrum } from "../lib/audio-spectrum";

const s = (p) => {
  const params = {
    // INITIAL LOOK
    z: {
      background: p.color(0),
      duration: 15,
    },

    5: {
      background: p.color(0),
      duration: 30,
    },
    m: {
      background: p.color(0),
      duration: 60,
    },
    "-": {
      background: p.color(0),
      duration: 30,
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

  const spectrum = new AudioSpectrum();
  const barCount = 50;

  class Bar {
    constructor(index) {
      this.index = index;
      this.height = 0;
      this.heightMax = 1;
      this.noise = false;
    }

    setHeight(frequency) {
      const bandSize = Math.floor(frequency.length / barCount);
      const thisFrequency = frequency.slice(
        bandSize * this.index,
        bandSize * this.index + bandSize,
      );
      const average =
        thisFrequency.reduce((a, b) => a + b, 0) / thisFrequency.length;
      this.height = (average / this.heightMax) * p.height;
    }
    draw(index) {
      const x = (width / 2 / barCount) * index + width / 2;
      const y = this.noise
        ? height * 0.5 +
          p.lerp(
            -height * 0.5,
            height * 0.5,
            p.noise(x / 10, p.frameCount / 10),
          )
        : height * 0.5;

      p.rectMode(p.CENTER);
      p.rect(x, y, width / 2 / barCount - 2, this.height);
      p.rect(width - x, y, width / 2 / barCount - 2, this.height);
      p.rectMode(p.CORNER);
    }
  }

  const bars = Array(barCount)
    .fill(null)
    .map((_, index) => new Bar(index));

  p.setup = async () => {
    await spectrum.startMicInput();
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/06/index.html", "_self");
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
    const { background, duration } = params[currentKey];
    const lerpVal = Math.min((p.frameCount - frameStart) / duration, 1);
    let noiseVal = false;

    const stageLeftColor = p.lerpColor(p.color(0), p.color("pink"), lerpVal);
    const stageRightColor = p.lerpColor(p.color(0), p.color("blue"), lerpVal);

    switch (currentKey) {
      case cues[1].key:
        p.background(background);
        p.fill(255);

        ["SL_1", "SL_2", "SL_3"].forEach((i) => {
          lightsObj[i].master = 255;
          lightsObj[i].color = {
            r: p.red(p.color(0)),
            g: p.green(p.color(0)),
            b: p.blue(p.color(0)),
          };
        });

        ["SR_2", "SR_3", "SR_4"].forEach((i) => {
          lightsObj[i].master = 255;
          lightsObj[i].color = {
            r: p.red(p.color(0)),
            g: p.green(p.color(0)),
            b: p.blue(p.color(0)),
          };
        });

        lightsObj.SL_4.master = 255;
        lightsObj.SL_4.color = {
          r: p.red(stageLeftColor),
          g: p.green(stageLeftColor),
          b: p.blue(stageLeftColor),
        };
        lightsObj.SR_1.master = 255;
        lightsObj.SR_1.color = {
          r: p.red(stageRightColor),
          g: p.green(stageRightColor),
          b: p.blue(stageRightColor),
        };
        break;

      case cues[2].key:
        p.background(background);
        p.fill(255);

        ["SL_1", "SL_2", "SL_3"].forEach((i) => {
          lightsObj[i].master = 255;
          lightsObj[i].color = {
            r: p.red(stageLeftColor),
            g: p.green(stageLeftColor),
            b: p.blue(stageLeftColor),
          };
        });

        ["SR_2", "SR_3", "SR_4"].forEach((i) => {
          lightsObj[i].master = 255;
          lightsObj[i].color = {
            r: p.red(stageRightColor),
            g: p.green(stageRightColor),
            b: p.blue(stageRightColor),
          };
        });

        lightsObj.SL_4.master = 255;
        lightsObj.SL_4.color = {
          r: p.red(p.color("pink")),
          g: p.green(p.color("pink")),
          b: p.blue(p.color("pink")),
        };
        lightsObj.SR_1.master = 255;
        lightsObj.SR_1.color = {
          r: p.red(p.color("blue")),
          g: p.green(p.color("blue")),
          b: p.blue(p.color("blue")),
        };
        break;

      case cues[3].key:
        p.background(background);
        noiseVal = true;

        if (p.frameCount % duration === 0) {
          lights.forEach((light) => {
            const thisColor = p.random([stageLeftColor, stageRightColor]);
            light.color = {
              r: p.red(thisColor),
              g: p.green(thisColor),
              b: p.blue(thisColor),
            };
          });
        }
        break;

      // BLACKOUT
      case cues[4].key:
        p.background(background);
        p.fill(0);

        ["SL_1", "SL_2", "SL_3"].forEach((i) => {
          lightsObj[i].master = 255;
          lightsObj[i].color = {
            r: 0,
            g: 0,
            b: 0,
          };
        });

        ["SR_2", "SR_3", "SR_4"].forEach((i) => {
          lightsObj[i].master = 255;
          lightsObj[i].color = {
            r: 0,
            g: 0,
            b: 0,
          };
        });

        lightsObj.SL_4.master = 255;
        lightsObj.SL_4.color = {
          r: p.red(p.color("pink")),
          g: p.green(p.color("pink")),
          b: p.blue(p.color("pink")),
        };
        lightsObj.SR_1.master = 255;
        lightsObj.SR_1.color = {
          r: p.red(p.color("blue")),
          g: p.green(p.color("blue")),
          b: p.blue(p.color("blue")),
        };
        break;

      // INITIAL LOOK
      default:
        p.background(background);
        p.fill(p.lerpColor(p.color(0), p.color(255), lerpVal));

        lights.forEach((light, index) => {
          const { r, g, b } = currentLightsState
            ? currentLightsState[index]
            : previousLightsState[index];
          const currentColor = p.color(r, g, b);
          const thisColor = p.lerpColor(currentColor, background, lerpVal);
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });
        break;
    }

    p.noStroke();
    bars.forEach((b, i) => {
      b.noise = noiseVal;
      b.heightMax = Math.max(...frequencyData);
      b.setHeight(frequencyData);
      b.draw(i);
    });

    lights.forEach((l) => l.update());
  };
};

new p5(s, document.getElementById("sketch"));
