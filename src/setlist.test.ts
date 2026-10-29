import { describe, expect, it } from "vitest";
import { LOOKS } from "./engine/looks/index.ts";
import { PALETTES } from "./engine/palettes.ts";
import { SETLIST } from "./setlist.ts";

// A typo in a palette or look id would silently do nothing on stage; catch it here.
describe("SETLIST", () => {
  it("has songs, each with a name", () => {
    expect(SETLIST.length).toBeGreaterThan(0);
    for (const song of SETLIST) expect(song.name.trim()).not.toBe("");
  });

  it("only refers to palettes and looks that exist", () => {
    const palettes = new Set(PALETTES.map((p) => p.id));
    const looks = new Set(LOOKS.map((l) => l.id));
    for (const song of SETLIST) {
      if (song.palette)
        expect(palettes, `${song.name}: palette`).toContain(song.palette);
      if (song.look) expect(looks, `${song.name}: look`).toContain(song.look);
    }
  });

  it("only sets tempos a person could actually play", () => {
    for (const song of SETLIST) {
      if (song.bpm !== undefined) {
        expect(song.bpm, song.name).toBeGreaterThanOrEqual(50);
        expect(song.bpm, song.name).toBeLessThanOrEqual(220);
      }
    }
  });
});
