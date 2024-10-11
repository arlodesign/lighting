import p5 from "p5";
import { quadInOut as ease } from "@bluehexagons/easing";
import { lights } from "../lib/lights";
import { cues } from "../lib/cues";

const s = (p) => {
  const tangerine = p.color("#F28500");
  const black = p.color("black");
  const lightBlue = p.color("lightblue");
  let pulseColors = [tangerine, lightBlue];

  const params = {
    // INITIAL LOOK
    z: {
      background: black,
      duration: 60,
    },

    5: {
      background: black,
      duration: 120,
    },
    m: {
      background: black,
      duration: 15,
    },
    "-": {
      background: black,
      duration: 15,
    },

    // BLACKOUT
    Enter: {
      background: black,
      duration: 0,
      color: black,
    },
  };

  let currentKey = cues[0].key;
  let frameStart = 0;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const width = 1280;
  const height = 800;
  const circleCount = 8;
  const diameter = width / circleCount;

  class Circle {
    constructor(x, direction, duration = 0, color) {
      this.x = x;
      this.direction = direction;
      this.y = direction > 0 ? diameter / 2 : height - diameter / 2;
      this.duration = duration;
      this._color = color;
    }

    set color(clr) {
      const start = window.performance.now();
      const startColor = this._color;
      const duration = 1000;
      const interval = setInterval(() => {
        const end = window.performance.now();
        this._color = p.lerpColor(startColor, clr, (end - start) / duration);
        if (end - start >= duration) clearInterval(interval);
      });
    }

    draw() {
      p.fill(this._color);
      p.circle(this.x, this.y, diameter);
    }

    update(frame, duration) {
      const lerpVal = ease(frame / duration);
      if (lerpVal === 0) this.direction = this.direction * -1;
      this.y =
        this.direction > 0
          ? p.lerp(diameter / 2, height - diameter / 2, lerpVal)
          : p.lerp(height - diameter / 2, diameter / 2, lerpVal);
    }
  }

  let circles = Array(circleCount)
    .fill(null)
    .map((_, index) => {
      return new Circle(
        diameter * index + diameter / 2,
        Boolean(index % 2) ? 1 : -1,
        15,
        black,
      );
    });

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
    p.noStroke();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/09/index.html", "_self");
      return;
    }
    const thisKey = Object.keys(params).includes(p.key) ? p.key : currentKey;
    if (thisKey !== currentKey) {
      currentKey = thisKey;
      frameStart = p.frameCount;
      currentLightsState = JSON.parse(JSON.stringify(lights));
      cues.forEach((c) => (c.isCurrent = c.key === currentKey));
    }

    circles.forEach((circle, index) => {
      circle.color = p.key !== cues[3].key ? black : pulseColors[index % 2];
    });
  };

  p.draw = () => {
    const { background, duration } = params[currentKey];
    const lerpVal = Math.min((p.frameCount - frameStart) / duration, 1);

    switch (currentKey) {
      case cues[1].key:
        p.background(background);
        const lerpColor = p.lerpColor(black, lightBlue, lerpVal);

        lights.slice(0, 4).forEach(
          (light) =>
            (light.color = {
              r: p.red(lerpColor),
              g: p.green(lerpColor),
              b: p.blue(lerpColor),
            }),
        );
        break;

      case cues[2].key:
      case cues[3].key:
        p.background(background);
        if (p.frameCount % duration === 0) pulseColors = pulseColors.reverse();

        lights.forEach((light, index) => {
          const thisColor = pulseColors[index % 2];
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
        p.background(0);

        lights.forEach((light, index) => {
          const { r, g, b } = currentLightsState
            ? currentLightsState[index]
            : previousLightsState[index];
          const currentColor = p.color(r, g, b);
          const thisColor = p.lerpColor(
            currentColor,
            index < 4 ? black : tangerine,
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

    circles.forEach((circle) => {
      circle.draw();
      circle.update((p.frameCount % duration) * 2, duration * 2);
    });
    lights.forEach((l) => l.update());
  };
};

new p5(s, document.getElementById("sketch"));
