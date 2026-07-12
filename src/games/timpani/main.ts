/**
 * Timpani rhythm game — game flow.
 *
 *  - Pick a song. Its timpani part is loaded from a pre-extracted JSON chart
 *    (built by scripts/extract-timpani.ts) — no 17 MB MusicXML in the browser.
 *  - Notes fall down lanes toward a hit line. Lanes map to a/s/d/f keys,
 *    low drum to high.
 *  - The backing track (the whole piece with timpani muted) plays in sync.
 *    The timpani itself sounds ONLY on the player's correct keypresses.
 *  - Hits are graded by the Judge against the chart's note timings.
 */
import * as Tone from "tone";
import type { ParsedScore } from "./musicxml";
import { Judge, type Verdict } from "./judge";
import { TimpaniKit } from "./timpani-sound";
import { SONGS, type Song } from "./songs";

/**
 * Lane keys, given as KeyboardEvent.code values (physical key positions).
 * Using `code` rather than `key` means the game works regardless of keyboard
 * layout or IME state — e.g. when the OS is in Korean input mode, `e.key` for
 * the A key is "ㅁ", but `e.code` is always "KeyA".
 */
const LANE_CODES = ["KeyA", "KeyS", "KeyD", "KeyF"]; // up to 4 drums
/** Labels shown on the lane key-caps. */
const LANE_LABELS = ["A", "S", "D", "F"];
const FALL_SECONDS = 2.0; // time a note takes to travel top -> hit line
const HIT_LINE_FROM_BOTTOM = 70; // px, must match .hit-line in CSS
const LEAD_IN = 2.5; // seconds of run-up before the first note can arrive

/**
 * Audio output latency, in seconds — the gap between scheduling audio and the
 * player hearing it. AudioContext exposes a measured value; this is the
 * fallback when it doesn't.
 */
const FALLBACK_OUTPUT_LATENCY = 0.03;

/** localStorage key for the player's saved sync calibration. */
const SYNC_STORAGE_KEY = "timpani.syncOffsetMs";

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

// ---- DOM ----
const songList = $("songList");
const loadStatus = $("loadStatus");
const setupPanel = $("setupPanel");
const gamePanel = $("gamePanel");
const resultsPanel = $("resultsPanel");
const lanesEl = $("lanes");
const highway = $("highway");
const startBtn = $<HTMLButtonElement>("startBtn");
const stopBtn = $<HTMLButtonElement>("stopBtn");
const pointsEl = $("points");
const comboEl = $("combo");
const accuracyEl = $("accuracy");
const judgeFlash = $("judgeFlash");
const resultsGrid = $("resultsGrid");
const againBtn = $<HTMLButtonElement>("againBtn");
const syncSlider = $<HTMLInputElement>("syncSlider");
const syncValue = $("syncValue");
const syncEarlier = $<HTMLButtonElement>("syncEarlier");
const syncLater = $<HTMLButtonElement>("syncLater");

// ---- state ----
let song: Song | null = null;
let score: ParsedScore | null = null;
let judge: Judge | null = null;
let kit: TimpaniKit | null = null;
let backing: Tone.Player | null = null;
let running = false;
/**
 * The single source of truth for "now" in the song. This is a raw
 * AudioContext.currentTime value captured at the instant song-time 0 begins.
 * Everything — note positions, judging, audio start — is measured against it,
 * so they can never drift apart. (Tone.now() is NOT used: it adds a variable
 * lookAhead each call, so it isn't a steady clock.)
 */
let songZero = 0;
/** Measured audio output latency for this session (see FALLBACK_OUTPUT_LATENCY). */
let outputLatency = FALLBACK_OUTPUT_LATENCY;
/**
 * Player-set sync calibration, in seconds. Positive nudges the clock ahead so
 * notes reach the hit line earlier; negative makes them later. Controlled live
 * by the in-game slider and persisted to localStorage.
 */
let syncOffset = 0;
let rafId = 0;
const laneEls: HTMLElement[] = [];
const noteEls = new Map<number, HTMLElement>(); // target index -> block

// ---- song picker ----
function buildSongList(): void {
  for (const s of SONGS) {
    const card = document.createElement("button");
    card.className = "song-card";
    card.innerHTML = `
      <span class="song-card__icon">🥁</span>
      <span class="song-card__main">
        <span class="song-card__title">${s.title}</span>
        <span class="song-card__meta">${s.composer} · ${s.lengthLabel}</span>
        <span class="song-card__blurb">${s.blurb}</span>
      </span>
      <span class="song-card__go">▶</span>
    `;
    card.addEventListener("click", () => void selectSong(s, card));
    songList.appendChild(card);
  }
}

/** Fetch a song's timpani chart, then move into the playfield. */
async function selectSong(s: Song, card: HTMLButtonElement): Promise<void> {
  card.disabled = true;
  loadStatus.textContent = "곡 불러오는 중…";
  loadStatus.className = "status";
  try {
    // chartUrl is root-relative; this page sits three levels deep.
    const chartUrl = new URL("../../../" + s.chartUrl, window.location.href);
    const res = await fetch(chartUrl);
    if (!res.ok) throw new Error(`차트를 불러오지 못했어요 (${res.status}).`);
    const chart = (await res.json()) as ParsedScore;
    if (!chart.notes?.length) throw new Error("이 곡엔 팀파니 노트가 없어요.");

    song = s;
    score = chart;
    loadStatus.textContent = `'${chart.title}' — 팀파니 ${chart.notes.length}타.`;
    loadStatus.className = "status is-ok";
    prepareGame();
  } catch (err) {
    loadStatus.textContent =
      err instanceof Error ? err.message : "곡을 불러오지 못했어요.";
    loadStatus.className = "status is-error";
  } finally {
    card.disabled = false;
  }
}

// ---- build the playfield ----
function prepareGame(): void {
  if (!score) return;
  setupPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");

  // Drums beyond 4 are dropped; the judge only knows about the kept drums.
  const drums = score.drums.slice(0, LANE_CODES.length);

  lanesEl.innerHTML = "";
  laneEls.length = 0;
  drums.forEach((_, i) => {
    const lane = document.createElement("div");
    lane.className = "lane";
    const key = document.createElement("div");
    key.className = "lane__key";
    key.textContent = LANE_LABELS[i];
    lane.appendChild(key);
    lanesEl.appendChild(lane);
    laneEls.push(lane);
  });

  judge = new Judge(
    score.notes.filter((n) => drums.includes(n.drum)),
    drums,
  );
  kit?.dispose();
  kit = new TimpaniKit(drums);

  startBtn.disabled = false;
  stopBtn.disabled = true;
  pointsEl.textContent = "0";
  comboEl.textContent = "0";
  accuracyEl.textContent = "—";
}

// ---- the song clock ----
/**
 * Current song time in seconds (notes are timed from song t=0).
 *
 * One clock drives everything: note visuals, judging, and the backing track's
 * scheduled start all measure against `songZero` on the raw AudioContext
 * clock. `syncOffset` (the in-game slider) nudges this clock so the player can
 * line notes up against the music by feel. A note touches the hit line when
 * songTime() === note.time.
 */
function songTime(): number {
  return Tone.getContext().currentTime - songZero + syncOffset;
}

/**
 * Load the backing track for the current song, if not already loaded.
 * Returns the Player, or null if the audio file is missing — the game still
 * runs without it (timpani-only), just without the orchestral backing.
 */
async function loadBacking(s: Song): Promise<Tone.Player | null> {
  if (backing) return backing;
  const url = new URL("../../../" + s.backingUrl, window.location.href);

  // Check the file exists AND is audio before handing it to Tone. Dev/preview
  // servers answer missing paths with index.html (HTTP 200, text/html), so a
  // bare `res.ok` isn't enough — confirm the content type too.
  try {
    const head = await fetch(url, { method: "HEAD" });
    const type = head.headers.get("content-type") ?? "";
    if (!head.ok || !type.startsWith("audio/")) {
      throw new Error(`not audio (${head.status}, ${type || "no type"})`);
    }
  } catch {
    console.warn("backing track not available, playing timpani-only:", s.backingUrl);
    return null;
  }

  const player = new Tone.Player({ url: url.href }).toDestination();
  await Tone.loaded(); // wait for the buffer to decode
  backing = player;
  return player;
}

async function startGame(): Promise<void> {
  if (!score || !judge || !song || running) return;
  await Tone.start();

  startBtn.disabled = true;
  loadStatus.textContent = "";

  // Reset any previous note blocks.
  for (const el of noteEls.values()) el.remove();
  noteEls.clear();

  const player = await loadBacking(song);

  running = true;
  stopBtn.disabled = false;

  // Measure this device's real output latency, if the browser exposes it.
  // This is the gap between scheduling audio and the player actually hearing it.
  const raw = Tone.getContext().rawContext as unknown as {
    outputLatency?: number;
    baseLatency?: number;
  };
  const measured = (raw.outputLatency ?? 0) + (raw.baseLatency ?? 0);
  outputLatency = measured > 0 ? measured : FALLBACK_OUTPUT_LATENCY;

  // Song-time 0 is LEAD_IN seconds out, so the first note has run-up room.
  // Note visuals run on this clock: note `t` hits the line at songZero + t.
  const ctxNow = Tone.getContext().currentTime;
  songZero = ctxNow + LEAD_IN;

  // Start the backing track `outputLatency` EARLY, so each beat is *heard* at
  // the moment the matching note reaches the hit line — compensating for the
  // delay between scheduling audio and it leaving the speakers.
  if (player) player.start(Math.max(ctxNow, songZero - outputLatency));

  // The timpani part is intentionally NOT in the backing track — it sounds
  // only on the player's correct hits, in handleKey() below.

  loop();
}

function stopGame(): void {
  if (!running) return;
  running = false;
  cancelAnimationFrame(rafId);
  backing?.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
  showResults();
}

// ---- render loop ----
function loop(): void {
  if (!running || !judge || !score) return;
  const now = songTime();

  // spawn / position note blocks
  judge.targets.forEach((t, i) => {
    const visibleFrom = t.time - FALL_SECONDS;
    if (now < visibleFrom || t.lane >= laneEls.length) return;

    let block = noteEls.get(i);
    if (!block && !t.judged) {
      block = document.createElement("div");
      block.className = "note-block";
      laneEls[t.lane].appendChild(block);
      noteEls.set(i, block);
    }
    if (!block) return;

    // progress 0 (top) .. 1 (hit line)
    const progress = (now - visibleFrom) / FALL_SECONDS;
    const travel = highway.clientHeight - HIT_LINE_FROM_BOTTOM;
    block.style.top = `${progress * travel - 13}px`;

    if (t.judged) {
      block.classList.add(t.verdict === "miss" ? "is-missed" : "is-hit");
      // let judged notes drift off, then drop them
      if (progress > 1.4) {
        block.remove();
        noteEls.delete(i);
      }
    }
  });

  // auto-miss anything that fell past the window
  const missed = judge.collectMisses(now);
  if (missed.length) flashJudge("miss");

  refreshHud();

  // end when the last note has comfortably passed
  if (now > score.durationSec + 1.5) {
    stopGame();
    return;
  }
  rafId = requestAnimationFrame(loop);
}

// ---- input ----
function handleKey(e: KeyboardEvent): void {
  if (!running || !judge || !kit) return;
  // Match on physical key position so layout / Korean IME don't break input.
  const lane = LANE_CODES.indexOf(e.code);
  if (lane < 0 || lane >= laneEls.length || e.repeat) return;

  laneEls[lane].classList.add("is-pressed");
  // songTime() is already latency-compensated, so it directly reflects the
  // beat the player is reacting to — judge the press straight against it.
  const result = judge.press(lane, songTime());

  // The timpani sounds ONLY here — driven by the player's input, never by the
  // backing track. A miss with nothing in range stays silent.
  if (result.target) {
    kit.hit(result.target.drum, result.verdict === "perfect" ? 1 : 0.7);
  }
  flashJudge(result.verdict);
  refreshHud();
}

function handleKeyUp(e: KeyboardEvent): void {
  const lane = LANE_CODES.indexOf(e.code);
  if (lane >= 0 && lane < laneEls.length) {
    laneEls[lane].classList.remove("is-pressed");
  }
}

window.addEventListener("keydown", handleKey);
window.addEventListener("keyup", handleKeyUp);

// ---- HUD + feedback ----
let flashTimer = 0;
function flashJudge(verdict: Verdict): void {
  judgeFlash.textContent =
    verdict === "perfect" ? "PERFECT!" : verdict === "good" ? "GOOD" : "MISS";
  judgeFlash.className = `judge-flash ${verdict}`;
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    judgeFlash.textContent = "";
    judgeFlash.className = "judge-flash";
  }, 450);
}

function refreshHud(): void {
  if (!judge) return;
  pointsEl.textContent = String(judge.score.points);
  comboEl.textContent = String(judge.score.combo);
  accuracyEl.textContent = `${Math.round(judge.accuracy * 100)}%`;
}

// ---- results ----
function showResults(): void {
  if (!judge) return;
  gamePanel.classList.add("hidden");
  resultsPanel.classList.remove("hidden");
  const s = judge.score;
  const cells: [string, string | number][] = [
    ["점수", s.points],
    ["Perfect", s.perfect],
    ["Good", s.good],
    ["Miss", s.miss],
    ["최대 콤보", s.maxCombo],
    ["정확도", `${Math.round(judge.accuracy * 100)}%`],
  ];
  resultsGrid.innerHTML = cells
    .map(
      ([lbl, num]) => `
      <div class="result-cell">
        <span class="result-cell__num">${num}</span>
        <span class="result-cell__lbl">${lbl}</span>
      </div>`,
    )
    .join("");
}

againBtn.addEventListener("click", () => {
  if (score) prepareGame();
});

startBtn.addEventListener("click", () => void startGame());
stopBtn.addEventListener("click", stopGame);

// ---- sync calibration ----
/** Apply a calibration value (in ms), update the UI, and persist it. */
function setSyncOffset(ms: number): void {
  const clamped = Math.max(-150, Math.min(150, Math.round(ms / 5) * 5));
  syncOffset = clamped / 1000; // ms -> seconds
  syncSlider.value = String(clamped);
  syncValue.textContent = `${clamped > 0 ? "+" : ""}${clamped} ms`;
  try {
    localStorage.setItem(SYNC_STORAGE_KEY, String(clamped));
  } catch {
    /* private-mode storage may throw — calibration just won't persist */
  }
}

syncSlider.addEventListener("input", () =>
  setSyncOffset(Number(syncSlider.value)),
);
// "빠르게 ▶" = notes earlier = larger offset; "◀ 늦게" = the reverse.
syncLater.addEventListener("click", () =>
  setSyncOffset(Number(syncSlider.value) + 5),
);
syncEarlier.addEventListener("click", () =>
  setSyncOffset(Number(syncSlider.value) - 5),
);

// ---- init ----
buildSongList();

// Restore the saved calibration, defaulting to 0 (no nudge).
const savedSync = Number(localStorage.getItem(SYNC_STORAGE_KEY));
setSyncOffset(Number.isFinite(savedSync) ? savedSync : 0);

// Dev-only diagnostic hook: lets the browser console (or a test) inspect the
// live song clock and judging state. Stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__timpaniDebug = () => ({
    running,
    songTime: songTime(),
    outputLatency,
    syncOffset,
    ctxState: Tone.getContext().rawContext.state,
    judged: judge?.targets.filter((t) => t.judged).length,
    total: judge?.targets.length,
    nextTargets: judge?.targets
      .filter((t) => !t.judged)
      .slice(0, 3)
      .map((t) => ({ time: t.time, lane: t.lane })),
  });
}
