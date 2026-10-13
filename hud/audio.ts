/**
 * Microphone analysis for sound-reactive lights. Runs in the browser because Web Audio
 * makes mic access and FFTs trivial; sends ~30 small frames a second to the server.
 */
export interface AudioFrame {
  level: number;
  bass: number;
  kick: boolean;
}

export async function startMic(
  onFrame: (frame: AudioFrame) => void,
): Promise<() => void> {
  // Voice processing (auto gain, noise suppression) would flatten exactly the dynamics we want.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0;
  ctx.createMediaStreamSource(stream).connect(analyser);

  const time = new Float32Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  const bassBins = Math.max(
    1,
    Math.round(150 / (ctx.sampleRate / analyser.fftSize)),
  );
  let bassAvg = 0;
  let lastKick = 0;

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(time);
    analyser.getByteFrequencyData(freq);
    let sum = 0;
    for (const v of time) sum += v * v;
    // RMS of a loud room is ~0.1–0.3; scale so "loud" lands near 1 before the gain knob.
    const level = Math.min(1, Math.sqrt(sum / time.length) * 3.5);
    let b = 0;
    for (let i = 1; i <= bassBins; i++) b += freq[i]!;
    const bass = b / bassBins / 255;

    // Kick = bass jumps well above its recent average (and not more than ~6×/s).
    const t = performance.now();
    const kick = bass > bassAvg * 1.45 && bass > 0.25 && t - lastKick > 150;
    if (kick) lastKick = t;
    bassAvg = bassAvg * 0.9 + bass * 0.1;

    onFrame({ level, bass, kick });
  }, 1000 / 30);

  return () => {
    clearInterval(timer);
    stream.getTracks().forEach((tr) => tr.stop());
    void ctx.close();
  };
}
