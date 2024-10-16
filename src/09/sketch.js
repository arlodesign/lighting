import p5 from "p5";
import { lights } from "../lib/lights";
import { cues } from "../lib/cues";

const s = (p) => {
  const brass = p.color("#DAA520");
  const purple = p.color("#632981");
  const yellow = p.color("yellow");
  const orange = p.color("orange");

  const colors = [brass, purple, yellow, orange];

  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: p.color(0),
      duration: 120,
    },

    [cues[1].key]: {
      background: p.color(0),
      duration: 30,
    },
    [cues[2].key]: {
      background: p.color(0),
      duration: 60,
    },
    [cues[3].key]: {
      background: p.color(0),
      duration: 60,
    },

    // BLACKOUT
    [cues[4].key]: {
      background: p.color(0),
      duration: 120,
      color: p.color(0),
    },
  };

  let currentKey = cues[0].key;
  let frameStart = 0;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const width = 1280 / 2;
  const height = 800 / 2;

  // Adapted from https://codepen.io/mare_413/pen/LLoZXL

  let balls = [];
  let nucleus;
  let theta = p.PI * 1.5;
  let thetaVelocity = 0;
  let thetaAcceleration = 0.0001;

  class Ball {
    constructor(x, y) {
      this.pos = p.createVector(x, y);
      this.vel = p.createVector(0, 0);
      this.acc = p.createVector(0, 0);
      this.nScaleX = p.random(1000);
      this.nScaleY = p.random(1000);
      this.size = 3;
      this.color = colors[p.floor(p.random(4))];
    }

    update() {
      this.vel.add(this.acc);
      this.pos.add(this.vel);
      this.acc.mult(0);
    }

    applyNoise(per_) {
      this.nScaleX -= p.random(per_ * -1, per_);
      this.nScaleY -= p.random(per_ * -1, per_);
      this.acc.add(
        p.map(p.noise(this.nScaleX, this.nScaleY), 0, 1, -1, 1),
        p.map(p.noise(this.nScaleY, this.nScaleX), 0, 1, -1, 1),
      );
      this.acc.mult(0.2);
    }

    borders() {
      if (
        this.pos.x < -this.size ||
        this.pos.x > width + this.size ||
        this.pos.y < -this.size ||
        this.pos.y > height + this.size
      )
        balls.splice(balls.indexOf(this), 1);
    }

    draw() {
      p.fill(this.color);
      p.noStroke();
      p.circle(this.pos.x, this.pos.y, this.size);
    }
  }

  p.setup = () => {
    p.createCanvas(width, height);
    p.frameRate(30);
    p.keyPressed();

    nucleus = p.createVector(width / 2, height / 10);
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/10/index.html", "_self");
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
    const { background, duration } = params[currentKey];
    const lerpVal = Math.min((p.frameCount - frameStart) / duration, 1);

    switch (currentKey) {
      case cues[1].key:
        p.background(background);

        lights.forEach((light) => {
          if (light.name !== "SL_4" && light.name !== "SR_1")
            return (light.master = p.round(p.lerp(255, 128, lerpVal)));
        });
        balls.push(new Ball(nucleus.x, nucleus.y));
        balls.push(new Ball(nucleus.x, nucleus.y));
        balls.push(new Ball(nucleus.x, nucleus.y));
        break;

      case cues[2].key:
        p.background(background);

        nucleus.x = (height / 2 - height / 10) * p.cos(theta) + width / 2;
        nucleus.y = (height / 2 - height / 10) * p.sin(theta) + height / 2;
        thetaVelocity += thetaAcceleration;
        theta += thetaVelocity;

        lights.forEach(
          (light) => (light.master = p.round(p.lerp(128, 255, lerpVal))),
        );
        balls.push(new Ball(nucleus.x, nucleus.y));
        balls.push(new Ball(nucleus.x, nucleus.y));
        balls.push(new Ball(nucleus.x, nucleus.y));
        balls.push(new Ball(nucleus.x, nucleus.y));
        balls.push(new Ball(nucleus.x, nucleus.y));
        balls.push(new Ball(nucleus.x, nucleus.y));
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

        lights.forEach((light, index) => {
          const { master } = currentLightsState
            ? currentLightsState[index]
            : previousLightsState[index];

          light.master = p.round(p.lerp(master, 0, lerpVal));
          if (lerpVal === 1) {
            light.color = {
              r: 0,
              g: 0,
              b: 0,
            };
          }
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
          const thisColor = p.lerpColor(
            currentColor,
            index % 2 ? brass : purple,
            lerpVal,
          );
          light.master = p.round(p.lerp(master, 255, lerpVal));
          light.color = {
            r: p.red(thisColor),
            g: p.green(thisColor),
            b: p.blue(thisColor),
          };
        });
        break;
    }

    balls.forEach((ball) => {
      ball.applyNoise(0.1);
      ball.update();
      ball.draw();
      ball.borders();
    });
    lights.forEach((l) => l.update());
  };
};

new p5(s, document.getElementById("sketch"));
