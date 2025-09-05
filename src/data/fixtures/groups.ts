import { FIXTURE_CONFIG, type FixtureId } from "./config";

export type BuiltInGroupName =
  | "all"
  | "front"
  | "back"
  | "left"
  | "right"
  | "front-left"
  | "front-right"
  | "back-left"
  | "back-right";

export type GroupName = BuiltInGroupName | (string & {});

// Build initial groups from the physical coordinates in FIXTURE_CONFIG
const allIds: FixtureId[] = FIXTURE_CONFIG.map((f) => f.id);
const frontIds: FixtureId[] = FIXTURE_CONFIG.filter(
  (f) => (f.location.y as unknown as string) === "DS"
).map((f) => f.id);
const backIds: FixtureId[] = FIXTURE_CONFIG.filter(
  (f) => (f.location.y as unknown as string) === "US"
).map((f) => f.id);
const leftIds: FixtureId[] = FIXTURE_CONFIG.filter(
  (f) => (f.location.x as unknown as string) === "SL"
).map((f) => f.id);
const rightIds: FixtureId[] = FIXTURE_CONFIG.filter(
  (f) => (f.location.x as unknown as string) === "SR"
).map((f) => f.id);

const frontLeftIds: FixtureId[] = FIXTURE_CONFIG.filter(
  (f) =>
    (f.location.y as unknown as string) === "DS" &&
    (f.location.x as unknown as string) === "SL"
).map((f) => f.id);
const frontRightIds: FixtureId[] = FIXTURE_CONFIG.filter(
  (f) =>
    (f.location.y as unknown as string) === "DS" &&
    (f.location.x as unknown as string) === "SR"
).map((f) => f.id);
const backLeftIds: FixtureId[] = FIXTURE_CONFIG.filter(
  (f) =>
    (f.location.y as unknown as string) === "US" &&
    (f.location.x as unknown as string) === "SL"
).map((f) => f.id);
const backRightIds: FixtureId[] = FIXTURE_CONFIG.filter(
  (f) =>
    (f.location.y as unknown as string) === "US" &&
    (f.location.x as unknown as string) === "SR"
).map((f) => f.id);

export const GROUPS: Record<GroupName, FixtureId[]> = {
  all: allIds,
  front: frontIds,
  back: backIds,
  left: leftIds,
  right: rightIds,
  "front-left": frontLeftIds,
  "front-right": frontRightIds,
  "back-left": backLeftIds,
  "back-right": backRightIds,
};

export function registerGroup(name: string, ids: FixtureId[]) {
  GROUPS[name] = ids.slice();
}

export function getGroup(name: GroupName): FixtureId[] {
  return GROUPS[name] ?? [];
}
