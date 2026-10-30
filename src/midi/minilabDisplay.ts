import { Output } from "@julusian/midi";
import { setTimeout as sleep } from "node:timers/promises";
import {
  ENTER_DAW_MODE,
  EXIT_DAW_MODE,
  screenMessage,
} from "./minilabScreen.ts";

const POLL_MS = 2000;

/**
 * The MiniLab's screen, as seen from the show: finds the MiniLab's MIDI output, switches it
 * into "DAW connected" mode (the only mode that shows our text), and keeps the latest two
 * lines on it. Survives unplugging: the text goes back up as soon as the MiniLab returns.
 * Never throws; if anything fails, the show just carries on without the screen.
 */
export class MiniLabDisplay {
  readonly #match: RegExp;
  #output: Output | undefined;
  #port: string | null = null;
  #wanted: [string, string] = ["", ""];
  #shown: string | null = null;
  #timer: NodeJS.Timeout | undefined;

  constructor(opts: { match?: RegExp } = {}) {
    // Same port as the controls (see MidiInput).
    this.#match = opts.match ?? /minilab.*midi(?!.*(din|mcu|hui|alv))/i;
  }

  start(): void {
    this.#poll();
    this.#timer = setInterval(() => this.#poll(), POLL_MS);
  }

  /** Put the MiniLab back in its normal mode and let go of it. */
  async stop(): Promise<void> {
    clearInterval(this.#timer);
    if (this.#send(EXIT_DAW_MODE)) await sleep(200); // let it go out before closing
    this.#close();
  }

  /** Show two lines (10 and 18 characters fit). Cheap to call every frame. */
  show(line1: string, line2: string): void {
    this.#wanted = [line1, line2];
    this.#flush();
  }

  #flush(): void {
    const key = this.#wanted.join("\n");
    if (!this.#output || key === this.#shown) return;
    if (this.#send(screenMessage(...this.#wanted))) this.#shown = key;
  }

  #send(bytes: readonly number[]): boolean {
    try {
      this.#output?.sendMessage([...bytes]);
      return this.#output !== undefined;
    } catch {
      return false;
    }
  }

  #poll(): void {
    let names: string[];
    try {
      names = Output.getPortNames();
    } catch {
      return;
    }
    if (this.#port && !names.includes(this.#port)) this.#close();
    if (this.#port) return;

    const name =
      names.find((n) => this.#match.test(n)) ??
      names.find((n) => /minilab/i.test(n));
    if (!name) return;
    try {
      const output = new Output();
      output.openPortByName(name);
      this.#output = output;
      this.#port = name;
      this.#shown = null; // a fresh connection has a blank screen
      this.#send(ENTER_DAW_MODE);
      this.#flush();
      console.log(`[midi] screen on ${name}`);
    } catch (err) {
      console.log(
        `[midi] couldn't open ${name} for the screen: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  #close(): void {
    try {
      this.#output?.closePort();
      this.#output?.destroy();
    } catch {
      // already gone
    }
    this.#output = undefined;
    this.#port = null;
  }
}
