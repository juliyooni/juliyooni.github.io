/**
 * DDSP timbre-transfer wrapper around @magenta/music.
 *
 * Magenta ships pretrained DDSP checkpoints that run fully in-browser via
 * TensorFlow.js — no server. The pipeline is:
 *   recorded voice  ->  SPICE (pitch + loudness extraction)  ->  DDSP model
 *   ->  resynthesised audio in the target instrument's timbre.
 *
 * Only four instruments have public checkpoints. Piano/clarinet are NOT
 * available — DDSP models a monophonic harmonic+noise source, so percussive
 * polyphonic instruments are out of scope by design.
 */
import { DDSP } from "@magenta/music/esm/ddsp";
import { SPICE } from "@magenta/music/esm/spice";

const CHECKPOINT_BASE =
  "https://storage.googleapis.com/magentadata/js/checkpoints/ddsp";

export type InstrumentId = "violin" | "trumpet" | "tenor_saxophone" | "flute";

export interface Instrument {
  id: InstrumentId;
  label: string;
  emoji: string;
}

export const INSTRUMENTS: Instrument[] = [
  { id: "violin", label: "바이올린", emoji: "🎻" },
  { id: "trumpet", label: "트럼펫", emoji: "🎺" },
  { id: "tenor_saxophone", label: "색소폰", emoji: "🎷" },
  { id: "flute", label: "플루트", emoji: "🪈" },
];

/**
 * Holds the shared SPICE pitch model plus one DDSP model per instrument.
 * SPICE is loaded once and reused; DDSP checkpoints are loaded lazily on first
 * use of each instrument so the page isn't blocked downloading all four.
 */
export class TimbreTransfer {
  private spice: SPICE | null = null;
  private readonly models = new Map<InstrumentId, DDSP>();

  /** Load the pitch model. Call once before any transform. */
  async init(onProgress?: (msg: string) => void): Promise<void> {
    if (this.spice) return;
    onProgress?.("피치 모델 불러오는 중…");
    this.spice = new SPICE();
    await this.spice.initialize();
  }

  /** Lazily fetch + initialise the DDSP checkpoint for one instrument. */
  private async getModel(
    id: InstrumentId,
    onProgress?: (msg: string) => void,
  ): Promise<DDSP> {
    let model = this.models.get(id);
    if (model) return model;

    const label = INSTRUMENTS.find((i) => i.id === id)?.label ?? id;
    onProgress?.(`${label} 모델 불러오는 중… (수 MB, 첫 로딩만)`);
    model = new DDSP(`${CHECKPOINT_BASE}/${id}`);
    await model.initialize();
    this.models.set(id, model);
    return model;
  }

  /**
   * Transform a recorded voice buffer into the chosen instrument.
   * Returns a Float32Array of mono samples at 16 kHz (DDSP's native rate).
   */
  async transform(
    voice: AudioBuffer,
    instrument: InstrumentId,
    opts: { onProgress?: (msg: string) => void } = {},
  ): Promise<Float32Array> {
    if (!this.spice) throw new Error("call init() before transform()");

    const model = await this.getModel(instrument, opts.onProgress);
    opts.onProgress?.("멜로디 분석 중…");

    // SPICE extracts pitch + loudness contours straight from the voice
    // AudioBuffer. DDSP then resynthesises that exact contour with the
    // instrument's timbre — this is why expression and vibrato survive.
    const audioFeatures = await this.spice.getAudioFeatures(voice);

    opts.onProgress?.("악기로 다시 연주하는 중…");
    const result = await model.synthesize(audioFeatures);
    return result;
  }

  dispose(): void {
    this.spice?.dispose();
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
  }
}

/** DDSP outputs 16 kHz mono; wrap it into a playable AudioBuffer. */
export function samplesToBuffer(
  samples: Float32Array,
  ctx: AudioContext,
  sampleRate = 16000,
): AudioBuffer {
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);
  return buffer;
}
