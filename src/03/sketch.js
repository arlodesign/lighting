import p5 from "p5";
import { lights } from "../lib/lights";
import { cues } from "../lib/cues";
import { AudioSpectrum } from "../lib/audio-spectrum";

const s = (p) => {
  const params = {
    // INITIAL LOOK
    [cues[0].key]: {
      background: p.color("magenta"),
      duration: 200,
    },

    [cues[1].key]: {
      background: p.color(0),
      duration: 0,
    },
    [cues[2].key]: {
      background: p.color(0),
      duration: 0,
    },
    [cues[3].key]: {
      background: p.color("magenta"),
      duration: 30,
    },

    // BLACKOUT
    [cues[4].key]: {
      background: p.color(0),
      duration: 0,
      color: p.color(0),
    },
  };

  let currentKey = cues[0].key;
  cues[0].isCurrent = true;

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

  let chaseLightColors = [
    p.color(255, 255, 0),
    p.color(0, 255, 255),
    p.color(255, 0, 255),
    p.color("white"),
    p.color(255, 0, 255),
    p.color(0, 255, 255),
    p.color(255, 255, 0),
    p.color("white"),
  ];
  let chaseSpeed = 50;

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
    p.keyPressed();
  };

  p.keyPressed = () => {
    if (p.key === "ArrowUp") {
      window.open("/04/index.html", "_self");
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
      case cues[2].key:
        spotlightsVertical();
        break;

      default:
        spotlightsRandom();
        break;
    }

    switch (currentKey) {
      case cues[1].key:
        if (p.frameCount % chaseSpeed === 0) {
          const firstColor = chaseLightColors.shift();
          chaseLightColors = [...chaseLightColors, firstColor];
          lights.forEach(
            (light, index) =>
              (light.color = {
                r: p.red(chaseLightColors[index]),
                g: p.green(chaseLightColors[index]),
                b: p.blue(chaseLightColors[index]),
              }),
          );
        }
        break;

      case cues[2].key:
        if (p.frameCount % Math.floor(chaseSpeed / 3) === 0) {
          const firstColor = chaseLightColors.shift();
          chaseLightColors = [...chaseLightColors, firstColor];
          lights.forEach(
            (light, index) =>
              (light.color = {
                r: p.red(chaseLightColors[index]),
                g: p.green(chaseLightColors[index]),
                b: p.blue(chaseLightColors[index]),
              }),
          );
        }
        break;
    }

    switch (currentKey) {
      case cues[1].key:
      case cues[2].key:
        p.blendMode(p.BLEND);
        p.background(0);
        p.blendMode(p.ADD);

        spotlights.forEach((s) => {
          p.fill(s.color);
          p.circle(s.x, s.y, radius * 2);
          s.move();
        });
        break;

      case cues[3].key:
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
        p.blendMode(p.BLEND);
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
