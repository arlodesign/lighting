import p5 from "p5";
import { lights } from "../lib/lights";
import { cues } from "../lib/cues";

const s = (p) => {
  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: p.color(0),
      color: p.color(0),
    },

    [cues[1].key]: {
      background: p.color(0),
      color: p.color(255),
    },
    [cues[2].key]: {
      background: p.color(255),
      color: p.color(0),
    },
    [cues[3].key]: {
      background: p.color(255),
      color: p.color(0),
    },

    // BLACKOUT
    [cues[4].key]: {
      background: p.color(0),
      color: p.color(0),
    },
  };

  const width = 1280;
  const height = 800;
  const speed = 15;
  const frames = 500;

  let currentKey = cues[0].key;
  let fade = 255;

  class Circle {
    constructor() {
      this.start();
    }

    start() {
      this.progress = Math.floor(Math.random() * frames);
      this.x = Math.random() * width;
      this.direction = Math.random() > 0.5 ? -1 : 1;
      this.speed = speed * p.random(0.75, 1.25);
    }

    move() {
      this.x += this.speed * this.direction;
      if (this.x < 0) this.x = width;
      if (this.x > width) this.x = 0;
      this.progress++;
      this.progress >= frames && this.start();
    }
  }

  let circles;

  function drawCircles() {
    circles.forEach((circle, index) => {
      circle.move();
      p.circle(circle.x, (p.height / 5) * index + p.height / 10, p.height / 5);
    });
  }

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();

    circles = [
      new Circle(),
      new Circle(),
      new Circle(),
      new Circle(),
      new Circle(),
    ];
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/02/index.html", "_self");
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
    let { background, color } = params[currentKey];

    p.background(background);
    p.fill(color);
    p.noStroke();

    switch (currentKey) {
      case cues[1].key:
        fade = 255;
        drawCircles();

        lights.forEach((light, index) => {
          const lightColor = p.color(
            p.noise(0.005 * p.frameCount + 100000 * (index + 10)) > 0.5
              ? 255
              : 0,
          );
          light.color = {
            r: p.red(lightColor),
            g: p.green(lightColor),
            b: p.blue(lightColor),
          };
        });
        break;

      case cues[2].key:
        fade = 255;
        drawCircles();

        lights.forEach((light, index) => {
          const lightColor = p.color(
            p.noise(0.005 * p.frameCount + (index + 10)) > 0.25 ? 255 : 0,
          );
          light.color = {
            r: p.red(lightColor),
            g: p.green(lightColor),
            b: p.blue(lightColor),
          };
        });
        break;

      case cues[3].key:
        p.background(fade);
        drawCircles();

        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(fade),
              g: p.green(fade),
              b: p.blue(fade),
            }),
        );
        fade = Math.max(fade - 2.125, 0);
        break;

      // BLACKOUT
      case cues[4].key:
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
        fade = 255;
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
    }
  };
};

new p5(s, document.getElementById("sketch"));
