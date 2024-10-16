import p5 from "p5";
import { lights } from "../lib/lights";
import { cues } from "../lib/cues";

const s = (p) => {
  const blue = p.color(0, 0, 127);
  const brightBlue = p.color(0, 0, 255);
  const babyBlue = p.color(127, 127, 255);
  const orange = p.color("#FC6600");
  const amber = p.color("#FFBF00");

  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: blue,
      duration: 30,
    },

    [cues[1].key]: {
      background: p.color(0, 255, 0),
      duration: 15,
    },
    [cues[2].key]: {
      background: p.color(0, 0, 255),
      duration: 30,
    },
    [cues[3].key]: {
      background: p.color(255, 0, 255),
      duration: 30,
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

  const chase = [blue, brightBlue, babyBlue, orange, amber];
  let currentChaseLightsColors = Array.from(Array(8)).map(
    (_, i) => chase[i % 3],
  );
  let newChaseLightsColors = [...currentChaseLightsColors];

  const width = 1280;
  const height = 800;

  class Spotlight {
    constructor() {
      this.color = p.color(255);

      this.radius = 10;
      this.setPosition();
      this.setDirection();
    }
    setPosition() {
      this.x = p.random(width);
      this.y = p.random(height);
    }
    setDirection() {
      this.direction = {
        x: p.random([-1, 1]),
        y: p.random([-1, 1]),
      };
    }
    move() {
      this.x += this.direction.x;
      this.y += this.direction.y;

      if (this.x < -this.radius) {
        this.x = width + this.radius;
      }
      if (this.y < -this.radius) {
        this.y = height + this.radius;
      }
      if (this.x > width + this.radius) {
        this.x = -this.radius;
      }
      if (this.y > width + this.radius) {
        this.y = -this.radius;
      }
    }
    draw() {
      p.fill(this.color);
      p.circle(this.x, this.y, this.radius);
    }
  }

  const spotlights = Array(50)
    .fill(null)
    .map(() => new Spotlight());

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/05/index.html", "_self");
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
      case cues[1].key:
      case cues[2].key:
      case cues[3].key:
        const chaseLength = currentKey === cues[0].key ? 3 : chase.length;
        p.background(0);

        if (p.frameCount % duration === 0) {
          currentChaseLightsColors = [...newChaseLightsColors];
          newChaseLightsColors = newChaseLightsColors.map(
            (_, i) => chase[Math.floor(p.noise(p.frameCount, i) * chaseLength)],
          );
        }

        lights.forEach((light, index) => {
          const thisColor = p.lerpColor(
            currentChaseLightsColors[index],
            newChaseLightsColors[index],
            (p.frameCount % duration) / duration,
          );

          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };

          currentKey === cues[3].key
            ? (light.master = 128)
            : (light.master = 255);

          light.update();
        });

        break;

      // BLACKOUT
      case cues[4].key:
        p.blendMode(p.BLEND);
        p.background(0);

        lights.forEach((light, index) => {
          const thisColor = p.lerpColor(
            currentChaseLightsColors[index],
            p.color(0),
            lerpVal,
          );

          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });
        break;

      // INITIAL LOOK
      default:
        p.background(0);

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

    switch (currentKey) {
      case cues[2].key:
        spotlights.forEach((s) => {
          s.color = p.lerpColor(p.color(0), p.color(255), lerpVal);
          s.draw();
        });
        if (lerpVal >= 1) {
          frameStart = p.frameCount;
          spotlights.forEach((s) => s.setPosition());
        }
        break;

      case cues[3].key:
        spotlights.forEach((s, i) => {
          s.color = p.lerpColor(
            p.color(0),
            p.color(
              chase[Math.floor(p.noise(p.frameCount * 1000, i) * chase.length)],
            ),
            lerpVal,
          );
          s.draw();
          s.move();
        });
        if (lerpVal >= 1) {
          frameStart = p.frameCount;
          spotlights.forEach((s) => {
            s.setDirection();
            s.setPosition();
          });
        }
        break;
    }

    lights.forEach((l) => l.update());
  };
};

new p5(s, document.getElementById("sketch"));
