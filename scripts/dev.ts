/**
 * Development: the server (restarts when src/ changes) + Vite (live-reloading HUD).
 * Open http://localhost:5173. Extra args go to the server, e.g. `npm run dev -- --fake`.
 */
import { spawn, type ChildProcess } from "node:child_process";

const children: ChildProcess[] = [
  spawn(
    process.execPath,
    ["--watch-path=src", "src/server/main.ts", ...process.argv.slice(2)],
    {
      stdio: "inherit",
    },
  ),
  spawn("npx", ["vite"], { stdio: "inherit" }),
];

const stop = () => {
  for (const child of children) child.kill("SIGINT");
  setTimeout(() => process.exit(0), 500);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) child.on("exit", stop);
