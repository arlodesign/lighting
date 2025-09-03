/**
 * Applies a sparse address->value patch (1-based DMX addresses) to a Universe.
 * Useful to apply a Fixture's toDmx() output or any precomputed patch.
 */
import { Universe } from ".";

export function applySparsePatch(u: Universe, patch: Record<number, number>) {
  for (const [addrStr, val] of Object.entries(patch)) {
    u.set(Number(addrStr), val);
  }
}

