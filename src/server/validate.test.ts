import { describe, expect, it } from "vitest";
import { isAllowedOrigin, parseClientMessage } from "./validate.ts";

const parse = (x: unknown) => parseClientMessage(JSON.stringify(x));

describe("parseClientMessage", () => {
  it("accepts well-formed actions and audio", () => {
    expect(parse({ type: "action", action: { type: "tap" } })).toEqual({
      type: "action",
      action: { type: "tap" },
    });
    expect(
      parse({
        type: "action",
        action: { type: "hit", hit: "blackout", down: true },
      }),
    ).toMatchObject({ action: { hit: "blackout" } });
    expect(parse({ type: "audio", level: 0.5, bass: 0.2, kick: true })).toEqual(
      {
        type: "audio",
        level: 0.5,
        bass: 0.2,
        kick: true,
      },
    );
  });

  it.each([
    "not json",
    { type: "action", action: { type: "hit", hit: "explode", down: true } },
    { type: "action", action: { type: "knob", knob: "speed", delta: "lots" } },
    { type: "action", action: { type: "fader", fader: "master", value: 7 } },
    { type: "action", action: { type: "look", index: -1 } },
    { type: "audio", level: null, bass: 0 },
    { type: "eval", code: "rm -rf" },
  ])("drops %j", (bad) => {
    expect(
      typeof bad === "string" ? parseClientMessage(bad) : parse(bad),
    ).toBeUndefined();
  });
});

describe("isAllowedOrigin", () => {
  const allowed = ["http://localhost:4000"];
  it("allows the app itself and rejects everyone else", () => {
    expect(isAllowedOrigin("http://localhost:4000", allowed)).toBe(true);
    expect(isAllowedOrigin("https://evil.example", allowed)).toBe(false);
    expect(isAllowedOrigin(undefined, allowed)).toBe(false);
  });
});
