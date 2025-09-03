class Universe {
  private _currentUniverse = Array(512).fill(0);
  private _nextUniverse = Array(512).fill(0);
  private _hasChanges = false;

  set(index: number, value: number) {
    // Because DMX universes are 1-indexed, we need to subtract 1 from the index.
    const idx = index - 1;
    const prev = this._nextUniverse[idx];
    if (prev !== value) {
      this._nextUniverse[idx] = value;
      this._hasChanges = true;
    }
  }

  update(): Record<number, number> | undefined {
    // If no channel was touched since the last update, skip the diff work.
    if (!this._hasChanges) return undefined;

    // Build a sparse diff of channel changes between current and next universes.
    // Keys are 1-based DMX addresses; values are the new channel values.
    const changes: Record<number, number> = {};
    let hasChanges = false;

    for (let i = 0; i < 512; i++) {
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
