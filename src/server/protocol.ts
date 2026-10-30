/**
 * Messages between the Node server and the browser HUD (over one WebSocket at /ws).
 * Shared by both sides so the shapes can't drift apart.
 */
import type { Action } from "../engine/actions.ts";
import type { Engine } from "../engine/engine.ts";
import type { Song } from "../songs.ts";

export type EngineStatus = ReturnType<Engine["status"]>;

export interface DeviceStatus {
  dmx: {
    backend: "qlc" | "usb" | "serial" | "fake";
    connected: boolean;
    port: string | null;
    fake: boolean;
    fps: number;
    lateFrames: number;
    errors: number;
    lastError?: string;
  };
  midi: {
    connected: boolean;
    port: string | null;
    lastMessageAgoMs: number | null;
  };
}

export type ServerMessage =
  /** Sent once on connect: the static stuff the HUD needs to draw labels. */
  | {
      type: "hello";
      looks: { id: string; name: string; spooky: boolean }[];
      palettes: {
        id: string;
        name: string;
        colors: [number, number, number][];
      }[];
      setlist: readonly Song[];
      lights: readonly string[];
    }
  /** ~30×/s: what the lights are doing and every control's value. */
  | {
      type: "state";
      /** One [r, g, b] (0–1) per light, after the grand master. */
      lights: [number, number, number][];
      strobe: number;
      status: EngineStatus;
      devices: DeviceStatus;
    }
  /** A one-off message for the operator, e.g. "Saved Devil Inside". */
  | { type: "notice"; text: string; tone: "ok" | "warn" };

export type ClientMessage =
  | { type: "action"; action: Action }
  /** Mic analysis from the HUD, raw 0–1 (the engine applies the sensitivity knob). */
  | { type: "audio"; level: number; bass: number; kick: boolean }
  /** Save the current settings as the loaded song's preset (⌘S). */
  | { type: "preset-save" }
  /** Forget the loaded song's saved preset and go back to the repo's default. */
  | { type: "preset-reset" };

/** Download the setlist with on-site saves merged in, in src/setlist.json's format. */
export const EXPORT_PATH = "/export/setlist.json";

export const WS_PATH = "/ws";
export const DEFAULT_PORT = 4000;
