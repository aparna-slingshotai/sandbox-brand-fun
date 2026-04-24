// Detect blow-into-mic events via Web Audio API.
//
// Approach: band-limited RMS on the low-mid frequency range (~100Hz–2kHz).
// That window catches exhaled-air noise reliably while ignoring DC, rumble,
// and most speech sibilance. Exposes a plain `intensity` number (0..1) the
// render loop can sample each frame without any async weirdness.

import { CFG } from "./config.js";

export class MicBlow {
  constructor() {
    this.active = false;
    this.ready = false;
    this.intensity = 0;

    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.freqBuf = null;
  }

  // Must be called from a user gesture (button click).
  async enable() {
    if (this.ready) {
      this.active = true;
      if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
      return true;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.stream = stream;

    const AC = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AC();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = CFG.MIC_FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0.4;
    this.source = this.audioCtx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this.freqBuf = new Uint8Array(this.analyser.frequencyBinCount);

    this.ready = true;
    this.active = true;
    return true;
  }

  disable() {
    this.active = false;
    this.intensity = 0;
  }

  // Fully release the mic (and the red indicator in the browser tab).
  release() {
    this.active = false;
    this.intensity = 0;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
    this.source = null;
    this.freqBuf = null;
    this.ready = false;
  }

  // Call once per frame. Returns a normalized intensity 0..1 (blow amplitude
  // above threshold). Returns 0 if not active or below threshold.
  sample() {
    if (!this.active || !this.analyser) {
      this.intensity = 0;
      return 0;
    }
    const buf = this.freqBuf;
    this.analyser.getByteFrequencyData(buf);

    const lo = CFG.MIC_BAND_LOW;
    const hi = Math.min(CFG.MIC_BAND_HIGH, buf.length);
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += buf[i];
    const avg = sum / (hi - lo) / 255; // 0..1

    const threshold = CFG.MIC_BLOW_THRESHOLD;
    if (avg < threshold) {
      this.intensity = 0;
      return 0;
    }
    // Remap [threshold..1] → [0..1] so quiet blows don't feel all-or-nothing.
    this.intensity = Math.min(1, (avg - threshold) / (1 - threshold));
    return this.intensity;
  }
}
