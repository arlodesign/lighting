import { Fixture } from "./fixture";

// Axes for stage coordinates
export const X_AXIS = ["SL", "SR"] as const; // Stage Left / Stage Right
export const Y_AXIS = ["DS", "US"] as const; // Downstage / Upstage

export type X = (typeof X_AXIS)[number];
export type Y = (typeof Y_AXIS)[number];

export type Coordinate = {
  x: X;
  y: Y;
  slot: number; // left-to-right position within the stand/row
};

// Default LED PAR layout for existing fixtures
// IMPORTANT: Array order defines DMX channel offsets for this fixture schema.
export const LED_PAR_LABELS = [
  "master",
  "r",
  "g",
  "b",
  "rgb",
  "strobe",
  "mode",
] as const;
export type LedParLabel = (typeof LED_PAR_LABELS)[number];

// Single source of truth for fixtures in the rig
export const FIXTURE_CONFIG = [
  // Stage Left - Downstage (slots 1..4)
  {
    id: "wash-001",
    location: { x: "SL", y: "DS", slot: 1 } as const,
    startChannel: 1,
    labels: LED_PAR_LABELS,
    initial: { strobe: 1, mode: 1 },
  },
  {
    id: "wash-002",
    location: { x: "SL", y: "DS", slot: 2 } as const,
    startChannel: 11,
    labels: LED_PAR_LABELS,
    initial: { strobe: 1, mode: 1 },
  },
  {
    id: "wash-003",
    location: { x: "SL", y: "DS", slot: 3 } as const,
    startChannel: 21,
    labels: LED_PAR_LABELS,
    initial: { strobe: 1, mode: 1 },
  },
  {
    id: "wash-004",
    location: { x: "SL", y: "DS", slot: 4 } as const,
    startChannel: 31,
    labels: LED_PAR_LABELS,
    initial: { strobe: 1, mode: 1 },
  },

  // Stage Right - Downstage (slots 1..4)
  {
    id: "wash-005",
    location: { x: "SR", y: "DS", slot: 4 } as const,
    startChannel: 41,
    labels: LED_PAR_LABELS,
    initial: { strobe: 1, mode: 1 },
  },
  {
    id: "wash-006",
    location: { x: "SR", y: "DS", slot: 3 } as const,
    startChannel: 51,
    labels: LED_PAR_LABELS,
    initial: { strobe: 1, mode: 1 },
  },
  {
    id: "wash-007",
    location: { x: "SR", y: "DS", slot: 2 } as const,
    startChannel: 61,
    labels: LED_PAR_LABELS,
    initial: { strobe: 1, mode: 1 },
  },
  {
    id: "wash-008",
    location: { x: "SR", y: "DS", slot: 1 } as const,
    startChannel: 71,
    labels: LED_PAR_LABELS,
    initial: { strobe: 1, mode: 1 },
  },
] as const satisfies readonly {
  id: string;
  location: Coordinate;
  startChannel: number;
  labels: readonly LedParLabel[];
  initial?: Partial<Record<LedParLabel, number>>;
}[];

export type FixtureConfig = (typeof FIXTURE_CONFIG)[number];
export type FixtureId = FixtureConfig["id"];
export type FixtureLocation = FixtureConfig["location"];

/**
 * Normalizes a physical location coordinate into a stable Map key.
 * Do not change without migrating existing saved references.
 */
export const coordKey = (l: Coordinate) => `${l.x}:${l.y}:${l.slot}`;
