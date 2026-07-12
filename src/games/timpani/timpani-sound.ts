/**
 * Timpani voice — a synthesised kettledrum hit.
 *
 * A real timpani is a tuned membrane: a strong fundamental with a quick
 * pitch drop and a noisy attack. MembraneSynth models exactly that, so we use
 * one per drum, tuned to the drum's pitch.
 */
import * as Tone from "tone";

export class TimpaniKit {
  private readonly drums = new Map<string, Tone.MembraneSynth>();
  /** Last scheduled strike time per drum — Tone forbids non-increasing times. */
  private readonly lastHit = new Map<string, number>();

  /** Pre-build a synth for each drum pitch in the score. */
  constructor(drumPitches: string[]) {
    for (const pitch of drumPitches) {
      const synth = new Tone.MembraneSynth({
        pitchDecay: 0.08,
        octaves: 2,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
      }).toDestination();
      synth.volume.value = -4;
      this.drums.set(pitch, synth);
    }
  }

  /**
   * Strike one drum. Schedules a hair into the future so rapid repeated hits
   * on the same drum always have strictly-increasing times — Tone.js throws
   * otherwise, which would abort the keypress handler.
   */
  hit(drum: string, velocity = 1): void {
    const synth = this.drums.get(drum);
    if (!synth) return;

    const now = Tone.getContext().currentTime;
    const prev = this.lastHit.get(drum) ?? 0;
    // nudge past the previous strike if two land in the same audio frame
    const at = Math.max(now, prev + 0.001);
    this.lastHit.set(drum, at);

    // drum string looks like "F2" / "C#3" — Tone reads it directly as a note.
    try {
      synth.triggerAttackRelease(drum, "8n", at, velocity);
    } catch {
      // extremely close double-hit — drop the second strike rather than crash
    }
  }

  dispose(): void {
    for (const s of this.drums.values()) s.dispose();
    this.drums.clear();
    this.lastHit.clear();
  }
}
