/**
 * Scale-practice game — game flow.
 *
 *  - Player picks a major scale; the game builds an 8-note ascending sequence.
 *  - A reference piano note plays the tonic so the player has a pitch anchor.
 *  - For each target note, the orb shows live pitch feedback by colour:
 *      yellow = on pitch, green/purple = slightly flat/sharp,
 *      blue/red = clearly flat/sharp. Hold yellow for HOLD_SECONDS to pass.
 *  - When all 8 notes are passed, show results (average accuracy, time).
 */
import * as Tone from "tone";
import {
  PitchTracker,
  centsOff,
  midiToHz,
} from "./pitch";
import {
  SCALES,
  SOLFEGE,
  buildSequence,
  midiToName,
  type Scale,
} from "./scales";

/** Cents thresholds for the five-colour feedback. */
const PERFECT_CENTS = 15;
const MILD_CENTS = 50;
/** How long the player must sustain "yellow" to clear a note (seconds). */
const HOLD_SECONDS = 0.8;

type Verdict = "perfect" | "lo-mild" | "hi-mild" | "lo" | "hi" | "none";

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

// ---- DOM ----
const scaleList = $("scaleList");
const loadStatus = $("loadStatus");
const setupPanel = $("setupPanel");
const gamePanel = $("gamePanel");
const resultsPanel = $("resultsPanel");
const hudScale = $("hudScale");
const hudProgress = $("hudProgress");
const hudCents = $("hudCents");
const orb = $("orb");
const orbSolfege = $("orbSolfege");
const orbNote = $("orbNote");
const ladder = $("ladder");
const startBtn = $<HTMLButtonElement>("startBtn");
const refBtn = $<HTMLButtonElement>("refBtn");
const stopBtn = $<HTMLButtonElement>("stopBtn");
const againBtn = $<HTMLButtonElement>("againBtn");
const pickBtn = $<HTMLButtonElement>("pickBtn");
const resultsGrid = $("resultsGrid");

// Inject the hold-progress bar under the orb (kept out of HTML so we don't
// have to touch the markup if we change the indicator style).
const holdWrap = document.createElement("div");
holdWrap.className = "orb__hold";
const holdBar = document.createElement("div");
holdBar.className = "orb__hold-bar";
holdWrap.appendChild(holdBar);
orb.after(holdWrap);

// ---- state ----
let scale: Scale | null = null;
let sequence: number[] = [];
let stepIdx = 0;
let holdTime = 0; // seconds the player has held "perfect" for the current step
let running = false;
let rafId = 0;
let lastFrameTime = 0;
let piano: Tone.PolySynth | null = null;
const tracker = new PitchTracker();
const stepEls: HTMLElement[] = [];

// per-step metrics for the results screen
interface StepResult {
  targetMidi: number;
  /** time in seconds taken to pass this step */
  seconds: number;
  /** average |cents off| across samples while passing the step */
  avgCents: number;
}
let stepResults: StepResult[] = [];
let stepStartedAt = 0;
let stepCentsSum = 0;
let stepCentsCount = 0;

// ---- scale picker ----
function buildScaleList(): void {
  for (const s of SCALES) {
    const card = document.createElement("button");
    card.className = "scale-card";
    card.innerHTML = `
      <span class="scale-card__name">${s.name}</span>
      <span class="scale-card__label">${s.label}</span>
      <span class="scale-card__tonic">시작음 ${s.tonic}</span>
    `;
    card.addEventListener("click", () => selectScale(s));
    scaleList.appendChild(card);
  }
}

function selectScale(s: Scale): void {
  scale = s;
  sequence = buildSequence(s);
  stepResults = [];
  setupPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  hudScale.textContent = s.label;
  buildLadder();
  stepIdx = 0;
  refreshLadder();
  hudProgress.textContent = `0 / ${sequence.length}`;
  hudCents.textContent = "— ¢";
  setOrb("none", SOLFEGE[0], midiToName(sequence[0]));
  startBtn.disabled = false;
  refBtn.disabled = false;
  stopBtn.disabled = true;
}

function buildLadder(): void {
  ladder.innerHTML = "";
  stepEls.length = 0;
  sequence.forEach((_, i) => {
    const el = document.createElement("div");
    el.className = "step";
    el.textContent = SOLFEGE[i];
    ladder.appendChild(el);
    stepEls.push(el);
  });
}

function refreshLadder(): void {
  stepEls.forEach((el, i) => {
    el.classList.toggle("is-done", i < stepIdx);
    el.classList.toggle("is-current", i === stepIdx);
  });
}

// ---- audio: reference tone ----
function getPiano(): Tone.PolySynth {
  // Lazy so we don't make audio nodes before the first user gesture.
  if (!piano) {
    piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.3, release: 1.2 },
    }).toDestination();
    piano.volume.value = -8;
  }
  return piano;
}

function playReference(): void {
  if (!scale) return;
  const tonicHz = midiToHz(sequence[0]);
  getPiano().triggerAttackRelease(tonicHz, "2n");
}

// ---- game loop ----
async function startGame(): Promise<void> {
  if (!scale || running) return;
  startBtn.disabled = true;
  loadStatus.textContent = "";
  try {
    await Tone.start();
    await tracker.start();
  } catch {
    loadStatus.textContent = "마이크를 사용할 수 없어요. 권한을 확인해 주세요.";
    loadStatus.className = "status is-error";
    startBtn.disabled = false;
    return;
  }
  // give the player a moment to hear the reference before the first target
  playReference();
  setTimeout(() => {
    running = true;
    stopBtn.disabled = false;
    stepIdx = 0;
    holdTime = 0;
    stepResults = [];
    refreshLadder();
    beginStep();
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }, 800);
}

function beginStep(): void {
  if (!scale) return;
  stepStartedAt = performance.now();
  stepCentsSum = 0;
  stepCentsCount = 0;
  holdTime = 0;
  const target = sequence[stepIdx];
  setOrb("none", SOLFEGE[stepIdx], midiToName(target));
  hudProgress.textContent = `${stepIdx} / ${sequence.length}`;
}

function tick(now: number): void {
  if (!running) return;
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  const target = sequence[stepIdx];
  const sample = tracker.sample();
  let verdict: Verdict = "none";

  if (sample.hz !== null) {
    const cents = centsOff(sample.hz, target);
    hudCents.textContent = `${cents >= 0 ? "+" : ""}${cents.toFixed(0)} ¢`;
    verdict = classify(cents);
    // Only count the "passing" samples toward the step's average accuracy.
    if (verdict === "perfect") {
      stepCentsSum += Math.abs(cents);
      stepCentsCount++;
      holdTime += dt;
    } else {
      // Off-pitch decays the hold meter so it has to be sustained, not flickered.
      holdTime = Math.max(0, holdTime - dt * 2);
    }
  } else {
    hudCents.textContent = "— ¢";
    holdTime = Math.max(0, holdTime - dt);
  }

  setOrb(verdict, SOLFEGE[stepIdx], midiToName(target));
  holdBar.style.width = `${Math.min(100, (holdTime / HOLD_SECONDS) * 100)}%`;

  if (holdTime >= HOLD_SECONDS) {
    completeStep();
  }

  rafId = requestAnimationFrame(tick);
}

function completeStep(): void {
  const secs = (performance.now() - stepStartedAt) / 1000;
  const avg = stepCentsCount > 0 ? stepCentsSum / stepCentsCount : 0;
  stepResults.push({
    targetMidi: sequence[stepIdx],
    seconds: secs,
    avgCents: avg,
  });
  stepIdx++;
  refreshLadder();
  hudProgress.textContent = `${stepIdx} / ${sequence.length}`;
  if (stepIdx >= sequence.length) {
    finishGame();
  } else {
    beginStep();
  }
}

function finishGame(): void {
  running = false;
  cancelAnimationFrame(rafId);
  tracker.stop();
  stopBtn.disabled = true;
  startBtn.disabled = false;
  showResults();
}

function stopGame(): void {
  if (!running) return;
  running = false;
  cancelAnimationFrame(rafId);
  tracker.stop();
  stopBtn.disabled = true;
  startBtn.disabled = false;
  // partial run still gets a result card if any step completed
  if (stepResults.length > 0) showResults();
}

// ---- pitch -> colour ----
function classify(cents: number): Verdict {
  const abs = Math.abs(cents);
  if (abs <= PERFECT_CENTS) return "perfect";
  if (abs <= MILD_CENTS) return cents < 0 ? "lo-mild" : "hi-mild";
  return cents < 0 ? "lo" : "hi";
}

function setOrb(verdict: Verdict, solfege: string, noteName: string): void {
  orb.className = "orb" + (verdict === "none" ? "" : ` is-${verdict}`);
  orbSolfege.textContent = solfege;
  orbNote.textContent = noteName;
}

// ---- results ----
function showResults(): void {
  gamePanel.classList.add("hidden");
  resultsPanel.classList.remove("hidden");
  const cleared = stepResults.length;
  const totalTime = stepResults.reduce((s, r) => s + r.seconds, 0);
  const avgCents =
    cleared > 0
      ? stepResults.reduce((s, r) => s + r.avgCents, 0) / cleared
      : 0;
  const fastest =
    cleared > 0 ? Math.min(...stepResults.map((r) => r.seconds)) : 0;

  const cells: [string, string | number][] = [
    ["통과한 음", `${cleared} / ${sequence.length}`],
    ["총 시간", `${totalTime.toFixed(1)} s`],
    ["평균 오차", `${avgCents.toFixed(1)} ¢`],
    ["가장 빠른 음", `${fastest.toFixed(2)} s`],
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

// ---- wire-up ----
startBtn.addEventListener("click", () => void startGame());
refBtn.addEventListener("click", playReference);
stopBtn.addEventListener("click", stopGame);
againBtn.addEventListener("click", () => {
  if (scale) selectScale(scale);
});
pickBtn.addEventListener("click", () => {
  resultsPanel.classList.add("hidden");
  gamePanel.classList.add("hidden");
  setupPanel.classList.remove("hidden");
});

// ---- init ----
buildScaleList();
