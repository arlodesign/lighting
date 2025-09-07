import { describe, it, expect } from "vitest";
import { SHOWS, getAllShowNames, getAllShows, getShowByName, getShowMetadata } from "../shows";

describe("shows registry", () => {
  it("exposes consistent registries and metadata", () => {
    const names = getAllShowNames();
    const shows = getAllShows();
    expect(names.length).toBe(shows.length);
    expect(Object.keys(SHOWS).sort()).toEqual(names.sort());
    for (const name of names) {
      const show = getShowByName(name);
      expect(show).toBeTruthy();
    }
    const meta = getShowMetadata();
    expect(meta.length).toBe(shows.length);
    expect(meta[0]).toHaveProperty("name");
    expect(meta[0]).toHaveProperty("sceneCount");
  });
});

