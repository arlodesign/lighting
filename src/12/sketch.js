import p5 from "p5";
import { lights, lightsObj } from "../lib/lights";
import { cues } from "../lib/cues";
import getAverage from "../lib/average";
import randomInteger from "random-int";
import { quintIn, quadInOut } from "@bluehexagons/easing";
import { shuffle } from "fast-shuffle";

const s = (p) => {
  let tempo = 30;
  let tempoStart;
  let tempoEnd;
  let tempoValues = [];
  let countDownFrame = 0;
  let countDownPoints = [];
  let maxPoints = 0;
  let font;

  p.preload = () => {
    font = p.loadFont("/DMMono-Medium.ttf");
  };

  const params = {
    // INITIAL LOOK
    z: {
      background: p.color(0),
      duration: 0,
      tempoRate: 1,
    },

    5: {
      background: p.color(0),
      duration: 0,
      tempoRate: 1,
    },
    m: {
      background: p.color(0),
      duration: 15,
      tempoRate: 0.5,
    },
    "-": {
      background: p.color(0),
      duration: 30,
      tempoRate: 1,
    },

    // BLACKOUT
    Enter: {
      background: p.color(0),
      duration: 0,
      color: p.color(0),
    },
  };

  let currentKey = null;
  let frameStart = 0;
  let lightIndex = 0;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const width = 1280 / 2;
  const height = 800 / 2;

  const getPoint = (theta) => ({
    x: p.cos(theta) * width,
    y: p.sin(theta) * width,
  });

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();

    // the numbers I'm going to use
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8];

    // get all the points
    countDownPoints = numbers.map((n) =>
      shuffle(
        font.textToPoints(String(n), -198, 225, width, {
          sampleFactor: 0.05,
        }),
      ),
    );

    // get the max number of points
    maxPoints = Math.max(...countDownPoints.map((n) => n.length));

    countDownPoints = countDownPoints.map((n) => {
      // pad all of them with points outside of canvas
      const interval = p.TWO_PI / (maxPoints - n.length);
      let theta = 0;
      while (n.length < maxPoints) {
        n.push(getPoint(theta));
        theta += interval;
      }

      return n;
    });

    // add one more at the beginning
    countDownPoints.unshift(
      new Array(maxPoints)
        .fill({})
        .map((_, i) => getPoint((p.TWO_PI / maxPoints) * i)),
    );

    console.log(countDownPoints[0]);
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
    } else if (thisKey === cues[0].key) {
      if (tempoStart) {
        tempoEnd = window.performance.now();
        tempoValues.push(tempoEnd - tempoStart);
        tempo = getAverage(tempoValues) / tempoValues.length / 1000;
      }
      tempoStart = window.performance.now();
    }
    if (thisKey === cues[3].key) {
      frameStart = p.frameCount;
      countDownFrame++;
      countDownFrame = countDownFrame > 8 ? 1 : countDownFrame;
    }
  };

  p.draw = () => {
    const { background, duration, tempoRate } =
      params[currentKey || cues[0].key];
    const lerpVal = Math.min((p.frameCount - frameStart) / duration, 1);
    p.background(0);

    p.translate(width / 2, height / 2);
    p.rotate(p.radians(p.frameCount % 360));
    p.scale(
      p.lerp(
        0.9,
        Math.max(countDownFrame / 4, 1),
        quadInOut(p.noise(p.frameCount / 100)),
      ),
    );
    p.stroke(255);
    p.fill(255);

    switch (currentKey) {
      case cues[0].key:
      case cues[1].key:
      case cues[2].key:
        if (countDownFrame === 8) {
          for (let i = 0; i < countDownPoints[8].length; i++) {
            const { x, y } = countDownPoints[8][i];
            const { x: x2, y: y2 } = countDownPoints[0][i];
            p.strokeWeight(p.lerp(5, 30, lerpVal));
            p.point(
              p.lerp(x, x2, quadInOut(lerpVal)),
              p.lerp(y, y2, quadInOut(lerpVal)),
            );
          }
        }

        const willUpdate =
          p.frameCount %
            Math.floor(p.getTargetFrameRate() * tempo * tempoRate) !==
          0;

        if (willUpdate) break;

        let newLightIndex;
        do {
          newLightIndex = randomInteger(0, 7);
        } while (newLightIndex === lightIndex);

        lightIndex = newLightIndex;

        lights.forEach(
          (light, index) =>
            (light.color = {
              r: p.red(index === lightIndex ? 255 : 0),
              g: p.green(index === lightIndex ? 255 : 0),
              b: p.blue(index === lightIndex ? 255 : 0),
            }),
        );

        if (currentKey === cues[1].key) {
          lightsObj.SR_4.color = {
            r: 255 * lerpVal,
            g: 255 * lerpVal,
            b: 255 * lerpVal,
          };
        }

        break;

      case cues[3].key:
        const lastCountDownPoints = countDownPoints[countDownFrame - 1];
        const thisCountDownPoints = countDownPoints[countDownFrame];

        for (let i = 0; i < thisCountDownPoints.length; i++) {
          const { x, y } = lastCountDownPoints[i];
          const { x: x2, y: y2 } = thisCountDownPoints[i];
          p.strokeWeight(
            p.lerp(
              5,
              30,
              quintIn(p.noise(x2 + p.frameCount, y2 + p.frameCount)),
            ),
          );
          p.point(
            p.lerp(x, x2, quadInOut(lerpVal)),
            p.lerp(y, y2, quadInOut(lerpVal)),
          );
        }

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
