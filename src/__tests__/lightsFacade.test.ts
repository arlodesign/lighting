import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLightsFacade } from "../runtime/lightsFacade";
import type { UniverseWriter } from "../runtime/types";

class SpyWriter implements UniverseWriter {
  patch: Record<number, number> = {};
  setAddress(addr: number, val: number) { this.patch[addr] = val; }
  setFixtureCalls: Array<[string, string, number]> = [];
  setFixture(fixtureId: any, label: any, value: any): void {
    this.setFixtureCalls.push([fixtureId, label, value]);
  }
  addPatch(p: Record<number, number>): void {
    Object.assign(this.patch, p);
  }
}

describe("createLightsFacade", () => {
  let writer: SpyWriter;
  beforeEach(() => { writer = new SpyWriter(); });

  it("all.rgb and all.master call setFixture for each id", () => {
    const lights = createLightsFacade(writer);
    lights.all.rgb(10, 20, 30).master(40);
    // Should have called setFixture for 8 fixtures (r,g,b) + (master)
    const rgbCalls = writer.setFixtureCalls.filter(([, label]) => label !== "master");
    const masterCalls = writer.setFixtureCalls.filter(([, label]) => label === "master");
    expect(rgbCalls.length).toBeGreaterThan(0);
    expect(masterCalls.length).toBeGreaterThan(0);
  });

  it("group() resolves built-in groups and clamps values", () => {
    const lights = createLightsFacade(writer);
    lights.group("front").master(300);
    // Should clamp to 255 and call at least once
    expect(writer.setFixtureCalls.length).toBeGreaterThan(0);
    expect(writer.setFixtureCalls.every(([, , v]) => v <= 255)).toBe(true);
  });

  it("fixtures([...]).setValues spreads multiple labels", () => {
    const lights = createLightsFacade(writer);
    lights.fixtures(["wash-001" as any, "wash-002" as any]).setValues({ master: 100, r: 20 });
    const masters = writer.setFixtureCalls.filter(([, l]) => l === "master");
    const reds = writer.setFixtureCalls.filter(([, l]) => l === "r");
    expect(masters.length).toBe(2);
    expect(reds.length).toBe(2);
  });
});

