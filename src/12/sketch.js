import p5 from "p5";
import { lights, lightsObj } from "../lib/lights";
import { cues } from "../lib/cues";
import { lerp } from "@bluehexagons/easing";

const s = (p) => {
  const yellow = p.color("#beb367");
  const blue = p.color("#677BBE");
  const darkBlue = p.color("#132258");

  const colors = [darkBlue, blue, yellow];

  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: p.color(0),
      duration: 10,
    },

    [cues[1].key]: {
      background: p.color(0),
      duration: 60,
    },
    [cues[2].key]: {
      background: p.color(0),
      duration: 45,
    },
    [cues[3].key]: {
      background: p.color(0),
      duration: 14,
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

  let thisChase = [
    darkBlue,
    darkBlue,
    blue,
    darkBlue,
    darkBlue,
    yellow,
    darkBlue,
    darkBlue,
  ];
  let nextChase = [...thisChase];

  const width = 1280 / 2;
  const height = 800 / 2;

  let dotsGo = false;
  class Dot {
    constructor(x) {
      this.x = x;
      this.speed = p.random() + 3;
      this.y = height + 5;
      this.previousY1 = height + 5;
      this.previousY2 = height + 5;
    }
    draw(color) {
      p.stroke(color);
      p.strokeWeight(5);
      p.point(this.x, this.y);
      p.strokeWeight(4);
      p.point(this.x, this.previousY1);
      p.strokeWeight(2);
      p.point(this.x, this.previousY2);

      if (p.frameCount % 2 === 0) this.previousY1 = this.y;
      if (p.frameCount % 3 === 0) this.previousY2 = this.previousY1;
      this.y -= this.speed;

      if (dotsGo && this.y < -5) {
        this.y = height + 5;
      }
    }
  }

  const dots = Array(35)
    .fill(null)
    .map((_, i) => new Dot((width / 35) * i));

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/13/index.html", "_self");
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
    dotsGo = currentKey === cues[2].key;

    switch (currentKey) {
      case cues[0].key:
        p.background(background);

        lights.forEach((light, index) => {
          const thisColor = p.lerpColor(thisChase[index], darkBlue, lerpVal);
          return (light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          });
        });
        const colorSL = p.lerpColor(darkBlue, blue, lerpVal);
        const colorSR = p.lerpColor(darkBlue, yellow, lerpVal);

        lightsObj["TORI_SL"].color = {
          r: p.red(colorSL),
          g: p.green(colorSL),
          b: p.blue(colorSL),
        };

        lightsObj["TORI_SR"].color = {
          r: p.red(colorSR),
          g: p.green(colorSR),
          b: p.blue(colorSR),
        };

        break;

      case cues[1].key:
      case cues[2].key:
      case cues[3].key:
        p.background(background);

        lights.forEach((light, index) => {
          const thisColor = p.lerpColor(
            thisChase[index],
            nextChase[index],
            lerpVal,
          );
          return (light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          });
        });

        if (lerpVal === 1) {
          frameStart = p.frameCount;

          thisChase = [...nextChase];
          nextChase = Array(8)
            .fill(null)
            .map((_, i) => {
              const index =
                currentKey === cues[3].key
                  ? (p.frameCount + i) % 3
                  : p.floor(p.noise(p.frameCount * (i + 1)) * 3);
              return colors[index];
            });
        }

        break;

      // BLACKOUT
      case cues[4].key:
        p.blendMode(p.BLEND);
        p.background(0);

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

      // INITIAL LOOK
      default:
        p.background(background);

        lights.forEach((light, index) => {
          const { r, g, b, master } = currentLightsState
            ? currentLightsState[index]
            : previousLightsState[index];
          const currentColor = p.color(r, g, b);
          const thisColor = p.lerpColor(currentColor, darkBlue, lerpVal);
          light.master = p.round(p.lerp(master, 255, lerpVal));
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });
        break;
    }

    dots.forEach((dot) => dot.draw(yellow));
    lights.forEach((l) => l.update());
  };
};

new p5(s, document.getElementById("sketch"));
