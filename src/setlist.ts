import { readFileSync } from "node:fs";
import { parseSetlist, type Song } from "./songs.ts";

export type { Song, SongSettings } from "./songs.ts";

/**
 * The night's setlist lives in src/setlist.json, so a setlist exported from the show
 * (presets saved on site included) can be dropped straight back into the repo.
 */
export const SETLIST_FILE = new URL("./setlist.json", import.meta.url);

/** The setlist as written in the repo: the defaults before any on-site saves. */
export const SETLIST: readonly Song[] = parseSetlist(
  JSON.parse(readFileSync(SETLIST_FILE, "utf8")),
);
