import { describe, expect, it } from "vitest";
import {
  ENTER_DAW_MODE,
  EXIT_DAW_MODE,
  LINE1_MAX,
  LINE2_MAX,
  screenMessage,
  songScreen,
  toScreenText,
} from "./minilabScreen.ts";

const ascii = (bytes: number[]) => String.fromCharCode(...bytes);

describe("MiniLab screen messages", () => {
  it("are well-formed SysEx: F0 … F7, all inner bytes 7-bit", () => {
    for (const msg of [
      ENTER_DAW_MODE,
      EXIT_DAW_MODE,
      screenMessage("3/20", "Immigrant Song"),
    ]) {
      expect(msg[0]).toBe(0xf0);
      expect(msg.at(-1)).toBe(0xf7);
      for (const b of msg.slice(1, -1)) expect(b).toBeLessThan(0x80);
    }
  });

  it("start with the Arturia header", () => {
    expect(screenMessage("a", "b").slice(0, 6)).toEqual([
      0xf0, 0x00, 0x20, 0x6b, 0x7f, 0x42,
    ]);
  });

  it("carry both lines, each introduced by its line number", () => {
    const msg = screenMessage("12/20", "Haunt Me");
    const text = ascii(msg.slice(6));
    expect(text).toContain("\x00\x0112/20\x00\x02Haunt Me\x00");
  });

  it("clamp to what the screen can show and keep it ASCII", () => {
    expect(toScreenText("x".repeat(40), LINE2_MAX)).toHaveLength(LINE2_MAX);
    expect(toScreenText("y".repeat(40), LINE1_MAX)).toHaveLength(LINE1_MAX);
    expect(ascii(toScreenText("Café ★", 18))).toBe("Caf? ?");
    expect(songScreen(2, 20, "Pretend We're Dead").length).toBeGreaterThan(20);
  });
});
