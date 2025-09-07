import { describe, it, expect } from "vitest";
import { FrameUniverseWriter } from "../runtime/universeWriter";

// Simple spy on setAddress via public API

describe("FrameUniverseWriter", () => {
  it("clamps setAddress to 0..255", () => {
    const w = new FrameUniverseWriter();
    w.setAddress(1, -10);
    w.setAddress(2, 260);
    expect(w.patch[1]).toBe(0);
    expect(w.patch[2]).toBe(255);
  });

  it("resolves fixture+label to absolute address via config", () => {
    const w = new FrameUniverseWriter();
    // Using known config: first fixture starts at 1; label 'r' is +1
    w.setFixture("wash-001" as any, "r" as any, 123);
    expect(w.patch[2]).toBe(123);
  });

  it("addPatch merges sparse address maps", () => {
    const w = new FrameUniverseWriter();
    w.addPatch({ 10: 1, 11: 2 });
    w.addPatch({ 11: 5, 12: 6 });
    expect(w.patch[10]).toBe(1);
    expect(w.patch[11]).toBe(5);
    expect(w.patch[12]).toBe(6);
  });
});

