import { describe, it, expect } from "vitest";
import { Universe } from "../data/universe";

describe("Universe", () => {
  it("returns undefined when nothing changed", () => {
    const u = new Universe();
    expect(u.update()).toBeUndefined();
  });

  it("returns sparse diff for a single channel change, then nothing on next call", () => {
    const u = new Universe();
    u.set(1, 255);
    expect(u.update()).toEqual({ 1: 255 });
    expect(u.update()).toBeUndefined();
  });

  it("returns sparse diff for multiple channel changes", () => {
    const u = new Universe();
    u.set(1, 10);
    u.set(5, 20);
    expect(u.update()).toEqual({ 1: 10, 5: 20 });
  });

  it("ignores setting a channel to its current value (no change)", () => {
    const u = new Universe();
    u.set(1, 0); // starts at 0; should not mark changes
    expect(u.update()).toBeUndefined();
  });

  it("diffs across frames from current to next snapshots", () => {
    const u = new Universe();
    u.set(1, 10);
    expect(u.update()).toEqual({ 1: 10 });

    u.set(1, 10); // No-op
    expect(u.update()).toBeUndefined();

    u.set(1, 5); // Actual change
    expect(u.update()).toEqual({ 1: 5 });
  });
});
