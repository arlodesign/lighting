// Type declaration for p5.js 2.0.5
// This file works around the issue where p5 2.0.5 has built-in types
// but they can't be resolved due to package.json exports configuration

declare module "p5" {
  // Basic p5 interface for sketch functions
  interface p5Instance {
    setup?: () => void;
    draw?: () => void;
    createCanvas: (width: number, height: number) => void;
    pixelDensity: (density: number) => void;
    width: number;
    height: number;
    frameCount: number;
    canvas?: HTMLCanvasElement | null;
    _last?: number;
    clear: () => void;
    background: (r: number, g?: number, b?: number, a?: number) => void;
    noStroke: () => void;
    fill: (r: number, g?: number, b?: number, a?: number) => void;
    noFill: () => void;
    strokeWeight: (w: number) => void;
    stroke: (c: unknown) => void;
    color: (r: number, g: number, b: number, a?: number) => unknown;
    beginShape: () => void;
    vertex: (x: number, y: number) => void;
    endShape: (mode?: unknown) => void;
    CLOSE: unknown;
    circle: (x: number, y: number, d: number) => void;
    get: (x: number, y: number) => [number, number, number, number];
    [key: string]: unknown; // Allow access to other p5 methods
  }

  // p5 constructor type
  interface p5Constructor {
    new (sketch?: (p: p5Instance) => void, node?: HTMLElement): p5Instance;
  }

  const p5: p5Constructor;
  export default p5;
}
