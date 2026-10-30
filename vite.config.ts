import { defineConfig } from "vite";

// The HUD lives in hud/ and builds into dist/hud, which the Node server serves.
// In dev (`npm run dev`), Vite serves the HUD with live reload and forwards /ws to the server.
export default defineConfig({
  root: "hud",
  build: { outDir: "../dist/hud", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/ws": { target: "ws://localhost:4000", ws: true },
      "/export": "http://localhost:4000",
    },
  },
});
