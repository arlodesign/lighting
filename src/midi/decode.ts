export type MidiKind =
  | "noteOn"
  | "noteOff"
  | "polyAftertouch"
  | "cc"
  | "programChange"
  | "channelAftertouch"
  | "pitchBend"
  | "sysex"
  | "other";

export interface DecodedMidi {
  kind: MidiKind;
  /** 1-16, as printed on gear. 0 for system messages. */
  channel: number;
  /** Note number, CC number, or program number. */
  data1?: number;
  /** Velocity, CC value, or pressure. Pitch bend: 14-bit value 0–16383 (8192 = center). */
  value?: number;
}

export function decodeMidi(bytes: readonly number[]): DecodedMidi {
  const status = bytes[0] ?? 0;
  if (status === 0xf0) return { kind: "sysex", channel: 0 };
  if (status >= 0xf0) return { kind: "other", channel: 0 };

  const channel = (status & 0x0f) + 1;
  const d1 = bytes[1] ?? 0;
  const d2 = bytes[2] ?? 0;
  switch (status & 0xf0) {
    case 0x80:
      return { kind: "noteOff", channel, data1: d1, value: d2 };
    case 0x90:
      // Many devices send "note on, velocity 0" instead of note off.
      return {
        kind: d2 === 0 ? "noteOff" : "noteOn",
        channel,
        data1: d1,
        value: d2,
      };
    case 0xa0:
      return { kind: "polyAftertouch", channel, data1: d1, value: d2 };
    case 0xb0:
      return { kind: "cc", channel, data1: d1, value: d2 };
    case 0xc0:
      return { kind: "programChange", channel, data1: d1 };
    case 0xd0:
      return { kind: "channelAftertouch", channel, value: d1 };
    case 0xe0:
      return { kind: "pitchBend", channel, value: d1 | (d2 << 7) };
    default:
      return { kind: "other", channel };
  }
}
