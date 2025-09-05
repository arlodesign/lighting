import type { KeyMap } from "./types";

// Configurable keymap; change here to adapt controls.
export const DEFAULT_KEYMAP: KeyMap = [
  { action: "LOOK_1", keys: ["1"] },
  { action: "LOOK_2", keys: ["2"] },
  { action: "LOOK_3", keys: ["3"] },
  { action: "LOOK_4", keys: ["4"] },
  { action: "NEXT_SCENE", keys: ["ArrowUp"] },
  { action: "PREV_SCENE", keys: ["ArrowDown"] },
  { action: "BLACKOUT_TOGGLE", keys: ["b", "B"] },
  { action: "TAP_TEMPO", keys: ["t", "T"] },
  { action: "TEMPO_HALF", keys: ["Alt+t", "Alt+T"] },
  { action: "TEMPO_DOUBLE", keys: ["Shift+t", "Shift+T"] },
  { action: "TEMPO_RESET", keys: ["r", "R"] },
  { action: "HELP_TOGGLE", keys: ["h", "H", "?"] },
];

