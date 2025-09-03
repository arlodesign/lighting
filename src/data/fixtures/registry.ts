import { Fixture } from "./fixture";
import type { FixtureId, FixtureLocation, LedParLabel } from "./config";
import { FIXTURE_CONFIG, coordKey } from "./config";

// Build O(1) lookup maps at module load
const byId = new Map<FixtureId, Fixture<LedParLabel>>();
const byCoord = new Map<string, FixtureId>();

for (const fc of FIXTURE_CONFIG) {
  const f = new Fixture<LedParLabel>({
    startChannel: fc.startChannel,
    labels: fc.labels,
    initial: fc.initial,
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
