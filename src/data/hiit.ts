/*
 * Turning a gym session into intervals.
 *
 * The timings are LitoBox's — 5 rounds, three levels at 35/25, 40/20 and
 * 45/15 — because that card is the reference this was asked for. The movements
 * from it are deliberately NOT here; see the note at the bottom of this file.
 *
 * ── What HIIT mode touches, and what it must never touch ───────────────────
 *
 * Only the **main block** becomes intervals. That is a medical constraint, not
 * a scoping decision, and `hiitSession()` enforces it rather than trusting the
 * UI:
 *
 *   - **The spine block stays as it is.** The McGill Big 3 are endurance holds
 *     judged on position, not on speed. Performed against a clock, fatigued,
 *     form degrades — and the way it degrades is into flexion, which is the one
 *     mechanism this whole programme exists to avoid. A "spine block sprint"
 *     would be the single worst feature this app could ship.
 *   - **The warm-up stays as it is.** Interval work needs more warm-up than
 *     straight sets, not less. Compressing it would be exactly backwards.
 *
 * Both rules hold whatever the session composition says, for the same reason
 * the spine block sorts last in code rather than in the view.
 */

export type HiitLevel = 'beginner' | 'intermediate' | 'advanced';

export interface HiitLevelSpec {
  id: HiitLevel;
  label: string;
  /** Seconds of work per round. */
  work: number;
  /** Seconds of rest before the next exercise. */
  rest: number;
}

export const HIIT_LEVELS: HiitLevelSpec[] = [
  { id: 'beginner', label: 'Débutant', work: 35, rest: 25 },
  { id: 'intermediate', label: 'Intermédiaire', work: 40, rest: 20 },
  { id: 'advanced', label: 'Avancé', work: 45, rest: 15 },
];

export const HIIT_LEVEL_BY_ID: Record<string, HiitLevelSpec> = Object.fromEntries(
  HIIT_LEVELS.map((l) => [l.id, l]),
);

export const DEFAULT_ROUNDS = 5;
export const MIN_ROUNDS = 2;
export const MAX_ROUNDS = 8;

/*
 * ── The three formats ──────────────────────────────────────────────────────
 *
 * Intervals and Tabata are timed: the clock decides when the bout ends and you
 * do as many quality reps as fit. Sequential is rep-counted: the rep target
 * decides when the bout ends and the clock is only there for the rest.
 *
 * The difference matters for this back. Under a clock, the last few seconds of
 * a fatigued bout are where form goes, so a timed station has to be a movement
 * that stays safe when it gets ugly — which is most of the circuit pool and
 * none of the Big 3. A rep-counted station lets you stop on the rep, so it is
 * the honest choice for anything where position is the point.
 *
 * EMOM and AMRAP are deliberately absent. Both reward squeezing more work into
 * a fixed window, which is the same incentive as racing a clock and a worse one
 * to put in front of someone with a disc protrusion.
 */
export type HiitFormat = 'intervals' | 'tabata' | 'sequential';

export interface HiitFormatSpec {
  id: HiitFormat;
  label: string;
  note: string;
  /** The clock ends the bout. False means the rep target does. */
  timed: boolean;
  /** Tabata is 20/10 × 8 and nothing else — the protocol is the point. */
  fixed?: { work: number; rest: number; rounds: number };
}

export const HIIT_FORMATS: HiitFormatSpec[] = [
  {
    id: 'intervals',
    label: 'Intervals',
    note: 'Work and rest on a clock',
    timed: true,
  },
  {
    id: 'tabata',
    label: 'Tabata',
    note: '20s on, 10s off, 8 rounds',
    timed: true,
    fixed: { work: 20, rest: 10, rounds: 8 },
  },
  {
    id: 'sequential',
    label: 'Sequential',
    note: 'Reps, not a clock, then rest',
    timed: false,
  },
];

export const HIIT_FORMAT_BY_ID: Record<string, HiitFormatSpec> = Object.fromEntries(
  HIIT_FORMATS.map((f) => [f.id, f]),
);

export interface HiitConfig {
  format: HiitFormat;
  level: HiitLevel;
  rounds: number;
}

export function defaultHiit(): HiitConfig {
  return { format: 'intervals', level: 'intermediate', rounds: DEFAULT_ROUNDS };
}

export function levelOf(config: HiitConfig): HiitLevelSpec {
  return HIIT_LEVEL_BY_ID[config.level] ?? (HIIT_LEVELS[1] as HiitLevelSpec);
}

export function formatOf(config: HiitConfig): HiitFormatSpec {
  return HIIT_FORMAT_BY_ID[config.format] ?? (HIIT_FORMATS[0] as HiitFormatSpec);
}

/**
 * What a config actually resolves to. One place decides how format, level and
 * rounds combine, so the panel's summary line and the session conversion can
 * never disagree about what is about to happen.
 */
export function specOf(config: HiitConfig): {
  work: number;
  rest: number;
  rounds: number;
  timed: boolean;
} {
  const format = formatOf(config);
  const level = levelOf(config);
  if (format.fixed) return { ...format.fixed, timed: format.timed };
  return {
    work: level.work,
    rest: level.rest,
    rounds: Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, Math.round(config.rounds))),
    timed: format.timed,
  };
}

/*
 * ── Why the LitoBox movements are not in this file ─────────────────────────
 *
 * The card the timings come from runs burpees, mountain climbers (twice),
 * spiderman planks, jump lunges and skipping. Five of those six map directly
 * onto the exclusion table in `.claude/skills/session-content/SKILL.md`:
 *
 *   - Burpees and both mountain climbers are repeated end-range lumbar flexion,
 *     performed fast and fatigued. That is the mechanism implicated in
 *     posterior disc protrusion, which is why crunches and sit-ups are already
 *     excluded; doing it at speed does not make it safer.
 *   - The spiderman plank drives knee to elbow, which is flexion plus rotation
 *     under load — the highest-risk combination for an annular tear and the one
 *     the exclusion list names explicitly.
 *   - Jump lunges land under fatigue, spiking axial compression on a disc.
 *
 * Skipping is the only tolerable one and is still repeated impact. So the
 * timings are borrowed and the movements are not: HIIT mode applies intervals
 * to the main work already in the programme, which is both safe and already
 * chosen for this back. Adding any of the six needs the owner's explicit
 * sign-off under CLAUDE.md rule 1, and has not been given.
 */
