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
    [key: string]: any; // Allow access to other p5 methods
  }

  // p5 constructor type
  interface p5Constructor {
    new (sketch?: (p: p5Instance) => void, node?: HTMLElement): p5Instance;
  }

  const p5: p5Constructor;
  export default p5;
}
