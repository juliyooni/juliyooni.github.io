/**
 * Scale definitions for the scale-practice game.
 *
 * Each major scale is just the seven steps of its key plus the octave on top
 * (8 notes total, ascending). Specifying the tonic as a MIDI note lets us
 * place the scale at any octave the user's voice can manage.
 */
import { noteNameToMidi } from "./pitch";

export interface Scale {
  id: string;
  /** Display name shown on the picker card */
  name: string;
  /** Korean solfege-style label, e.g. "다장조" */
  label: string;
  /** Tonic as note name + octave that suits an average voice */
  tonic: string;
}

/** Major scale, ascending: tonic + 2 2 1 2 2 2 1 semitone steps. */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];

export const SCALES: Scale[] = [
  { id: "c-major", name: "C Major", label: "다장조", tonic: "C4" },
  { id: "g-major", name: "G Major", label: "사장조", tonic: "G3" },
  { id: "d-major", name: "D Major", label: "라장조", tonic: "D4" },
  { id: "f-major", name: "F Major", label: "바장조", tonic: "F3" },
  { id: "a-major", name: "A Major", label: "가장조", tonic: "A3" },
  { id: "b-flat-major", name: "B♭ Major", label: "내림나장조", tonic: "Bb3" },
];

/** Build the 8-note ascending sequence (MIDI numbers) for a scale. */
export function buildSequence(scale: Scale): number[] {
  const tonicMidi = noteNameToMidi(scale.tonic);
  return MAJOR_STEPS.map((step) => tonicMidi + step);
}

/** Friendly note label for the on-screen target ("도", "레", ...). */
export const SOLFEGE = ["도", "레", "미", "파", "솔", "라", "시", "도"];

/** Western pitch-class names (for sharps; we'll show plain naturals only). */
const PITCH_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

/** Spell a MIDI number like "G4". */
export function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[pc]}${octave}`;
}
