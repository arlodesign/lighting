/**
 * Writing text to the MiniLab 3's small screen (above the big knob).
 *
 * UNVERIFIED on real hardware. Arturia hasn't published this; the byte layouts come from the
 * MiniLab 3 remote script that ships with Ableton Live and a reverse-engineering thread on
 * Arturia's forum. Per those, the screen only accepts text while the MiniLab is in its
 * "DAW connected" mode, and the text is tiny: ~10 characters on the first line, ~18 on the
 * second. Try it with `npm run minilab-screen` before relying on it.
 */

/** Every Arturia MiniLab 3 message starts with this: manufacturer 00 20 6B, device 7F 42. */
const HEADER = [0xf0, 0x00, 0x20, 0x6b, 0x7f, 0x42] as const;
const END = 0xf7;

/** Switch the MiniLab into "DAW connected" mode (the screen and pad lights take host input). */
export const ENTER_DAW_MODE: readonly number[] = [
  ...HEADER,
  0x02,
  0x00,
  0x40,
  0x6a,
  0x21,
  END,
];

/** Back to its normal standalone behaviour. */
export const EXIT_DAW_MODE: readonly number[] = [
  ...HEADER,
  0x02,
  0x00,
  0x40,
  0x6a,
  0x20,
  END,
];

export const LINE1_MAX = 10;
export const LINE2_MAX = 18;

/** Plain printable ASCII only (the screen's font); anything else becomes "?". */
export function toScreenText(text: string, max: number): number[] {
  return [...text].slice(0, max).map((ch) => {
    const code = ch.codePointAt(0) ?? 63;
    return code >= 0x20 && code <= 0x7e ? code : 0x3f;
  });
}

/**
 * The message that puts two lines of text on the screen. The three zero bytes after the
 * `1F 07 01` are icon slots (none).
 */
export function screenMessage(line1: string, line2: string): number[] {
  return [
    ...HEADER,
    0x04,
    0x02,
    0x60,
    0x1f,
    0x07,
    0x01,
    0x00, // icon 1: none
    0x00, // icon 2: none
    0x00, // icon 3: none
    0x00,
    0x01,
    ...toScreenText(line1, LINE1_MAX),
    0x00,
    0x02,
    ...toScreenText(line2, LINE2_MAX),
    0x00,
    END,
  ];
}

/** "3/20" on the first line, the song on the second, e.g. for setlist position. */
export function songScreen(
  index: number,
  total: number,
  name: string,
): number[] {
  return screenMessage(`${index + 1}/${total}`, name);
}
