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
3. **Plug in through the hub:** MiniLab 3, ENTTEC Open DMX USB → XLR → first light → daisy-chain.
   Lights powered, in **7-channel DMX mode**.
4. **Do NOT install** FTDI's "VCP" driver, and quit QLC+ or any other lighting app, which
   would grab the Open DMX.

## 2. Make the relative-knob User program (before running the probe)

Pass 2 of the probe needs a MiniLab program where the 8 knobs send **relative** values. This is
the mode the real app will use.

1. Install **Arturia Software Center**, then use it to install **MIDI Control Center** (MCC).
2. Open MCC with the MiniLab connected. If it offers a **firmware update**, take it.
   Relative knob modes need firmware 1.1 or newer.
3. Select a **User** program slot (e.g. User 1) in MCC's program browser.
4. Click each of the 8 knobs in MCC's picture of the MiniLab and set its mode to
   **Relative** (pick "Relative 1" / "binary offset" if there's a choice). Leave the CC numbers,
   pads, faders, etc. at their defaults.
5. **Store / send** the program to the MiniLab's User slot.
6. On the MiniLab, **SHIFT + pad 3** cycles programs. You'll switch to this one when the probe asks.

MCC's labels may differ slightly from these steps. The goal is "8 knobs → relative, saved to a
User program". If it fights you, skip pass 2 when the probe asks. Pass 1 alone is still very
useful.

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

**Lights flicker during the flicker test**: that's exactly what the test is for. Answer
honestly; the app will pick the steadiest rate.
