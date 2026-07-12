/**
 * Hit judging for the timpani rhythm game.
 *
 * Each timpani note from the score becomes a target on a lane. When the player
 * presses that lane's key we find the nearest unjudged target on that lane and
 * grade it by timing error. Targets that pass their window unhit are misses.
 */
import type { TimpaniNote } from "./musicxml";

export type Verdict = "perfect" | "good" | "miss";

export interface JudgeWindows {
  perfect: number; // seconds
  good: number;
}

// Standard rhythm-game windows (DDR/Taiko territory). Generous enough to be
// fun, tight enough to reward accuracy. Latency compensation (see main.ts)
// must be applied to the press time *before* it reaches the judge.
export const DEFAULT_WINDOWS: JudgeWindows = {
  perfect: 0.08,
  good: 0.16,
};

export interface Target extends TimpaniNote {
  lane: number;
  judged: boolean;
  verdict: Verdict | null;
}

export interface HitResult {
  verdict: Verdict;
  errorMs: number;
  target: Target | null;
}

export interface ScoreState {
  perfect: number;
  good: number;
  miss: number;
  combo: number;
  maxCombo: number;
  points: number;
}

const POINTS: Record<Verdict, number> = { perfect: 100, good: 50, miss: 0 };

export class Judge {
  readonly targets: Target[];
  private readonly windows: JudgeWindows;
  readonly score: ScoreState = {
    perfect: 0,
    good: 0,
    miss: 0,
    combo: 0,
    maxCombo: 0,
    points: 0,
  };

  constructor(
    notes: TimpaniNote[],
    drums: string[],
    windows: JudgeWindows = DEFAULT_WINDOWS,
  ) {
    this.windows = windows;
    this.targets = notes.map((n) => ({
      ...n,
      lane: Math.max(0, drums.indexOf(n.drum)),
      judged: false,
      verdict: null,
    }));
  }

  /**
   * Player pressed `lane` at song time `now`. Grade the nearest unjudged
   * target on that lane within the good window.
   */
  press(lane: number, now: number): HitResult {
    let best: Target | null = null;
    let bestErr = Infinity;

    for (const t of this.targets) {
      if (t.judged || t.lane !== lane) continue;
      const err = Math.abs(t.time - now);
      if (err < bestErr) {
        bestErr = err;
        best = t;
      }
    }

    if (!best || bestErr > this.windows.good) {
      // pressed with nothing in range — counts against the combo, no target
      this.score.combo = 0;
      return { verdict: "miss", errorMs: 0, target: null };
    }

    const verdict: Verdict =
      bestErr <= this.windows.perfect ? "perfect" : "good";
    best.judged = true;
    best.verdict = verdict;
    this.applyVerdict(verdict);
    return {
      verdict,
      errorMs: (now - best.time) * 1000,
      target: best,
    };
  }

  /**
   * Call every frame: any target whose good window has fully passed without a
   * hit becomes a miss. Returns the targets that just missed (for UI).
   */
  collectMisses(now: number): Target[] {
    const missed: Target[] = [];
    for (const t of this.targets) {
      if (!t.judged && now - t.time > this.windows.good) {
        t.judged = true;
        t.verdict = "miss";
        this.applyVerdict("miss");
        missed.push(t);
      }
    }
    return missed;
  }

  private applyVerdict(v: Verdict): void {
    this.score[v]++;
    this.score.points += POINTS[v];
    if (v === "miss") {
      this.score.combo = 0;
    } else {
      this.score.combo++;
      this.score.maxCombo = Math.max(this.score.maxCombo, this.score.combo);
      // combo bonus, capped so it stays gentle
      this.score.points += Math.min(this.score.combo, 20);
    }
  }

  get total(): number {
    return this.targets.length;
  }

  get accuracy(): number {
    const done = this.score.perfect + this.score.good + this.score.miss;
    if (done === 0) return 0;
    return (this.score.perfect + this.score.good * 0.5) / done;
  }
}
