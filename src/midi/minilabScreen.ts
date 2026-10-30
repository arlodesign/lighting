/**
 * Writing text to the MiniLab 3's small screen (next to the song knob).
 *
 * Confirmed on the show MiniLab (2026-10-29, `npm run minilab-screen`). Arturia hasn't published
 * this; the byte layouts come from the MiniLab 3 remote script that ships with Ableton Live
 * and a reverse-engineering thread on Arturia's forum. The screen takes text while the
 * MiniLab is in its "DAW connected" mode, and the text is tiny: 10 characters on the first
 * line, 18 on the second.
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

/** Back to its normal standalone behavior. */
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

/**
 * Plain printable ASCII only (the screen's font). Curly quotes, dashes and accents are
 * swapped for their plain versions (song titles from Apple Music are full of them);
 * anything else becomes "?".
 */
export function toScreenText(text: string, max: number): number[] {
  const plain = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // accents
  return [...plain].slice(0, max).map((ch) => {
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

/** How long "Next …" stays up after the song knob stops turning. */
export const SCROLL_HOLD_MS = 3000;

interface SetlistStatus {
  cursor: number;
  loaded: number | null;
  length: number;
  current: { name: string } | null;
  next: { name: string } | null;
}

/**
 * What the screen says during the show: the song that's playing ("Now 3/20"), or, while the
 * song knob is being turned, the song a click would load ("Next 4/20"). Goes back to "Now"
 * a few seconds after the knob stops.
 */
export class SetlistScreen {
  #cursor: number | null = null;
  #loaded: number | null = null;
  #scrolledAt = -Infinity;

  text(s: SetlistStatus, now: number): [string, string] {
    // Loading a song also moves the cursor on to the next one: that's not scrolling.
    if (s.loaded !== this.#loaded) this.#scrolledAt = -Infinity;
    else if (this.#cursor !== null && s.cursor !== this.#cursor)
      this.#scrolledAt = now;
    this.#cursor = s.cursor;
    this.#loaded = s.loaded;

    if (s.length === 0) return ["Lights", "No setlist"];
    const scrolling = now - this.#scrolledAt < SCROLL_HOLD_MS;
    if (s.current && s.loaded !== null && !scrolling)
      return [`Now ${s.loaded + 1}/${s.length}`, s.current.name];
    return [`Next ${s.cursor + 1}/${s.length}`, s.next?.name ?? ""];
  }
}
