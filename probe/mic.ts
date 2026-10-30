import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { c, heading } from "./prompt.ts";

const PORT = 4321;

/**
 * Microphone access is easy and accurate in a browser (Web Audio), and that's where the real
 * app will analyze audio too — so the probe tests the same path: a page served from localhost.
 */
export async function runMicSection(): Promise<unknown> {
  heading("Microphone");
  const html = await readFile(path.join(import.meta.dirname, "mic.html"));

  let resolveResult: (value: unknown) => void = () => {};
  const result = new Promise<unknown>((resolve) => (resolveResult = resolve));

  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/result") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        res.writeHead(204).end();
        try {
          resolveResult(JSON.parse(body));
        } catch {
          resolveResult({ error: "unparseable result" });
        }
      });
      return;
    }
    res
      .writeHead(200, { "content-type": "text/html; charset=utf-8" })
      .end(html);
  });
  await new Promise<void>((resolve) =>
    server.listen(PORT, "127.0.0.1", resolve),
  );

  const url = `http://localhost:${PORT}/`;
  console.log(
    `Opening ${c.bold(url)} — use ${c.bold("Chrome")} if it asks (Safari works too).`,
  );
  console.log(
    c.dim(
      "If no browser opens, paste that address into one. Waiting for the result…",
    ),
  );
  if (process.platform === "darwin") execFile("open", [url]);

  try {
    const data = await result;
    if (data && typeof data === "object" && "loud" in data) {
      const d = data as {
        quiet: { rms: { median: number } };
        loud: { rms: { median: number } };
        kicksDetectedWhileLoud: number;
      };
      console.log(
        c.green(
          `  ✓ quiet level ${d.quiet.rms.median}, loud level ${d.loud.rms.median}, ` +
            `${d.kicksDetectedWhileLoud} bass hits detected`,
        ),
      );
    } else {
      console.log(c.yellow(`  ⚠ ${JSON.stringify(data)}`));
    }
    return data;
  } finally {
    server.close();
  }
}
