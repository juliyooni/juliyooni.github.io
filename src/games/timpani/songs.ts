/**
 * Song registry for the timpani game.
 *
 * Each song ships as:
 *   - a small JSON of the extracted timpani part (built by
 *     scripts/extract-timpani.ts from a full MusicXML score), and
 *   - a backing-track audio file: the whole piece with the timpani muted,
 *     pre-rendered to keep playback light and the timing rock-steady.
 *
 * Paths are relative to the site root (the public/ folder is flattened there).
 */
export interface Song {
  id: string;
  title: string;
  composer: string;
  /** short blurb shown on the song card */
  blurb: string;
  /** extracted timpani-part JSON (a serialised ParsedScore) */
  chartUrl: string;
  /** backing track: the full piece minus timpani */
  backingUrl: string;
  /** rough length, for the card */
  lengthLabel: string;
}

export const SONGS: Song[] = [
  {
    id: "tchaikovsky-6-3-march",
    title: "교향곡 6번 3악장 〈행진곡〉",
    composer: "Tchaikovsky",
    blurb:
      "비창 교향곡의 행진곡 악장. 팀파니가 가장 활발한 4분 구간을 잘라 담았습니다.",
    chartUrl: "/songs/tchaikovsky-6-3-march.json",
    backingUrl: "/songs/tchaikovsky-6-3-march.mp3",
    lengthLabel: "약 4분 12초",
  },
];
