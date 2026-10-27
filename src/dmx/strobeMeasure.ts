export interface StrobeEstimate {
  /** Taps recorded in the measuring window (after the settle period). */
  taps: number;
  /** Intervals kept after throwing out stumbles (double-taps, missed beats). */
  usedIntervals: number;
  medianIntervalMs: number | null;
  /** Flashes per second, or null if there weren't enough clean taps to say. */
  hz: number | null;
  /** True when tapping was too sparse or too erratic to trust the number. */
  unreliable: boolean;
}

const MIN_INTERVALS = 3;

/**
 * Turn the times (ms since the step began) at which someone tapped along with a flashing
 * light into a flash rate.
 *
 * People need a moment to lock on, so taps before `settleMs` are ignored. The rate comes from
 * the MEDIAN gap between taps, so one double-tap or one missed pulse doesn't skew it, and any
 * gap far from the median (under 0.6× or over 1.6×) is thrown out as a stumble.
 */
export function estimateStrobeHz(
  tapTimesMs: readonly number[],
  settleMs = 2000,
): StrobeEstimate {
  const taps = tapTimesMs.filter((t) => t >= settleMs).sort((a, b) => a - b);
  const gaps = taps.slice(1).map((t, i) => t - taps[i]!);
  if (gaps.length < MIN_INTERVALS) {
    return {
      taps: taps.length,
      usedIntervals: gaps.length,
      medianIntervalMs: null,
      hz: null,
      unreliable: true,
    };
  }

  const rough = median(gaps);
  const kept = gaps.filter((g) => g >= rough * 0.6 && g <= rough * 1.6);
  const medianIntervalMs = median(kept.length ? kept : gaps);
  // How steady were the kept gaps? A wandering tap tempo means the number isn't trustworthy.
  const spread =
    kept.length > 1
      ? (Math.max(...kept) - Math.min(...kept)) / medianIntervalMs
      : Infinity;

  return {
    taps: taps.length,
    usedIntervals: kept.length,
    medianIntervalMs: Math.round(medianIntervalMs),
    hz: Math.round((1000 / medianIntervalMs) * 100) / 100,
    unreliable: kept.length < MIN_INTERVALS || spread > 0.8,
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
