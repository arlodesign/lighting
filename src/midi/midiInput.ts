import { Input } from "@julusian/midi";
import type { Action } from "../engine/actions.ts";
import type { MidiMapping } from "./mapping.ts";
import { MidiTranslator } from "./translate.ts";

const POLL_MS = 2000;

/**
 * Keeps a connection to the MiniLab: opens it when it appears, notices when it vanishes
 * (unplugged, hub lost power), and reopens it when it comes back. Never throws.
 */
export class MidiInput {
  readonly #match: RegExp;
  readonly #mapping: MidiMapping;
  readonly #onAction: (action: Action) => void;
  #input: Input | undefined;
  #port: string | null = null;
  #lastMessageAt: number | null = null;
  #timer: NodeJS.Timeout | undefined;

  constructor(opts: {
    match?: RegExp;
    mapping: MidiMapping;
    onAction: (action: Action) => void;
  }) {
    // The MiniLab exposes several ports; the one named plainly "...MIDI" carries the controls.
    this.#match = opts.match ?? /minilab.*midi(?!.*(din|mcu|hui|alv))/i;
    this.#mapping = opts.mapping;
    this.#onAction = opts.onAction;
  }

  get status() {
    return {
      connected: this.#port !== null,
      port: this.#port,
      lastMessageAgoMs:
        this.#lastMessageAt === null
          ? null
          : Math.round(performance.now() - this.#lastMessageAt),
    };
  }

  start(): void {
    this.#poll();
    this.#timer = setInterval(() => this.#poll(), POLL_MS);
  }

  stop(): void {
    clearInterval(this.#timer);
    this.#close();
  }

  #poll(): void {
    let names: string[];
    try {
      names = Input.getPortNames();
    } catch {
      return;
    }
    if (this.#port && !names.includes(this.#port)) {
      console.log(`[midi] ${this.#port} disconnected`);
      this.#close();
    }
    if (this.#port) return;

    const name =
      names.find((n) => this.#match.test(n)) ??
      names.find((n) => /minilab/i.test(n));
    if (!name) return;
    try {
      const translator = new MidiTranslator(this.#mapping);
      const input = new Input();
      input.ignoreTypes(true, true, true);
      input.on("message", (_dt, bytes) => {
        this.#lastMessageAt = performance.now();
        for (const action of translator.translate(bytes))
          this.#onAction(action);
      });
      input.openPortByName(name);
      this.#input = input;
      this.#port = name;
      console.log(`[midi] listening on ${name}`);
    } catch (err) {
      console.log(
        `[midi] couldn't open ${name}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  #close(): void {
    try {
      this.#input?.closePort();
      this.#input?.destroy();
    } catch {
      // already gone
    }
    this.#input = undefined;
    this.#port = null;
  }
}
