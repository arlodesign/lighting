// audioSpectrum.js
export class AudioSpectrum {
  audioContext!: AudioContext;
  analyser!: AnalyserNode;
  dataArray!: Uint8Array;

  constructor(fftSize = 2048, audioContext = new window.AudioContext()) {
    this.audioContext = audioContext;
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  // Connects the audio source (file, microphone, etc.) to the analyser
  async connectAudioSource(stream: MediaStream) {
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);
  }

  // Gets the audio spectrum (frequency data) as an array
  getFrequencyData() {
    this.analyser.getByteFrequencyData(this.dataArray);
    return this.dataArray;
  }

  // Starts audio input from the user's microphone
  async startMicInput() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await this.connectAudioSource(stream);
    } catch (err) {
      console.error("Error accessing microphone: ", err);
    }
  }
}
