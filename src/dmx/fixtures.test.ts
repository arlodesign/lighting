import { describe, expect, it } from "vitest";
import { RIG } from "../config.ts";
import { writeFrame } from "./fixtures.ts";
import { UNIVERSE_SIZE } from "./types.ts";

const black = { r: 0, g: 0, b: 0 };

describe("writeFrame", () => {
  it("puts brightness on the master dimmer and full-chroma colour on RGB", () => {
    const universe = new Uint8Array(UNIVERSE_SIZE);
    const lights = Array.from({ length: 8 }, () => black);
    lights[0] = { r: 0.2, g: 0, b: 0.1 }; // dim purple-red on L1
    writeFrame({ lights, strobe: 0 }, RIG, universe);

    const at = RIG.addresses.L1 - 1;
    expect(universe[at + 0]).toBe(51); // master = 0.2 × 255
    expect(universe[at + 1]).toBe(255); // red at full chroma
    expect(universe[at + 3]).toBe(128); // blue keeps its ratio to red
    expect(universe[at + 5]).toBe(RIG.profile.neutral.strobe);
  });

  it("maps strobe 0–1 into the fixture's strobe range", () => {
    const universe = new Uint8Array(UNIVERSE_SIZE);
    const lights = Array.from({ length: 8 }, () => ({ r: 1, g: 1, b: 1 }));
    writeFrame({ lights, strobe: 1 }, RIG, universe);
    expect(universe[RIG.addresses.R4 - 1 + 5]).toBe(
      RIG.profile.strobeRange.fast,
    );
  });
});
