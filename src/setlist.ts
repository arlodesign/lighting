/**
 * The night's setlist. Every field except `name` is optional: a song preset only changes
 * what it mentions, and the operator improvises from there.
 *
 *   palette: an id from src/engine/palettes.ts   (e.g. "blood", "toxic", "pumpkin")
 *   look:    an id from src/engine/looks/*.ts     (e.g. "chase", "lightning", "candle")
 */
export interface Song {
  name: string;
  bpm?: number;
  palette?: string;
  look?: string;
  /** Shown on the HUD under the song name: cues, reminders. */
  notes?: string;
}

/**
 * 10/30 Halloween set, in order (from the Apple Music export). Tempos aren't in the export, so
 * no song sets one: the beat clock keeps whatever tempo it has until the operator taps it in.
 * To set one, add `bpm: 120` (or whatever) to a song. Palette and look are starting points
 * chosen by mood; change any of them. `notes` shows under the song name on the display.
 */
export const SETLIST: readonly Song[] = [
  {
    name: "Devil Inside",
    palette: "blood",
    look: "heartbeat",
    notes: "INXS · 5:13",
  },
  {
    name: "Halloween",
    palette: "pumpkin",
    look: "chase",
    notes: "The Misfits · 1:52",
  },
  {
    name: "Pretend We're Dead",
    palette: "toxic",
    look: "ping-pong",
    notes: "L7 · 3:55",
  },
  {
    name: "Human Fly",
    palette: "bruise",
    look: "dying-bulb",
    notes: "The Cramps · 2:13",
  },
  {
    name: "Immigrant Song",
    palette: "ice",
    look: "lightning",
    notes: "Led Zeppelin · 2:26",
  },
  {
    name: "Dead Disco",
    palette: "neon",
    look: "rainbow",
    notes: "Metric · 3:25",
  },
  {
    name: "Possum Kingdom",
    palette: "vampire",
    look: "creep",
    notes: "Toadies · 5:08",
  },
  {
    name: "Black Magic Woman",
    palette: "purple-rain",
    look: "breathe",
    notes: "Fleetwood Mac · 2:52",
  },
  {
    name: "Dracula From Houston",
    palette: "witching",
    look: "possession",
    notes: "Butthole Surfers · 3:42",
  },
  {
    name: "Satanist",
    palette: "blood",
    look: "slow-heartbeat",
    notes: "boygenius · 4:50",
  },
  {
    name: "Psycho",
    palette: "fire",
    look: "audio-bars",
    notes: "Muse · 5:16",
  },
  {
    name: "I Might Need You to Kill",
    palette: "pumpkin",
    look: "sparkle",
    notes: "The Thermals · 2:27",
  },
  {
    name: "Haunt Me",
    palette: "candle",
    look: "candle",
    notes: "Twin Temple · 3:13",
  },
  {
    name: "I Bleed",
    palette: "blood",
    look: "ripple",
    notes: "Pixies · 2:34",
  },
  {
    name: "Maneater",
    palette: "pumpkin",
    look: "chase",
    notes: "The Koffin Kats · 3:28",
  },
  {
    name: "Only Shallow",
    palette: "ghost",
    look: "wash",
    notes: "my bloody valentine · 3:41",
  },
  {
    name: "New Rose",
    palette: "sunset",
    look: "split",
    notes: "The Damned · 2:44",
  },
  {
    name: "Twilight Zone",
    palette: "witching",
    look: "creep",
    notes: "Golden Earring · 7:58",
  },
  {
    name: "Hungry Like the Wolf",
    palette: "sunset",
    look: "ripple",
    notes: "Duran Duran · 3:40",
  },
  {
    name: "Wolf Like Me",
    palette: "toxic",
    look: "chase",
    notes: "TV on the Radio · 4:37",
  },
];
