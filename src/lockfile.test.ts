import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const lockfile = path.join(import.meta.dirname, "..", "package-lock.json");

describe("package-lock.json", () => {
  it("only points at the public npm registry", () => {
    // `npm install` records whatever registry the machine is configured with. If that's a
    // private mirror, the lockfile breaks installs everywhere else (403s). Fix with:
    //   sed -i '' 's#https://<mirror-host>/npm/#https://registry.npmjs.org/#g' package-lock.json
    const text = readFileSync(lockfile, "utf8");
    const hosts = new Set(
      [...text.matchAll(/"resolved":\s*"(https?:\/\/[^/"]+)/g)].map(
        (m) => m[1],
      ),
    );
    expect([...hosts]).toEqual(["https://registry.npmjs.org"]);
  });
});
