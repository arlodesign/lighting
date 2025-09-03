import { describe, it, expect } from "vitest";
import { Fixture } from "../data/fixtures";
import {
  LED_PAR_LABELS,
  FIXTURE_CONFIG,
  getFixture,
  findByLocation,
  type FixtureId,
} from "../data/fixtures";
import { Universe } from "../data/universe";
import { applySparsePatch } from "../data/universe/apply";

describe("Fixture (generic, label-driven)", () => {
  it("maps labels to absolute DMX addresses from startChannel", () => {
    const LABELS = ["master", "r", "g"] as const;
    const fx = new Fixture<{ [K in (typeof LABELS)[number]]: K }[keyof any]>({
      startChannel: 10,
      labels: LABELS,
    });

    expect(fx.getAddress("master" as any)).toBe(10);
    expect(fx.getAddress("r" as any)).toBe(11);
    expect(fx.getAddress("g" as any)).toBe(12);
  });

  it("validates DMX values (0-255)", () => {
    const LABELS = ["a"] as const;
    const fx = new Fixture<{ [K in (typeof LABELS)[number]]: K }[keyof any]>({
      startChannel: 1,
      labels: LABELS,
    });

    fx.setValue("a" as any, 0);
    fx.setValue("a" as any, 255);
    expect(() => fx.setValue("a" as any, -1)).toThrowError();
    expect(() => fx.setValue("a" as any, 256)).toThrowError();
  });

  it("emits a sparse DMX map covering its footprint", () => {
    const LABELS = ["x", "y"] as const;
    const fx = new Fixture<{ [K in (typeof LABELS)[number]]: K }[keyof any]>({
      startChannel: 5,
      labels: LABELS,
      initial: { y: 7 } as any,
    });

    // toDmx should include startChannel..start+labels-1
    expect(fx.toDmx()).toEqual({ 5: 0, 6: 7 });
  });
});

describe("Fixtures registry and config (coordinate-based)", () => {
  it("exposes fixtures by id", () => {
    const first = FIXTURE_CONFIG[0];
    const f = getFixture(first.id as FixtureId);
    expect(f).toBeDefined();
    expect(f.startChannel).toBe(first.startChannel);
    expect(f.labels.length).toBe(LED_PAR_LABELS.length);
  });

  it("finds fixtures by coordinate { x, y, slot }", () => {
    const target = FIXTURE_CONFIG.find(
      (fc) =>
        fc.location.x === "SL" &&
        fc.location.y === "DS" &&
        fc.location.slot === 3
    );
    expect(target).toBeDefined();

    const f = findByLocation(target!.location);
    expect(f).toBeDefined();
    expect(f!.startChannel).toBe(target!.startChannel);
  });

  it("includes initial non-zero channels in toDmx (e.g., strobe/mode)", () => {
    const target = FIXTURE_CONFIG[0];
    const f = getFixture(target.id as FixtureId);
    const dmx = f.toDmx();
    // LED_PAR_LABELS order: master(0), r(1), g(2), b(3), rgb(4), strobe(5), mode(6)
    const strobeAddr = target.startChannel + 5;
    const modeAddr = target.startChannel + 6;
    expect(dmx[strobeAddr]).toBe(1);
    expect(dmx[modeAddr]).toBe(1);
  });
});

describe("Fixture + Universe integration", () => {
  it("applies fixture state to Universe and diffs changes", () => {
    const target = FIXTURE_CONFIG[1];
    const f = getFixture(target.id as FixtureId);

    // Change a couple of channels
    f.setValues({ master: 100, r: 64 } as any);

    const u = new Universe();
    applySparsePatch(u, f.toDmx());

    const diff = u.update();
    expect(diff).toBeDefined();

    // Expected changed addresses:
    const masterAddr = target.startChannel + 0; // "master"
    const rAddr = target.startChannel + 1; // "r"
    const strobeAddr = target.startChannel + 5; // initial 1
    const modeAddr = target.startChannel + 6; // initial 1

    // We should observe the set values and the initial non-zero values.
    expect(diff![masterAddr]).toBe(100);
    expect(diff![rAddr]).toBe(64);
    expect(diff![strobeAddr]).toBe(1);
    expect(diff![modeAddr]).toBe(1);

    // Calling update again without changes yields undefined
    expect(u.update()).toBeUndefined();
  });
});

// Multiple fixtures in one frame
describe("Universe with multiple fixtures", () => {
  it("applies two fixtures and returns one combined sparse diff", () => {
    const f1 = FIXTURE_CONFIG[0];
    const f2 = FIXTURE_CONFIG[5];

    const fx1 = getFixture(f1.id as FixtureId);
    const fx2 = getFixture(f2.id as FixtureId);

    // Update different channels on both fixtures
    fx1.setValues({ master: 200, b: 50 } as any);
    fx2.setValues({ g: 80 } as any);

    const u = new Universe();
    applySparsePatch(u, fx1.toDmx());
    applySparsePatch(u, fx2.toDmx());

    const diff = u.update();
    expect(diff).toBeDefined();

    // Addresses for f1
    const f1Master = f1.startChannel + 0; // master
    const f1B = f1.startChannel + 3; // b
    const f1Strobe = f1.startChannel + 5; // strobe (initial 1)
    const f1Mode = f1.startChannel + 6; // mode (initial 1)
    expect(diff![f1Master]).toBe(200);
    expect(diff![f1B]).toBe(50);
    expect(diff![f1Strobe]).toBe(1);
    expect(diff![f1Mode]).toBe(1);

    // Addresses for f2
    const f2G = f2.startChannel + 2; // g
    const f2Strobe = f2.startChannel + 5; // strobe (initial 1)
    const f2Mode = f2.startChannel + 6; // mode (initial 1)
    expect(diff![f2G]).toBe(80);
    expect(diff![f2Strobe]).toBe(1);
    expect(diff![f2Mode]).toBe(1);

    // Next update without changes is empty
    expect(u.update()).toBeUndefined();
  });
});

// Batch selection by area (x,y)
describe("Batch selection by area", () => {
  it("selects all fixtures in { x: 'SL', y: 'DS' } and updates together", () => {
    const area = { x: "SL" as const, y: "DS" as const };
    const inArea = FIXTURE_CONFIG.filter(
      (fc) => fc.location.x === area.x && fc.location.y === area.y
    );
    // Expect 4 per the current config
    expect(inArea.length).toBe(4);

    const fixtures = inArea.map((fc) => getFixture(fc.id as FixtureId));

    // Update 'master' on all fixtures in the area
    fixtures.forEach((f, i) => f.setValue("master" as any, 50 + i * 10));

    const u = new Universe();
    fixtures.forEach((f) => applySparsePatch(u, f.toDmx()));
    const diff = u.update();
    expect(diff).toBeDefined();

    // Verify each updated master address is present with the right value
    inArea.forEach((fc, i) => {
      const addr = fc.startChannel + 0;
      expect(diff![addr]).toBe(50 + i * 10);
    });
  });
});

// Edge cases around DMX channel 512
describe("Fixture boundary near DMX 512", () => {
  it("allows a fixture that ends exactly at 512", () => {
    const LABELS = ["a", "b"] as const;
    const fx = new Fixture<{ [K in (typeof LABELS)[number]]: K }[keyof any]>({
      startChannel: 511,
      labels: LABELS,
      initial: { a: 1, b: 2 } as any,
    });
    expect(fx.getAddress("a" as any)).toBe(511);
    expect(fx.getAddress("b" as any)).toBe(512);

    const u = new Universe();
    applySparsePatch(u, fx.toDmx());
    const diff = u.update();
    expect(diff).toEqual({ 511: 1, 512: 2 });
  });

  it("throws when fixture footprint would exceed 512", () => {
    const LABELS = ["a", "b"] as const;
    expect(
      () =>
        new Fixture<{ [K in (typeof LABELS)[number]]: K }[keyof any]>({
          startChannel: 512,
          labels: LABELS,
        })
    ).toThrowError();
  });
});
