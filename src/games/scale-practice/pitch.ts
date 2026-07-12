/**
 * Real-time pitch detection for the scale-practice game.
 *
 * Pulls audio from the mic via an AnalyserNode, then runs autocorrelation on
 * each sliding window to find the dominant period -> frequency. This is the
 * standard approach for monophonic vocal pitch: light, no ML, ~5 ms per call,
 * and accurate enough that the user sees their pitch update smoothly while
 * they sustain a note.
 *
 * SPICE (used in the voice transformer) is offline batch-only — it expects a
 * whole buffer at once. For live "tuner-style" feedback we need per-frame
 * detection, so autocorrelation is the right tool here.
 */

export interface PitchSample {
  /** Frequency in Hz; null when the window is too quiet or noisy. */
  hz: number | null;
  /** RMS amplitude of this window, useful for VU/silence gating. */
  rms: number;
}

export class PitchTracker {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  // Typed as Float32Array<ArrayBuffer> (not SharedArrayBuffer) so it satisfies
  // AnalyserNode.getFloatTimeDomainData's stricter signature.
  private buf: Float32Array<ArrayBuffer> | null = null;

  /** Ask for the mic and wire up an analyser. Call once on game start. */
  async start(): Promise<void> {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    // 2048 samples @ 48 kHz ≈ 43 ms — small enough to feel live, big enough
    // to detect pitches down to ~60 Hz (well below any singing voice).
    this.analyser.fftSize = 2048;
    src.connect(this.analyser);
    this.buf = new Float32Array(
      new ArrayBuffer(this.analyser.fftSize * Float32Array.BYTES_PER_ELEMENT),
    );
  }

  /** Sample the mic right now and return detected pitch + loudness. */
  sample(): PitchSample {
    if (!this.analyser || !this.buf || !this.ctx) {
      return { hz: null, rms: 0 };
    }
    this.analyser.getFloatTimeDomainData(this.buf);
    const rms = computeRms(this.buf);
    // Below this RMS the user isn't singing — return null so the UI can show
    // a neutral colour instead of guessing a pitch from background noise.
    if (rms < 0.01) return { hz: null, rms };
    const hz = autocorrelate(this.buf, this.ctx.sampleRate);
    return { hz, rms };
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.buf = null;
  }
}

/** Plain RMS of a float audio window. */
function computeRms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/**
 * Autocorrelation pitch detector.
 *
 * Finds the lag that maximises self-similarity within a plausible vocal range
 * (~60–1100 Hz), then refines that lag with parabolic interpolation between
 * neighbouring samples. The interpolation step is what gets sub-sample
 * accuracy — without it, low pitches quantise to whole-sample lags and the
 * cent reading jumps in chunks.
 *
 * Returns null if no clear period is found (noise, silence, multi-pitch).
 */
function autocorrelate(buf: Float32Array, sampleRate: number): number | null {
  const SIZE = buf.length;
  const MIN_LAG = Math.floor(sampleRate / 1100); // ~C6 ceiling
  const MAX_LAG = Math.floor(sampleRate / 60); //   ~B1 floor

  // Standard normalised autocorrelation.
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = MIN_LAG; lag < MAX_LAG; lag++) {
    let corr = 0;
    const limit = SIZE - lag;
    for (let i = 0; i < limit; i++) corr += buf[i] * buf[i + lag];
    corr /= limit;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  if (bestLag < 0 || bestCorr < 0.01) return null;

  // Parabolic interpolation around the peak for sub-sample lag precision.
  const refinedLag = refinePeak(buf, bestLag);
  return sampleRate / refinedLag;
}

/** Fit a parabola through (lag-1, lag, lag+1) and return the vertex's x. */
function refinePeak(buf: Float32Array, lag: number): number {
  const SIZE = buf.length;
  const sampleAt = (l: number): number => {
    let c = 0;
    const limit = SIZE - l;
    for (let i = 0; i < limit; i++) c += buf[i] * buf[i + l];
    return c / limit;
  };
  const y0 = sampleAt(lag - 1);
  const y1 = sampleAt(lag);
  const y2 = sampleAt(lag + 1);
  const denom = y0 - 2 * y1 + y2;
  if (denom === 0) return lag;
  return lag + (0.5 * (y0 - y2)) / denom;
}

// ---- music-theory helpers ----

/** MIDI note name -> integer pitch number (e.g. "A4" -> 69). */
export function noteNameToMidi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(name);
  if (!m) throw new Error(`bad note name: ${name}`);
  const STEPS: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  let semis = STEPS[m[1]];
  if (m[2] === "#") semis++;
  else if (m[2] === "b") semis--;
  return (parseInt(m[3], 10) + 1) * 12 + semis;
}

/** Hz -> MIDI note number (float; fractional part is cents/100). */
export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** MIDI note number -> Hz. */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Cents off the nearest semitone. Positive = sharp, negative = flat.
 * Roughly: ±50 cents covers everything before the listener hears it as a
 * different note.
 */
export function centsOff(hz: number, targetMidi: number): number {
  return (hzToMidi(hz) - targetMidi) * 100;
}
