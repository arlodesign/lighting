# Lights

Runs the lights for a small bar band: an Arturia MiniLab 3 and a laptop drive eight RGB LED
lights through an ENTTEC Open DMX USB. One operator plays the lights like an instrument: keys
pick looks, pads fire hits (strobe, flash, blackout, lightning), knobs and faders shape them,
and a laptop screen shows what's happening.

## Run it

You need Node 24 (https://nodejs.org, the LTS installer) and the lights plugged in: Open DMX
into the laptop (straight in, not through a hub if you can), a cable from its output to the
first light's **DMX IN**.

```bash
git clone https://github.com/arlodesign/lighting.git
cd lighting
git checkout v2
npm install
npm start
```

Then open http://localhost:4000. The two dots at the bottom say whether the MiniLab and the
lights are connected. **Quit QLC+ first** (and any other lighting app): only one program can use
the Open DMX at a time.

| Command                              | What it does                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `npm start`                          | Build the display and run the show                                                   |
| `npm run dev`                        | Same, with live reload for development (open http://localhost:5173)                  |
| `npm run dmx-test`                   | Light one fixture red/green/blue for 10 s, no MiniLab needed                         |
| `npm run dmx-test -- --walk`         | Light each light in turn: check they're in the right left-to-right order             |
| `npm run dmx-test -- --strobe-sweep` | Step the strobe channel slow → fast (fast flashing!) to measure what each value does |
| `npm run preview`                    | Draw the lights in the terminal (no hardware)                                        |
| `npm run probe`                      | Guided hardware check that writes a report to `probe-reports/`                       |
| `npm test`                           | Run the tests                                                                        |

DMX goes out one of three ways, chosen with `--dmx` (for example `npm start -- --dmx qlc`):

- `usb` (default): straight to the Open DMX over USB.
- `qlc`: through QLC+, which must be running with web access on and the Open DMX added to
  universe 1. The backup if the direct route ever misbehaves.
- `fake`: no hardware, preview only.

## Controls

| Control     | Does                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Keys        | Pick a look (lowest key = first look). Hit harder for a brighter look.                                                |
| Pads 1–8    | Strobe (press harder = faster), white flash, blackout, colour bump, left flash, right flash, tap tempo, lightning     |
| Knobs       | Speed, hue, colour, palette, width, fade, shape, mic sensitivity                                                      |
| Faders      | Master, left, right, audio reactivity                                                                                 |
| Pitch strip | Slide a spotlight across the lights                                                                                   |
| Mod strip   | Swell the brightness                                                                                                  |
| Big knob    | Scroll the setlist; click to load the song's tempo, palette and look                                                  |
| Laptop keys | Space = tap tempo, Esc = blackout, `S` strobe, `F` flash, `L` lightning, `1`–`9` looks, ↑/↓ and Enter for the setlist |

The setlist lives in `src/setlist.ts`. The lights' DMX addresses live in `src/config.ts`.

## When the lights don't respond

**Look at the display on the back of each light.** A blinking address (like `A001`) means the
light is **not receiving DMX**; it goes steady when DMX arrives. Then, in order:

1. Is QLC+ (or anything else using the Open DMX) closed? The display on the laptop says if the
   adapter can't be opened.
2. Is the cable in the first light's **DMX IN**, not OUT?
3. Try one light only, with a short cable, then another cable.
4. Plug the Open DMX straight into the laptop.
5. If the displays are steady but the lights stay dark, the address or mode is off: the app
   expects 7-channel mode and addresses 1, 11, 21 … 71 (`src/config.ts`).

More detail: `probe/README.md`.

## Repo notes

- `package-lock.json` must point at `registry.npmjs.org`. If you install on a machine that uses a
  private npm mirror, a test fails and tells you; rewrite the host in the lockfile and re-run.
- `legacy/p5-sketches/` holds the old projection sketches.
