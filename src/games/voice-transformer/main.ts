/**
 * Voice transformer — game flow.
 *
 *  1. Pick an instrument.
 *  2. Hit record: one preparatory bar counts in audibly (tick tick tick tick).
 *  3. Recording starts exactly on real bar 1; the bar/beat lamps update with
 *     visual-only feedback (downbeat lamp grows).
 *  4. Hit stop: the voice is run through DDSP and the instrument version plays.
 */
import * as Tone from "tone";
import { Metronome, type BeatInfo } from "../lib/metronome";
import { MicRecorder } from "../lib/recorder";
import {
  INSTRUMENTS,
  TimbreTransfer,
  samplesToBuffer,
  type InstrumentId,
} from "./ddsp";

const BPM = 90;
const BEATS_PER_BAR = 4;
const COUNT_IN_BARS = 1;

// ---- DOM ----
const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const barLabel = $("barLabel");
const beatLamps = $("beatLamps");
const instrumentRow = $("instrumentRow");
const recordBtn = $<HTMLButtonElement>("recordBtn");
const playVoiceBtn = $<HTMLButtonElement>("playVoiceBtn");
const playInstrumentBtn = $<HTMLButtonElement>("playInstrumentBtn");
const statusEl = $("status");

// ---- state ----
type Phase = "idle" | "counting" | "recording" | "processing";
let phase: Phase = "idle";
let selectedInstrument: InstrumentId = "violin";

const recorder = new MicRecorder();
const transfer = new TimbreTransfer();
const audioCtx = new AudioContext();

let voiceBuffer: AudioBuffer | null = null;
let instrumentBuffer: AudioBuffer | null = null;

// ---- UI helpers ----
function setStatus(msg: string, kind: "" | "error" | "busy" = ""): void {
  statusEl.textContent = msg;
  statusEl.className = "status" + (kind ? ` is-${kind}` : "");
}

function buildLamps(): void {
  beatLamps.innerHTML = "";
  for (let i = 0; i < BEATS_PER_BAR; i++) {
    const lamp = document.createElement("div");
    lamp.className = "lamp" + (i === 0 ? " is-downbeat" : "");
    beatLamps.appendChild(lamp);
  }
}

function lightLamp(beatInBar: number): void {
  const lamps = beatLamps.children;
  for (let i = 0; i < lamps.length; i++) {
    lamps[i].classList.toggle("is-on", i === beatInBar);
  }
}

function clearLamps(): void {
  for (const lamp of beatLamps.children) lamp.classList.remove("is-on");
}

function buildInstrumentButtons(): void {
  for (const inst of INSTRUMENTS) {
    const btn = document.createElement("button");
    btn.className =
      "instrument-btn" + (inst.id === selectedInstrument ? " is-selected" : "");
    btn.innerHTML = `<span class="emoji">${inst.emoji}</span>${inst.label}`;
    btn.addEventListener("click", () => {
      if (phase !== "idle") return;
      selectedInstrument = inst.id;
      for (const el of instrumentRow.children) {
        el.classList.toggle("is-selected", el === btn);
      }
      // A new instrument invalidates the previous render.
      instrumentBuffer = null;
      playInstrumentBtn.disabled = true;
    });
    instrumentRow.appendChild(btn);
  }
}

// ---- beat handling ----
function onBeat(info: BeatInfo): void {
  lightLamp(info.beatInBar);
  if (info.isCountIn) {
    barLabel.textContent = `예비 마디 — ${info.beatInBar + 1}`;
    barLabel.classList.add("is-countin");
  } else {
    barLabel.textContent = `${info.bar} 마디째`;
    barLabel.classList.remove("is-countin");
  }
}

// ---- record flow ----
async function startRecording(): Promise<void> {
  if (phase !== "idle") return;

  try {
    setStatus("마이크 권한 확인 중…", "busy");
    await recorder.arm();
  } catch {
    setStatus("마이크를 사용할 수 없어요. 권한을 확인해 주세요.", "error");
    return;
  }

  // Load the pitch model while the user is about to count in — overlapping
  // the download with the count-in bar hides most of the latency.
  transfer.init((m) => setStatus(m, "busy")).catch(() => {
    /* surfaced later at transform time */
  });

  phase = "counting";
  recordBtn.disabled = true;
  playVoiceBtn.disabled = true;
  playInstrumentBtn.disabled = true;
  setStatus("예비 한 마디… 띡 소리에 맞춰 준비!", "busy");

  const metro = new Metronome({
    bpm: BPM,
    beatsPerBar: BEATS_PER_BAR,
    countInBars: COUNT_IN_BARS,
  });
  metro.onBeat(onBeat);

  // start() resolves the instant the count-in ends => real bar 1.
  await metro.start();

  phase = "recording";
  recorder.start();
  recordBtn.disabled = false;
  recordBtn.textContent = "■ 녹음 정지";
  recordBtn.classList.add("is-recording");
  setStatus("녹음 중! 다 부르면 정지를 누르세요.", "busy");

  // Hand the metronome to the stop handler via closure.
  activeMetro = metro;
}

let activeMetro: Metronome | null = null;

async function stopRecording(): Promise<void> {
  if (phase !== "recording") return;
  phase = "processing";

  recordBtn.disabled = true;
  recordBtn.textContent = "● 녹음 시작";
  recordBtn.classList.remove("is-recording");
  activeMetro?.dispose();
  activeMetro = null;
  clearLamps();
  barLabel.textContent = "변환 중…";
  barLabel.classList.remove("is-countin");

  try {
    voiceBuffer = await recorder.stop(audioCtx);
    recorder.release();
    playVoiceBtn.disabled = false;

    setStatus("멜로디를 악기로 바꾸는 중…", "busy");
    const samples = await transfer.transform(voiceBuffer, selectedInstrument, {
      onProgress: (m) => setStatus(m, "busy"),
    });
    instrumentBuffer = samplesToBuffer(samples, audioCtx);

    playInstrumentBtn.disabled = false;
    barLabel.textContent = "완성!";
    setStatus("▶ 악기 소리 버튼으로 결과를 들어보세요.");
    void play(instrumentBuffer); // auto-preview
  } catch (err) {
    console.error(err);
    barLabel.textContent = "앗…";
    setStatus(
      "변환에 실패했어요. 모델 로딩이 안 됐거나 녹음이 너무 짧을 수 있어요.",
      "error",
    );
  } finally {
    phase = "idle";
    recordBtn.disabled = false;
  }
}

// ---- playback ----
function play(buffer: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);
    src.onended = () => resolve();
    src.start();
  });
}

// ---- wire up ----
buildLamps();
buildInstrumentButtons();

recordBtn.addEventListener("click", () => {
  void (phase === "recording" ? stopRecording() : startRecording());
});
playVoiceBtn.addEventListener("click", () => {
  if (voiceBuffer) void play(voiceBuffer);
});
playInstrumentBtn.addEventListener("click", () => {
  if (instrumentBuffer) void play(instrumentBuffer);
});

// Tone needs a user gesture before audio; the record click provides it.
window.addEventListener("beforeunload", () => {
  recorder.release();
  transfer.dispose();
  Tone.getTransport().stop();
});
