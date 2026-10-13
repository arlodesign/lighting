/**
 * How a knob reports movement. The MiniLab 3's knobs are endless encoders, but by default
 * the firmware turns them into absolute 0–127 positions. In a User program (set up in
 * Arturia MIDI Control Center) they can instead send *relative* steps, in one of a few
 * competing conventions:
 *
 *   absolute               value is the position: 64, 65, 66, … (clamps at 0 and 127)
 *   relative-binary-offset 64 = no move; 65, 66 = +1, +2 right; 63, 62 = −1, −2 left
 *   relative-twos-comp     1, 2 = +1, +2 right; 127, 126 = −1, −2 left
 *   relative-signed-bit    1, 2 = +1, +2 right; 65, 66 = −1, −2 left (bit 6 = "negative")
 */
export type KnobEncoding =
  | "absolute"
  | "relative-binary-offset"
  | "relative-twos-comp"
  | "relative-signed-bit"
  | "unknown";

/**
 * Guess the encoding from the CC values a single knob sent while the user turned it
 * RIGHT for a while, then LEFT for a while (in that order, as the probe instructs).
 *
 * The raw values are saved in the report regardless, so a wrong guess here only affects
 * the printed summary — but a good guess means the app's knob config can be generated
 * straight from the report.
 */
export function classifyKnobEncoding(values: readonly number[]): KnobEncoding {
  if (values.length < 4) return "unknown";

  // TODO(arlo): decide which encoding produced `values`.
  //
  // Things worth knowing:
  // - Absolute values *change* smoothly (66, 67, 68 … 68, 67, 66): the first half trends up,
  //   the second half trends down, and consecutive values differ by small amounts.
  // - Relative values *repeat*: turning one way sends the same few values over and over
  //   (65, 65, 66, 65 …), clustered around 64 (binary offset), or around 0/127 (two's comp),
  //   or around 0/64 (signed bit).
  // - The MiniLab accelerates fast turns, so relative steps may be ±1…±4 or more.
  // - A knob already pinned at 127 sends 127 repeatedly when turned right in absolute mode —
  //   that looks a lot like two's-complement "−1". How would you tell them apart?
  return "unknown";
}
