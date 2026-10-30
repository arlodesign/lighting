import {
  FADER_IDS,
  HIT_IDS,
  KNOB_IDS,
  type Action,
} from "../engine/actions.ts";
import type { ClientMessage } from "./protocol.ts";

const isNum = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const inRange = (x: unknown, min: number, max: number): x is number =>
  isNum(x) && x >= min && x <= max;
const oneOf = <T extends string>(list: readonly T[], x: unknown): x is T =>
  typeof x === "string" && (list as readonly string[]).includes(x);

/**
 * Parse and check a message from a WebSocket client. Anything malformed returns undefined
 * and is dropped — a buggy or hostile client can't push NaN or unknown ids into the engine.
 */
export function parseClientMessage(raw: string): ClientMessage | undefined {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!msg || typeof msg !== "object") return undefined;
  const m = msg as Record<string, unknown>;

  if (m.type === "audio") {
    if (!inRange(m.level, 0, 1) || !inRange(m.bass, 0, 1)) return undefined;
    return {
      type: "audio",
      level: m.level,
      bass: m.bass,
      kick: m.kick === true,
    };
  }
  if (m.type === "preset-save" || m.type === "preset-reset") {
    return { type: m.type };
  }
  if (m.type === "action") {
    const action = parseAction(m.action);
    return action && { type: "action", action };
  }
  return undefined;
}

function parseAction(a: unknown): Action | undefined {
  if (!a || typeof a !== "object") return undefined;
  const x = a as Record<string, unknown>;
  switch (x.type) {
    case "look":
      if (!inRange(x.index, 0, 1000)) return undefined;
      if (x.velocity !== undefined && !inRange(x.velocity, 0, 1))
        return undefined;
      return {
        type: "look",
        index: Math.round(x.index),
        ...(x.velocity !== undefined && { velocity: x.velocity }),
      };
    case "hit":
      if (!oneOf(HIT_IDS, x.hit) || typeof x.down !== "boolean")
        return undefined;
      if (x.pressure !== undefined && !inRange(x.pressure, 0, 1))
        return undefined;
      return {
        type: "hit",
        hit: x.hit,
        down: x.down,
        ...(x.pressure !== undefined && { pressure: x.pressure }),
      };
    case "knob":
      return oneOf(KNOB_IDS, x.knob) && inRange(x.delta, -128, 128)
        ? { type: "knob", knob: x.knob, delta: x.delta }
        : undefined;
    case "fader":
      return oneOf(FADER_IDS, x.fader) && inRange(x.value, 0, 1)
        ? { type: "fader", fader: x.fader, value: x.value }
        : undefined;
    case "spotlight":
      return x.value === null || inRange(x.value, 0, 1)
        ? { type: "spotlight", value: x.value }
        : undefined;
    case "swell":
      return inRange(x.value, 0, 1)
        ? { type: "swell", value: x.value }
        : undefined;
    case "tap":
    case "setlist-load":
      return { type: x.type };
    case "setlist-move":
      return inRange(x.delta, -100, 100)
        ? { type: "setlist-move", delta: Math.round(x.delta) }
        : undefined;
    default:
      return undefined;
  }
}

/**
 * Only pages served by this app (or the Vite dev server) may open the socket. Browsers
 * always send Origin on WebSocket upgrades, so this blocks any other website open in the
 * laptop's browser from quietly driving the lights.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  allowed: readonly string[],
): boolean {
  return origin !== undefined && allowed.includes(origin);
}
