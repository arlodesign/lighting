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

| Command                      | What it does                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm start`                  | Build the display and run the show                                                                               |
| `npm run dev`                | Same, with live reload for development (open http://localhost:5173)                                              |
| `npm run dmx-test`           | Light one fixture red/green/blue for 10 s, no MiniLab needed                                                     |
| `npm run dmx-test -- --walk` | Light each light in turn: check they're in the right left-to-right order                                         |
| `npm run strobe-sweep`       | Measure the strobe channel: tap along on the MiniLab with each flash speed; saves a JSON report (fast flashing!) |
| `npm run preview`            | Draw the lights in the terminal (no hardware)                                                                    |
| `npm run probe`              | Guided hardware check that writes a report to `probe-reports/`                                                   |
| `npm test`                   | Run the tests                                                                                                    |

DMX goes out one of three ways, chosen with `--dmx` (for example `npm start -- --dmx qlc`):

- `usb` (default): straight to the Open DMX over USB.
- `qlc`: through QLC+, which must be running with web access on and the Open DMX added to
  universe 1. The backup if the direct route ever misbehaves.
- `fake`: no hardware, preview only.

## Controls

| Control     | Does                                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keys        | White keys pick a look, calmest on the left to most frantic on the right. Hit harder for a brighter look.                                                |
| Pads 1–8    | Strobe (press harder = faster, 2–6 flashes/s), white flash, blackout, color bump, left flash, right flash, lightning, tap tempo                          |
| Knobs       | Speed, hue, color, palette, width, fade, shape, variety (mono → analogous → triadic → complementary)                                                     |
| Faders      | Master · Energy (verse ↔ chorus, see below) · Balance (left ↔ right) · Audio (pulse with the band, and let the room nudge Energy)                        |
| Pitch strip | Slide a spotlight across the lights                                                                                                                      |
| Mod strip   | Swell the brightness                                                                                                                                     |
| Big knob    | Scroll the setlist; click to load the song. The MiniLab's screen shows "Now 3/20" and the song, or "Next" while scrolling (`--no-screen` turns this off) |
| Laptop keys | Space = tap tempo, Esc = blackout, `S` strobe, `F` flash, `L` lightning, `1`–`9` looks, ↑/↓ and Enter for the setlist                                    |

## The setlist and saving presets on site

The setlist lives in `src/setlist.json`: song order, tempo, and each song's starting look, palette,
dials and swell. The lights' DMX addresses live in `src/config.ts`.

At the venue you can tune a song and keep it:

1. Load the song (turn the big knob, click it).
2. Set the look, palette, dials and swell the way you want, and tap the tempo.
3. Press **⌘S** on the laptop (or click **Save to song**). That song now starts this way. (It saves
   the Energy version you're in; see below.)

Saved presets live on the show laptop in `state/presets.json`, on top of the defaults in
`src/setlist.json`. **Reset song** forgets a song's saved preset. **Export setlist** downloads a
`setlist.json` with everything saved merged in: drop it into `src/` to make it the new default
in the repo.

### Energy: each song has a verse and a chorus version

Fader 2 picks how hard the song hits. The bottom is **Low** (verse), the middle **Mid** (the song as
set), the top **High** (chorus), and it blends in between. Low and High are worked out from Mid
(Low: dimmer, half speed, one color, narrower. High: brighter, double speed, more colors, wider),
so every song has them without any setup.

The keys and knobs change whichever version the fader is in, and ⌘S saves that version. To give a
chorus its own look: push Energy to the top, pick the look, press ⌘S. In `setlist.json` the
changes show up as `"low": { … }` and `"high": { … }` and list only what's different.

With the Audio fader up, the room helps: when the band gets louder than it's been for the last
minute, Energy rises a little on its own (the fader readout says "auto").

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
