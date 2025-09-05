import type { Show } from "@/runtime/types";
import { DemoShow } from "./demoShow";
import { CalibrationShow } from "./calibrationShow";
import { ConcertShow } from "./concertShow";
import { RandomWalkerShow } from "./randomWalkerShow";

/**
 * Registry of all available shows in the system.
 * Add new shows here to make them discoverable.
 */
export const SHOWS: Record<string, Show> = {
  demo: DemoShow,
  calibration: CalibrationShow,
  concert: ConcertShow,
  walker: RandomWalkerShow,
} as const;

/**
 * Get all available show names
 */
export function getAllShowNames(): string[] {
  return Object.keys(SHOWS);
}

/**
 * Get all available shows
 */
export function getAllShows(): Show[] {
  return Object.values(SHOWS);
}

/**
 * Get a show by name
 */
export function getShowByName(name: string): Show | null {
  return SHOWS[name] || null;
}

/**
 * Get show metadata for display purposes
 */
export function getShowMetadata() {
  return getAllShows().map((show) => ({
    name: show.name,
    id: Object.keys(SHOWS).find((key) => SHOWS[key] === show)!,
    sceneCount: show.scenes.length,
    scenes: show.scenes.map((scene) => ({
      name: scene.name,
      lookCount: scene.looks.length,
    })),
  }));
}
