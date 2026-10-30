import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SETLIST, SETLIST_FILE } from "../setlist.ts";
import {
  applyPresets,
  EMPTY_PRESETS,
  exportSetlist,
  loadPresets,
  savePresets,
  withoutPreset,
  withPreset,
} from "./presets.ts";

const dirs: string[] = [];
afterEach(async () => {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
async function tmpFile() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "presets-"));
  dirs.push(dir);
  return path.join(dir, "presets.json");
}

const SET = [
  { name: "One", bpm: 120, look: "chase", palette: "blood" },
  { name: "Two", notes: "slow" },
];

describe("presets", () => {
  it("start empty when nothing has been saved", async () => {
    expect(await loadPresets(await tmpFile())).toEqual(EMPTY_PRESETS);
  });

  it("survive a corrupt file (start empty instead of crashing)", async () => {
    const file = await tmpFile();
    await writeFile(file, "{ not json");
    expect(await loadPresets(file)).toEqual(EMPTY_PRESETS);
  });

  it("round-trip through the file, dropping anything malformed", async () => {
    const file = await tmpFile();
    const saved = withPreset(EMPTY_PRESETS, "One", {
      bpm: 98,
      look: "ripple",
      width: 0.7,
      swell: 0.25,
      hue: 7 as never, // out of range: dropped
    });
    await savePresets(saved, file);
    const loaded = await loadPresets(file);
    expect(loaded.songs.One).toEqual({
      bpm: 98,
      look: "ripple",
      width: 0.7,
      swell: 0.25,
    });
  });

  it("layer on top of the defaults, song by song", () => {
    const presets = withPreset(EMPTY_PRESETS, "One", {
      look: "ripple",
      width: 0.9,
    });
    const merged = applyPresets(SET, presets);
    expect(merged[0]).toMatchObject({
      name: "One",
      bpm: 120,
      look: "ripple",
      width: 0.9,
      palette: "blood",
    });
    expect(merged[1]).toEqual(SET[1]); // untouched
  });

  it("reset removes just that song's preset", () => {
    const both = withPreset(
      withPreset(EMPTY_PRESETS, "One", { width: 1 }),
      "Two",
      { width: 0 },
    );
    const reset = withoutPreset(both, "One");
    expect(Object.keys(reset.songs)).toEqual(["Two"]);
  });

  it("export writes src/setlist.json's exact format (so a drop-in shows only real changes)", async () => {
    const repoFile = await readFile(SETLIST_FILE, "utf8");
    expect(exportSetlist(SETLIST)).toBe(repoFile);
  });

  it("keep a song's Low and High changes, and export them before the notes", async () => {
    const file = await tmpFile();
    await savePresets(
      withPreset(EMPTY_PRESETS, "Two", {
        look: "wash",
        high: { look: "chase", speed: 4 },
        low: {}, // nothing changed: dropped
      }),
      file,
    );
    const presets = await loadPresets(file);
    expect(presets.songs.Two).toEqual({
      look: "wash",
      high: { look: "chase", speed: 4 },
    });
    const text = exportSetlist(applyPresets(SET, presets));
    expect(Object.keys(JSON.parse(text)[1])).toEqual([
      "name",
      "look",
      "high",
      "notes",
    ]);
  });

  it("export of a merged setlist parses back to the same songs", () => {
    const presets = withPreset(EMPTY_PRESETS, "One", {
      look: "ripple",
      swell: 0.5,
    });
    const text = exportSetlist(applyPresets(SET, presets));
    const parsed = JSON.parse(text);
    expect(parsed[0]).toEqual({
      name: "One",
      bpm: 120,
      look: "ripple",
      palette: "blood",
      swell: 0.5,
    });
    expect(text.endsWith("\n")).toBe(true);
  });
});
