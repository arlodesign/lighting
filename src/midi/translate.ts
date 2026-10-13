import type { Action } from "../engine/actions.ts";
import { decodeMidi } from "./decode.ts";
import type { KnobEncoding, MidiMapping } from "./mapping.ts";

const PITCH_CENTER = 8192;

/**
 * Convert a knob's CC value into a signed tick count.
 *
 * Even in "absolute" mode we turn positions into deltas (value − previous value), so the
 * engine always thinks in relative turns. That means a preset can change BPM or palette and
 * the knob just nudges from there — it can never snap a value back to where it sits.
 * The catch: an absolute knob stops sending at 0 or 127, which is why we want the
 * relative User program.
 */
export function knobDelta(
  value: number,
  encoding: KnobEncoding,
  previous: number | undefined,
): number {
  switch (encoding) {
    case "relative-binary-offset":
      return value - 64;
    case "relative-twos-comp":
      return value >= 64 ? value - 128 : value;
    case "relative-signed-bit":
      return value & 64 ? -(value & 63) : value & 63;
    case "absolute":
      return previous === undefined ? 0 : value - previous;
  }
}

/** Stateful translator: one per MIDI input. Remembers absolute knob positions between messages. */
export class MidiTranslator {
  readonly mapping: MidiMapping;
  #lastCc = new Map<number, number>();

  constructor(mapping: MidiMapping) {
    this.mapping = mapping;
  }

  translate(bytes: readonly number[]): Action[] {
    const m = this.mapping;
    const msg = decodeMidi(bytes);
    const onChannel = (ch: number | undefined) =>
      ch === undefined || ch === msg.channel;

    switch (msg.kind) {
      case "noteOn":
      case "noteOff": {
        const down = msg.kind === "noteOn";
        const note = msg.data1 ?? 0;
        const velocity = (msg.value ?? 0) / 127;
        const pad = m.pads.notes.indexOf(note);
        if (pad >= 0 && msg.channel === m.pads.channel) {
          const role = m.pads.roles[pad]!;
          if (role === "tap") return down ? [{ type: "tap" }] : [];
          return [
            {
              type: "hit",
              hit: role,
              down,
              ...(down && { pressure: velocity }),
            },
          ];
        }
        if (down && onChannel(m.keys.channel)) {
          return [{ type: "look", index: note - m.keys.baseNote, velocity }];
        }
        return [];
      }

      case "polyAftertouch": {
        // Squeezing a pad harder (e.g. strobe rate).
        const pad = m.pads.notes.indexOf(msg.data1 ?? -1);
        const role = m.pads.roles[pad];
        if (
          pad < 0 ||
          msg.channel !== m.pads.channel ||
          !role ||
          role === "tap"
        )
          return [];
        return [
          {
            type: "hit",
            hit: role,
            down: true,
            pressure: (msg.value ?? 0) / 127,
          },
        ];
      }

      case "cc": {
        const cc = msg.data1 ?? -1;
        const value = msg.value ?? 0;
        const previous = this.#lastCc.get(cc);
        this.#lastCc.set(cc, value);

        const knob = m.knobs.ccs.indexOf(cc);
        if (knob >= 0 && onChannel(m.knobs.channel)) {
          const delta = knobDelta(value, m.knobs.encoding, previous);
          return delta === 0
            ? []
            : [{ type: "knob", knob: m.knobs.roles[knob]!, delta }];
        }
        const fader = m.faders.ccs.indexOf(cc);
        if (fader >= 0 && onChannel(m.faders.channel)) {
          return [
            {
              type: "fader",
              fader: m.faders.roles[fader]!,
              value: value / 127,
            },
          ];
        }
        if (cc === m.strips.modCc && onChannel(m.strips.channel)) {
          return [{ type: "swell", value: value / 127 }];
        }
        if (cc === m.mainEncoder.turnCc) {
          const delta = knobDelta(value, m.mainEncoder.encoding, previous);
          return delta === 0
            ? []
            : [{ type: "setlist-move", delta: Math.sign(delta) }];
        }
        if (cc === m.mainEncoder.clickCc && value > 0)
          return [{ type: "setlist-load" }];
        return [];
      }

      case "pitchBend": {
        if (!onChannel(m.strips.channel)) return [];
        // The strip springs back to dead centre when released; treat that as "let go".
        const v = msg.value ?? PITCH_CENTER;
        return [
          { type: "spotlight", value: v === PITCH_CENTER ? null : v / 16383 },
        ];
      }

      default:
        return [];
    }
  }
}
