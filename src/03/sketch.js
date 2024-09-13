import p5 from "p5";
import { lights } from "../lib/lights";
import { AudioSpectrum } from "../lib/audio-spectrum";

const s = (p) => {
  const params = {
    // INITIAL LOOK
    z: {
      background: p.color("magenta"),
      duration: 200,
    },

    5: {
      background: p.color(0),
      duration: 0,
    },
    m: {
      background: p.color(0),
      duration: 0,
    },
    "-": {
      background: p.color("magenta"),
      duration: 60,
    },

    // BLACKOUT
    Enter: {
      background: p.color(0),
      duration: 0,
      color: p.color(0),
    },
  };

  let currentKey = "z";
  let frameStart = 0;

  const previousLightsState = JSON.parse(JSON.stringify(lights));
  let currentLightsState = null;

  const spectrum = new AudioSpectrum();

  const width = 1280 / 2;
  const height = 800 / 2;

  const speed = 3;

  class Spotlight {
    constructor(color, direction, x = width / 2, y = 0, diameter = height / 3) {
      this.color = color || p.color(255);
      this.x = x;
      this.y = y;
      this.direction = direction || {
        x: p.random(-speed, speed),
        y: p.random(-speed, speed),
      };
      this.radius = 0;
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
  }

  const spotlights = [
    new Spotlight(p.color(255, 255, 0), { x: speed, y: speed * 1.25 }),
    new Spotlight(p.color(255, 0, 255), { x: speed * 1.25, y: -speed * 1.5 }),
    new Spotlight(p.color(0, 255, 255), { x: -speed * 1.5, y: -speed * 1.75 }),
    new Spotlight(p.color(255, 255, 0), { x: speed * 1.75, y: speed * 2 }),
    new Spotlight(p.color(255, 0, 255), { x: speed * 2, y: -speed * 2.25 }),
    new Spotlight(p.color(0, 255, 255), { x: -speed * 2.25, y: -speed * 2.5 }),
  ];

  function spotlightsRandom() {
    spotlights[0].direction = { x: speed, y: speed * 1.25 };
    spotlights[1].direction = { x: speed * 1.25, y: -speed * 1.5 };
    spotlights[2].direction = { x: -speed * 1.5, y: -speed * 1.75 };
    spotlights[3].direction = { x: speed * 1.75, y: speed * 2 };
    spotlights[4].direction = { x: speed * 2, y: -speed * 2.25 };
    spotlights[5].direction = { x: -speed * 2.25, y: -speed * 2.5 };
  }

  function spotlightsVertical() {
    spotlights[0].direction = { x: 0, y: speed };
    spotlights[1].direction = { x: 0, y: speed };
    spotlights[2].direction = { x: 0, y: speed };
    spotlights[3].direction = { x: 0, y: speed };
    spotlights[4].direction = { x: 0, y: speed };
    spotlights[5].direction = { x: 0, y: speed };
  }

  p.setup = async () => {
    await spectrum.startMicInput();
    p.createCanvas(width, height);
    p.frameRate(30);
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/03/index.html", "_self");
      return;
    }
    currentKey = Object.keys(params).includes(p.key) ? p.key : currentKey;
    frameStart = p.frameCount;
    currentLightsState = JSON.parse(JSON.stringify(lights));
  };

  p.draw = () => {
    let frequencyData = spectrum.getFrequencyData();
    const average =
      frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length;

    const position = average / Math.max(...frequencyData);
    const radius = p.lerp(p.height / 3, p.height, position);

    spotlights.forEach((s) => {
      s.radius = radius;
    });

    const { background, duration } = params[currentKey];
    const lerpVal = (p.frameCount - frameStart) / duration;

    switch (currentKey) {
      case "m":
        spotlightsVertical();
        break;

      default:
        spotlightsRandom();
        break;
    }

    switch (currentKey) {
      case "5":
      case "m":
        p.blendMode(p.BLEND);
        p.background(0);
        p.blendMode(p.ADD);

        spotlights.forEach((s) => {
          p.fill(s.color);
          p.circle(s.x, s.y, radius * 2);
          s.move();
        });

        lights.forEach(
          (light) =>
            (light.color = {
              r: p.red(background),
              g: p.green(background),
              b: p.blue(background),
            }),
        );
        break;

      case "-":
        p.blendMode(p.BLEND);
        p.background(p.lerpColor(p.color(0), background, lerpVal));
        p.blendMode(p.ADD);

        spotlights.forEach((s) => {
          p.fill(s.color);
          p.circle(s.x, s.y, radius * 2);
        });

        lights.forEach((light, index) => {
          const { r, g, b } = Boolean(currentLightsState)
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

      // BLACKOUT
      case "Enter":
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

        p.fill(p.lerp(0, 255, lerpVal));
        p.noStroke();

        p.circle(p.width / 2, 0, radius * 2);

        lights.forEach((light, index) => {
          const { r, g, b } = Boolean(currentLightsState)
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
    }
  };
};

new p5(s, document.getElementById("sketch"));

//
// console.log(
//   frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length,
// );

// frequencyData = [...frequencyData].slice(
//   Math.floor(frequencyData.length / 4),
//   Math.floor(frequencyData.length / 2),
// );

// p.beginShape();
// frequencyData.forEach((data, index) => {
//   const x = (p.width / frequencyData.length) * index;
//   const xRatio = x / p.width;
//   // 𝑦=−4𝑥2+4𝑥
//   const y =
//     p.height *
//     p.noise(x / 100, data / 50) *
//     (-4 * xRatio * xRatio + 4 * xRatio);
//   p.vertex(x, y);
// });
// p.vertex(p.width, 0);
// p.vertex(0, 0);
// p.endShape(p.CLOSE);
