import { DMX_UNIVERSE_SIZE } from "../dmx/constants";

class Universe {
  private _currentUniverse = Array(DMX_UNIVERSE_SIZE).fill(0);
  private _nextUniverse = Array(DMX_UNIVERSE_SIZE).fill(0);
  private _hasChanges = false;

  /**
   * Sets a 1-based DMX address to a value (0–255). No-op if unchanged since last set.
   * Addresses are 1-based in DMX; we convert to 0-based for internal arrays.
   */
  set(index: number, value: number) {
    const idx = index - 1;
    const prev = this._nextUniverse[idx];
    if (prev !== value) {
      this._nextUniverse[idx] = value;
      this._hasChanges = true;
    }
  }

  /**
   * Computes a sparse diff of channel changes between current and next universes.
   * Returns undefined if nothing changed since last update.
   * Keys are 1-based DMX addresses; values are the new channel values.
   */
  update(): Record<number, number> | undefined {
    if (!this._hasChanges) return undefined;

    const changes: Record<number, number> = {};
    let hasChanges = false;

    for (let i = 0; i < DMX_UNIVERSE_SIZE; i++) {
      const currentVal = this._currentUniverse[i];
      const nextVal = this._nextUniverse[i];
      if (currentVal !== nextVal) {
        changes[i + 1] = nextVal;
        hasChanges = true;
      }
    }

    // Reset change flag regardless of outcome; future sets will flip it back on.
    this._hasChanges = false;

    // If nothing changed, return undefined so callers can skip API calls.
    if (!hasChanges) return undefined;

    // Advance the current universe to the next snapshot for subsequent diffs.
    this._currentUniverse = this._nextUniverse.slice();

    // Caller can use this object to make the API call to the DMX server.
    return changes;
  }
}

export { Universe };
