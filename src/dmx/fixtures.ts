import type { RigConfig } from "../config.ts";
import type { Frame } from "../engine/engine.ts";
import { LIGHT_IDS } from "../engine/rig.ts";

const to255 = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255);

/**
 * Turn an engine frame into DMX channel values.
 *
 * Brightness goes on the fixture's master dimmer and *colour* on R/G/B at full chroma.
 * Splitting it this way gives far smoother fades at low levels than dimming R/G/B alone:
 * a dim purple as R=8,G=0,B=12 has only a handful of possible shades, but as
 * master=12 + R=170,B=255 the colour stays exact while the dimmer does the fading.
 */
export function writeFrame(
  frame: Frame,
  rig: RigConfig,
  universe: Uint8Array,
): void {
  const { offsets, neutral, strobeRange } = rig.profile;
  const strobeValue =
    frame.strobe > 0
      ? Math.round(
          strobeRange.slow +
            (strobeRange.fast - strobeRange.slow) * Math.min(1, frame.strobe),
        )
      : neutral.strobe;

  LIGHT_IDS.forEach((id, i) => {
    const color = frame.lights[i] ?? { r: 0, g: 0, b: 0 };
    const base = rig.addresses[id] - 1; // DMX addresses are 1-based
    const peak = Math.max(color.r, color.g, color.b);
    const chroma = peak > 0 ? 1 / peak : 0;

    universe[base + offsets.master] = to255(peak);
    universe[base + offsets.r] = to255(color.r * chroma);
    universe[base + offsets.g] = to255(color.g * chroma);
    universe[base + offsets.b] = to255(color.b * chroma);
    universe[base + offsets.rgb] = neutral.rgb;
    universe[base + offsets.strobe] = strobeValue;
    universe[base + offsets.mode] = neutral.mode;
  });
}
