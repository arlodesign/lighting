import type { UniverseWriter } from "./types";
import {
  allFixtureIds,
  GROUPS,
  type FixtureId,
  type GroupName,
  type LedParLabel,
} from "@/data/fixtures";

export type RGB = { r: number; g: number; b: number };

function clamp(n: number, min = 0, max = 255) {
  return Math.min(max, Math.max(min, n | 0));
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function resolveTargets(
  target: "all" | GroupName | FixtureId[] | FixtureId
): FixtureId[] {
  if (target === "all") return allFixtureIds();
  if (Array.isArray(target)) return uniq(target);
  if (typeof target === "string" && GROUPS[target]) return GROUPS[target];
  return [target as FixtureId];
}

export type LightsTargetSelector = {
  rgb: (r: number, g: number, b: number) => LightsTargetSelector;
  master: (value: number) => LightsTargetSelector;
  set: (label: LedParLabel, value: number) => LightsTargetSelector; // escape hatch
  setValues: (
    values: Partial<Record<LedParLabel, number>>
  ) => LightsTargetSelector;
};

export type LightsFacade = {
  all: LightsTargetSelector;
  group: (name: GroupName | "all") => LightsTargetSelector;
  groups: (names: (GroupName | "all")[]) => LightsTargetSelector;
  fixture: (id: FixtureId) => LightsTargetSelector;
  fixtures: (ids: FixtureId[]) => LightsTargetSelector;
  off: () => void;
  blackout: () => void;
  // Patterns (initial set)
  chase: (opts: {
    group?: GroupName | "all" | FixtureId[];
    colors?: RGB[]; // for RGB
    values?: number[]; // for master-only
    periodMs?: number;
    beats?: number;
    width?: number; // number of fixtures lit per step
    phase?: number; // 0..1
    direction?: "forward" | "backward";
    target?: "rgb" | "master" | "both";
  }) => void;
  pulse: (opts: {
    group?: GroupName | "all" | FixtureId[];
    base?: number; // master base
    peak?: number; // master peak
    periodMs?: number;
    beats?: number;
    curve?: "sin" | "tri" | "ease";
  }) => void;
  sparkle: (opts: {
    group?: GroupName | "all" | FixtureId[];
    value?: number; // master value for sparkles
    density?: number; // 0..1
    decayMs?: number; // not persisted here; per-frame effect
    seed?: number;
  }) => void;
};

export function createLightsFacade(universe: UniverseWriter): LightsFacade {
  const select = (targets: FixtureId[]): LightsTargetSelector => {
    return {
      rgb: (r, g, b) => {
        for (const id of targets) {
          universe.setFixture(id, "r", clamp(r));
          universe.setFixture(id, "g", clamp(g));
          universe.setFixture(id, "b", clamp(b));
        }
        return select(targets);
      },
      master: (value) => {
        for (const id of targets) {
          universe.setFixture(id, "master", clamp(value));
        }
        return select(targets);
      },
      set: (label, value) => {
        for (const id of targets) {
          universe.setFixture(id, label, clamp(value));
        }
        return select(targets);
      },
      setValues: (values) => {
        for (const id of targets) {
          for (const [label, value] of Object.entries(values) as [
            LedParLabel,
            number
          ][]) {
            if (value == null) continue;
            universe.setFixture(id, label, clamp(value));
          }
        }
        return select(targets);
      },
    };
  };

  const self: LightsFacade = {
    all: select(resolveTargets("all")),
    group: (name) => select(resolveTargets(name)),
    groups: (names) => select(uniq(names.flatMap((n) => resolveTargets(n)))),
    fixture: (id) => select([id]),
    fixtures: (ids) => select(uniq(ids)),
    off: () => {
      for (const id of resolveTargets("all")) {
        universe.setFixture(id, "master", 0);
        universe.setFixture(id, "r", 0);
        universe.setFixture(id, "g", 0);
        universe.setFixture(id, "b", 0);
      }
    },
    blackout: () => {
      // same as off for now
      self.off();
    },
    chase: (opts) => {
      const ids = resolveTargets(opts.group ?? "all");
      const width = Math.max(1, Math.min(ids.length, opts.width ?? 1));
      const phase = (opts.phase ?? 0) % 1;
      const target = opts.target ?? (opts.colors ? "rgb" : "master");
      // The caller will control time/phase externally via t helpers. Here we just index by phase.
      const baseIndex = Math.floor(phase * ids.length);
      for (let i = 0; i < ids.length; i++) {
        const idx = (baseIndex + i) % ids.length;
        const active = i < width;
        const id = ids[idx];
        if (target === "rgb" || target === "both") {
          const c = (opts.colors ?? [
            { r: 255, g: 255, b: 255 },
            { r: 0, g: 0, b: 0 },
          ])[active ? 0 : 1];
          self.fixture(id).rgb(c.r, c.g, c.b);
        }
        if (target === "master" || target === "both") {
          const v = (opts.values ?? [255, 0])[active ? 0 : 1];
          self.fixture(id).master(v);
        }
      }
    },
    pulse: (opts) => {
      const ids = resolveTargets(opts.group ?? "all");
      const base = opts.base ?? 60;
      const peak = opts.peak ?? 255;
      // Caller controls curve via t helpers, so this is a thin wrapper
      // Here we simply set peak for now; author will mix with base externally if desired.
      for (const id of ids) {
        self.fixture(id).master(peak);
      }
    },
    sparkle: (opts) => {
      const ids = resolveTargets(opts.group ?? "all");
      const density = Math.max(0, Math.min(1, opts.density ?? 0.1));
      const value = opts.value ?? 255;
      for (const id of ids) {
        if (Math.random() < density) self.fixture(id).master(value);
      }
    },
  };

  return self;
}
