import { Fixture } from "./fixture";
import type { FixtureConfig, FixtureId, FixtureLocation } from "./config";
import { FIXTURE_CONFIG, coordKey } from "./config";

// Build O(1) lookup maps at module load
const byId = new Map<FixtureId, Fixture<any>>();
const byCoord = new Map<string, FixtureId>();

for (const fc of FIXTURE_CONFIG) {
  const f = new Fixture({
    startChannel: fc.startChannel,
    labels: fc.labels as readonly string[],
    initial: fc.initial as any,
  });
  byId.set(fc.id, f);
  byCoord.set(coordKey(fc.location), fc.id);
}

export const getFixture = (id: FixtureId) => byId.get(id)!;
export const findByLocation = (loc: FixtureLocation) => {
  const id = byCoord.get(coordKey(loc));
  return id ? byId.get(id)! : undefined;
};

export const allFixtureIds = () => Array.from(byId.keys());
export const allFixtures = () => Array.from(byId.entries());

