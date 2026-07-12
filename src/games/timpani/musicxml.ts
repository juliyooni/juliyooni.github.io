/**
 * Minimal MusicXML reader for the timpani rhythm game.
 *
 * We don't render a score — we only need the timpani part's notes as a flat
 * list of { time, drum } events the judge can compare keypresses against.
 * The browser's DOMParser handles the XML; this module walks it.
 *
 * Supports uncompressed .musicxml / .xml (partwise). Tempo is read from the
 * first <sound tempo>; if absent we fall back to a caller-supplied default.
 */

export interface TimpaniNote {
  /** seconds from the start of the piece */
  time: number;
  /** which drum/lane — pitch step+octave, e.g. "F2", mapped to a key later */
  drum: string;
  /** MIDI-ish pitch for ordering lanes low->high */
  midi: number;
  /** original duration in seconds (for visual note length) */
  duration: number;
}

export interface ParsedScore {
  title: string;
  bpm: number;
  /** total length of the piece in seconds */
  durationSec: number;
  /** timpani notes sorted by time, rests excluded */
  notes: TimpaniNote[];
  /** distinct drums found, low pitch first — these become the lanes */
  drums: string[];
}

const STEP_SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

function pitchToMidi(step: string, octave: number, alter: number): number {
  return (octave + 1) * 12 + (STEP_SEMITONE[step] ?? 0) + alter;
}

/** Names a timpani part can go by, across the languages MusicXML files use. */
const TIMPANI_ALIASES = [
  "timpani", // English / Italian
  "timp",
  "팀파니", // Korean
  "kettledrum",
  "pauke", // German (e.g. the Tchaikovsky score)
  "timbales", // French
  "timbal", // Spanish
];

/** Heuristic: is this <part> the timpani? Checks score-part instrument names. */
function isTimpaniPart(partName: string): boolean {
  const n = partName.toLowerCase();
  return TIMPANI_ALIASES.some((alias) => n.includes(alias));
}

/** Anything with a DOMParser-shaped parseFromString — the browser's, or a shim. */
interface DOMParserLike {
  parseFromString(source: string, mimeType: string): Document;
}

/**
 * Parse a MusicXML string into the timpani-only score the game needs.
 *
 * @param domParser  injectable for Node (build script) use; defaults to the
 *                   browser's global DOMParser.
 */
export function parseMusicXML(
  xmlText: string,
  defaultBpm = 100,
  domParser?: DOMParserLike,
): ParsedScore {
  const parser = domParser ?? new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("MusicXML 파일을 읽지 못했어요 (XML 파싱 오류).");
  }

  const title =
    doc.querySelector("work-title")?.textContent?.trim() ||
    doc.querySelector("movement-title")?.textContent?.trim() ||
    "Untitled";

  // Map score-part ids to names so we can find the timpani <part>.
  const timpaniPartIds = new Set<string>();
  for (const sp of Array.from(doc.querySelectorAll("part-list score-part"))) {
    const id = sp.getAttribute("id") ?? "";
    const name =
      sp.querySelector("part-name")?.textContent ??
      sp.querySelector("instrument-name")?.textContent ??
      "";
    if (isTimpaniPart(name)) timpaniPartIds.add(id);
  }

  const part = pickTimpaniPart(doc, timpaniPartIds);
  if (!part) {
    throw new Error("이 악보에서 팀파니 파트를 찾지 못했어요.");
  }

  let bpm = readTempo(doc) ?? defaultBpm;
  // divisions = ticks per quarter note; can change per measure.
  let divisions = 1;
  let cursor = 0; // seconds
  const notes: TimpaniNote[] = [];

  const secondsPerTick = () => 60 / bpm / divisions;

  for (const measure of Array.from(part.querySelectorAll("measure"))) {
    for (const el of Array.from(measure.children)) {
      switch (el.tagName) {
        case "attributes": {
          const d = el.querySelector("divisions")?.textContent;
          if (d) divisions = parseInt(d, 10) || divisions;
          break;
        }
        case "direction": {
          const t = el.querySelector("sound[tempo]")?.getAttribute("tempo");
          if (t) bpm = parseFloat(t) || bpm;
          break;
        }
        case "backup": {
          const d = el.querySelector("duration")?.textContent;
          if (d) cursor -= parseInt(d, 10) * secondsPerTick();
          break;
        }
        case "forward": {
          const d = el.querySelector("duration")?.textContent;
          if (d) cursor += parseInt(d, 10) * secondsPerTick();
          break;
        }
        case "note": {
          const durTicks = parseInt(
            el.querySelector("duration")?.textContent ?? "0",
            10,
          );
          const durSec = durTicks * secondsPerTick();
          const isRest = el.querySelector("rest") !== null;
          const isChordTone = el.querySelector("chord") !== null;
          const noteStart = isChordTone
            ? cursor - durSec // chord notes share the previous onset
            : cursor;

          if (!isRest) {
            const pitch = el.querySelector("pitch");
            if (pitch) {
              const step = pitch.querySelector("step")?.textContent ?? "C";
              const octave = parseInt(
                pitch.querySelector("octave")?.textContent ?? "3",
                10,
              );
              const alter = parseInt(
                pitch.querySelector("alter")?.textContent ?? "0",
                10,
              );
              notes.push({
                time: noteStart,
                drum: `${step}${alter > 0 ? "#" : alter < 0 ? "b" : ""}${octave}`,
                midi: pitchToMidi(step, octave, alter),
                duration: durSec,
              });
            }
          }
          // Chord tones don't advance the cursor; melodic notes/rests do.
          if (!isChordTone) cursor += durSec;
          break;
        }
      }
    }
  }

  notes.sort((a, b) => a.time - b.time);
  const drums = [...new Set(notes.map((n) => n.drum))].sort(
    (a, b) =>
      (notes.find((n) => n.drum === a)?.midi ?? 0) -
      (notes.find((n) => n.drum === b)?.midi ?? 0),
  );
  const durationSec = notes.length
    ? Math.max(...notes.map((n) => n.time + n.duration))
    : 0;

  return { title, bpm, durationSec, notes, drums };
}

/** Find the timpani <part>; fall back to the first part if names are absent. */
function pickTimpaniPart(
  doc: Document,
  timpaniIds: Set<string>,
): Element | null {
  const parts = Array.from(doc.querySelectorAll("part"));
  if (timpaniIds.size > 0) {
    const match = parts.find((p) =>
      timpaniIds.has(p.getAttribute("id") ?? ""),
    );
    if (match) return match;
  }
  return parts[0] ?? null;
}

function readTempo(doc: Document): number | null {
  const sound = doc.querySelector("sound[tempo]");
  const t = sound?.getAttribute("tempo");
  return t ? parseFloat(t) : null;
}
