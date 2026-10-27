import { defineConfig } from "vitest/config";

// Separate from vite.config.ts, whose root is hud/ (that would hide src/ from the tests).
export default defineConfig({
  root: ".",
  test: {
    include: ["src/**/*.test.ts", "probe/**/*.test.ts"],
    // The look tests sweep thousands of frames; give slower machines (the show laptop) room.
    testTimeout: 30_000,
  },
});
