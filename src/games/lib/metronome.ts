/**
 * Metronome / bar clock built on Tone.js.
 *
 * Both games need the same thing: a steady pulse, an audible count-in for one
 * preparatory bar, then per-beat callbacks so the UI can show "you're around
 * bar N" and pulse the downbeat. After the count-in, feedback is visual only.
 */
import * as Tone from "tone";

export interface MetronomeOptions {
  bpm: number;
  /** beats per bar, e.g. 4 for 4/4 */
  beatsPerBar: number;
  /** how many preparatory bars get the audible "tick" before recording */
  countInBars: number;
}

export interface BeatInfo {
  /** absolute beat index since transport start (0-based) */
  beat: number;
  /** 0-based beat within the current bar */
  beatInBar: number;
  /** 1-based bar number (negative/zero during count-in) */
  bar: number;
  /** true while still in the preparatory count-in */
  isCountIn: boolean;
  /** true on the first beat of a bar */
  isDownbeat: boolean;
  /** Tone.js audio-context time of this beat, for sample-accurate scheduling */
  time: number;
}

type BeatHandler = (info: BeatInfo) => void;

export class Metronome {
  private readonly opts: MetronomeOptions;
  private readonly clickHi: Tone.Synth;
  private readonly clickLo: Tone.Synth;
  private handlers: BeatHandler[] = [];
  private scheduleId: number | null = null;
  private beatCounter = 0;

  constructor(opts: MetronomeOptions) {
    this.opts = opts;
    // Two short blips: a brighter one for the downbeat, duller for other beats.
    this.clickHi = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }).toDestination();
    this.clickLo = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    }).toDestination();
  }

  /** Register a callback fired on every beat (count-in and beyond). */
  onBeat(handler: BeatHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Start the transport. Resolves once the count-in is over — i.e. exactly
   * when "real" bar 1 begins, which is the moment recording should start.
   */
  async start(): Promise<void> {
    await Tone.start();
    Tone.getTransport().bpm.value = this.opts.bpm;
    this.beatCounter = 0;

    const countInBeats = this.opts.countInBars * this.opts.beatsPerBar;

    return new Promise<void>((resolveCountIn) => {
      this.scheduleId = Tone.getTransport().scheduleRepeat((time) => {
        const beat = this.beatCounter++;
        const beatInBar = beat % this.opts.beatsPerBar;
        const isDownbeat = beatInBar === 0;
        const isCountIn = beat < countInBeats;
        // bar 1 is the first non-count-in bar
        const bar =
          Math.floor((beat - countInBeats) / this.opts.beatsPerBar) + 1;

        if (isCountIn) {
          // Audible tick — only during the preparatory bar(s).
          const click = isDownbeat ? this.clickHi : this.clickLo;
          click.triggerAttackRelease(isDownbeat ? "C6" : "C5", "32n", time);
        }

        const info: BeatInfo = {
          beat,
          beatInBar,
          bar,
          isCountIn,
          isDownbeat,
          time,
        };
        // Defer handlers to the draw thread so DOM work never blocks audio.
        Tone.getDraw().schedule(() => {
          for (const h of this.handlers) h(info);
        }, time);

        if (beat === countInBeats - 1) {
          // last count-in beat just fired; real bar 1 starts next beat
          const secPerBeat = 60 / this.opts.bpm;
          Tone.getDraw().schedule(() => resolveCountIn(), time + secPerBeat);
        }
      }, "4n");

      Tone.getTransport().start();
    });
  }

  stop(): void {
    if (this.scheduleId !== null) {
      Tone.getTransport().clear(this.scheduleId);
      this.scheduleId = null;
    }
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
  }

  dispose(): void {
    this.stop();
    this.clickHi.dispose();
    this.clickLo.dispose();
    this.handlers = [];
  }
}
