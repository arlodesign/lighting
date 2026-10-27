# Hardware probe

A guided, ~20-minute tour of the show rig. It records exactly what the MiniLab 3 sends, how the
lights respond to DMX, and how the laptop mic hears a loud room. It writes the results to
`probe-reports/probe-<time>.json`. The real app's mappings and settings are built from that file.

Nothing here changes the lights' or controller's settings permanently.

## 1. One-time setup on the show MacBook Air

1. **Install Node 24 LTS** from https://nodejs.org (the macOS installer, "LTS").
   Check in Terminal: `node --version` → `v24.x`.
2. **Get the code:**

   ```bash
   git clone https://github.com/arlodesign/lighting.git
   cd lighting
   git checkout v2
   npm install
   ```

   `npm install` needs internet once. It downloads prebuilt MIDI and serial drivers for Intel
   Macs, so there's nothing to compile.

   **If `npm install` fails with a 403 or "not found" on a host that isn't `registry.npmjs.org`:**
   `package-lock.json` has picked up the registry of whichever machine last ran `npm install`
   (a corporate proxy or mirror, say). Every package URL in the lockfile should start with
   `https://registry.npmjs.org/`. Check with `grep -c 'registry.npmjs.org' package-lock.json`.
   Run `git pull` for the latest lockfile. If you still see another host, re-point it:

   ```bash
   sed -i '' 's#https://[^/"]*/npm/#https://registry.npmjs.org/#g' package-lock.json && npm install
   ```

   When you run `npm install` on a machine with a non-default registry, check `git diff
package-lock.json` before committing, so that machine's registry doesn't get committed.

3. **Plug in through the hub:** MiniLab 3, ENTTEC Open DMX USB → XLR → first light → daisy-chain.
   Lights powered, in **7-channel DMX mode**.
4. **Do NOT install** FTDI's "VCP" driver, and quit QLC+ or any other lighting app, which
   would grab the Open DMX.

## 2. MiniLab program (no setup needed)

The first probe run showed the MiniLab works fine in its **default Arturia program**: the app
reads that program, and also the "DAW" program, so there is nothing to configure in Arturia's
MIDI Control Center. (An earlier version of this README asked for a relative-knob User program.
That turned out to be unnecessary: the knobs are treated as endless in software.)

## 3. Run it

```bash
npm run probe
```

Sections run in order: **MIDI → DMX → mic**. You can run one or two at a time:
`npm run probe -- dmx` or `npm run probe -- midi mic`.

- At each step, do what it says, then press **Enter**. Type `s` to skip a step, `r` to redo it,
  or type a short note before Enter.
- The DMX section asks you to describe what the lights do. Short is fine ("fast strobe",
  "auto colour fade", "nothing").
- For the mic test, a browser page opens. Click start and allow the microphone. For the
  "loud" part, play music loudly through a speaker or clap near the laptop.
- Ctrl-C at any time still saves what's been recorded so far.

The light addressing step offers the **old setup (1, 11, 21 … 71)** first. Try that before
re-addressing anything.

## 4. Bring the report back

Any one of these:

- **git:** `git add probe-reports && git commit -m "probe report" && git push`
  (needs GitHub sign-in on the Air)
- **AirDrop / email / USB stick:** send `probe-reports/probe-*.json` to the dev machine and drop it
  into that folder there.

Run the probe more than once if you like. Each run makes a new file.

## Troubleshooting

**"No MIDI devices"**: replug the MiniLab, try another hub port, and close Ableton or Analog Lab
if they're open.

**"Open DMX not found"**: run `ls /dev/cu.*`. You should see something like `cu.usbserial-XXXX`.
If not:

- Replug the Open DMX, preferably straight into the laptop rather than the hub, as a test.
- If you ever installed FTDI's VCP driver (Arduino setups sometimes do), unload it:
  `sudo kextunload -b com.FTDI.driver.FTDIUSBSerialDriver`

**No light turns on in the DMX section**: the probe works out why. It first sends red to
address 1; if that fails it sets every channel to 255 (anything listening to DMX should react),
and if something does react it sweeps red across every address so you can say when a light
turns red. The report records which of those happened, plus what macOS reports about the adapter.
If nothing reacts at all, the probe prints a wiring checklist (power, DMX mode, the cable from the
Open DMX's output to the first light's input, USB port, a terminator plug in the last light).

**Lights flicker during the flicker test**: that's exactly what the test is for. Answer
honestly; the app will pick the steadiest rate.
