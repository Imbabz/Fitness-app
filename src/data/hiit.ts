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

export interface HiitConfig {
  level: HiitLevel;
  rounds: number;
}

export function defaultHiit(): HiitConfig {
  return { level: 'intermediate', rounds: DEFAULT_ROUNDS };
}

export function levelOf(config: HiitConfig): HiitLevelSpec {
  return HIIT_LEVEL_BY_ID[config.level] ?? (HIIT_LEVELS[1] as HiitLevelSpec);
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
