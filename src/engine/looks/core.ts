import { hsv, scale } from "../color.ts";
import { blendAt, hash, noise, pick, pulse, type Look } from "../look.ts";

const frac = (x: number) => x - Math.floor(x);
/** Triangle wave 0 → 1 → 0 over one unit of x. */
const tri = (x: number) => 1 - Math.abs(frac(x) * 2 - 1);

/** Solid palette colours drifting slowly; width spreads the palette across the stage. */
export const wash: Look = {
  id: "wash",
  name: "Wash",
  render({ beats, colors, pos, width }, out) {
    for (let i = 0; i < out.length; i++) {
      out[i] = blendAt(colors, beats / 32 + pos[i]! * width * 0.6);
    }
  },
};

/** Everything swells on each beat; colour drifts per bar. */
export const breathe: Look = {
  id: "breathe",
  name: "Breathe",
  render({ beats, colors }, out) {
    const level = 0.25 + 0.75 * pulse(frac(beats), 2.5);
    const c = scale(blendAt(colors, beats / 16), level);
    for (let i = 0; i < out.length; i++) out[i] = c;
  },
};

/** One light runs along the geometry, one step per beat. Width = tail length. */
export const chase: Look = {
  id: "chase",
  name: "Chase",
  render({ beats, colors, pos, steps, width }, out) {
    const head = Math.floor(beats) % steps;
    const tail = Math.round(width * 3);
    const color = pick(colors, Math.floor(beats / steps));
    const kick = 0.65 + 0.35 * pulse(frac(beats), 4);
    for (let i = 0; i < out.length; i++) {
      const k = Math.round(pos[i]! * (steps - 1));
      const behind = (((head - k) % steps) + steps) % steps;
      const level =
        behind === 0
          ? kick
          : behind <= tail
            ? 0.5 * (1 - behind / (tail + 1))
            : 0;
      out[i] = scale(color, level);
    }
  },
};

/** A pulse travels from position 0 to 1 each beat (centre-out in mirror geometry). */
export const ripple: Look = {
  id: "ripple",
  name: "Ripple",
  render({ beats, colors, pos, width }, out) {
    const front = frac(beats) * 1.4 - 0.2;
    const w = 0.08 + 0.3 * width;
    const color = pick(colors, Math.floor(beats));
    const floor = scale(pick(colors, Math.floor(beats) + 1), 0.06);
    for (let i = 0; i < out.length; i++) {
      const d = (pos[i]! - front) / w;
      const level = Math.exp(-d * d);
      out[i] = {
        r: Math.max(floor.r, color.r * level),
        g: Math.max(floor.g, color.g * level),
        b: Math.max(floor.b, color.b * level),
      };
    }
  },
};

/** Left and right sides trade hits on alternate beats. */
export const pingPong: Look = {
  id: "ping-pong",
  name: "Ping-Pong",
  render({ beats, colors, side }, out) {
    const active = Math.floor(beats) % 2 === 0 ? "L" : "R";
    const hit = 0.25 + 0.75 * pulse(frac(beats), 3);
    for (let i = 0; i < out.length; i++) {
      const color = pick(colors, side[i] === "L" ? 0 : 1);
      out[i] = scale(color, side[i] === active ? hit : 0.05);
    }
  },
};

/** Random lights twinkle over a dim bed. Width = how many twinkle at once. */
export const sparkle: Look = {
  id: "sparkle",
  name: "Sparkle",
  render({ beats, colors, width }, out) {
    const rate = 4; // twinkle slots per beat
    const slot = Math.floor(beats * rate);
    const decay = pulse(frac(beats * rate), 3);
    const density = 0.12 + 0.5 * width;
    for (let i = 0; i < out.length; i++) {
      const on = hash(slot, i) < density;
      const color = pick(
        colors,
        Math.floor(hash(slot, i + 99) * colors.length),
      );
      out[i] = on
        ? scale(color, 0.35 + 0.65 * decay)
        : scale(pick(colors, 0), 0.07);
    }
  },
};

/** A full hue rainbow scrolling across the lights. Width = how much of the rainbow is visible. */
export const rainbowRoll: Look = {
  id: "rainbow",
  name: "Rainbow Roll",
  render({ beats, pos, width }, out) {
    for (let i = 0; i < out.length; i++) {
      out[i] = hsv(beats / 16 + pos[i]! * (0.25 + 0.75 * width), 1, 1);
    }
  },
};

/** Left = palette colour A, right = colour B; they swap every bar with a downbeat hit. */
export const split: Look = {
  id: "split",
  name: "Split",
  render({ beats, colors, side }, out) {
    const swapped = Math.floor(beats / 4) % 2 === 1;
    const level = 0.6 + 0.4 * pulse(frac(beats / 4), 5);
    for (let i = 0; i < out.length; i++) {
      const isA = (side[i] === "L") !== swapped;
      out[i] = scale(pick(colors, isA ? 0 : 1), level);
    }
  },
};

function heartbeatLevel(phase: number): number {
  const first = pulse(phase, 10);
  const second = phase >= 0.22 ? 0.7 * pulse(phase - 0.22, 10) : 0;
  return Math.max(first, second);
}

/** Thump-thump on every beat. */
export const heartbeat: Look = {
  id: "heartbeat",
  name: "Heartbeat",
  render({ beats, colors }, out) {
    const c = scale(pick(colors, 0), 0.06 + 0.94 * heartbeatLevel(frac(beats)));
    for (let i = 0; i < out.length; i++) out[i] = c;
  },
};

/**
 * Every light flickers on its own, like flames. The flicker follows the tempo (and the speed
 * knob): a slow song or a low speed is a gentle candle; a fast one is a roaring fire.
 */
export const fire: Look = {
  id: "fire",
  name: "Fire",
  render({ beats, colors }, out) {
    for (let i = 0; i < out.length; i++) {
      // At 120 BPM and 1×, this matches the old free-running flicker.
      const slow = noise(beats * 2.5 + i * 3.7, i);
      const fast = noise(beats * 7 + i * 1.3, i + 50);
      out[i] = scale(
        blendAt(colors, slow * 0.6),
        0.3 + 0.7 * slow * (0.6 + 0.4 * fast),
      );
    }
  },
};

/** Lights fill up one by one over a bar, then drain over the next. */
export const sweepFill: Look = {
  id: "sweep-fill",
  name: "Sweep Fill",
  render({ beats, colors, pos }, out) {
    const fill = tri(beats / 8) * 1.15; // a touch over 1 so the last light gets full
    const color = pick(colors, Math.floor(beats / 8));
    for (let i = 0; i < out.length; i++) {
      const edge = Math.min(1, Math.max(0, (fill - pos[i]!) * 6));
      out[i] = scale(color, edge);
    }
  },
};

export const CORE_LOOKS: readonly Look[] = [
  wash,
  breathe,
  chase,
  ripple,
  pingPong,
  sparkle,
  rainbowRoll,
  split,
  heartbeat,
  fire,
  sweepFill,
];

// Exported for the spooky looks to build on.
export { heartbeatLevel, frac };
