import type { Exercise, ExerciseTuning, Session } from '../types';
import { EXERCISE_BY_ID } from '../data/exercises';
import { BLOCK_ORDER } from '../data/sessions';

/*
 * User adjustments to the prescribed numbers, layered over the seed data at
 * read time. `data/exercises.ts` stays near-frozen — nothing here writes back
 * to it, and clearing a tuning restores the seed exactly.
 *
 * What is adjustable: how much work, and for how long. What is not: which
 * movements, their order, their block, or the Jefferson curl's tempo. Those are
 * the medical decisions (see CLAUDE.md) and they are deliberately absent from
 * `ExerciseTuning`.
 */

export const TUNING_LIMITS = {
  sets: { min: 1, max: 8 },
  reps: { min: 1, max: 99 },
  holdSeconds: { min: 1, max: 300 },
  durationSeconds: { min: 30, max: 5400 },
  distanceM: { min: 5, max: 500 },
  restSeconds: { min: 0, max: 600 },
} as const;

export function clampTo(range: { min: number; max: number }, value: number): number {
  if (!Number.isFinite(value)) return range.min;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

/** Drops keys that are absent or out of range, so a bad import cannot poison a session. */
export function coerceTuning(raw: unknown): ExerciseTuning | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Partial<ExerciseTuning>;
  const out: ExerciseTuning = {};

  if (Array.isArray(o.repScheme)) {
    const reps = o.repScheme
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
      .slice(0, TUNING_LIMITS.sets.max)
      .map((n) => clampTo(TUNING_LIMITS.reps, n));
    if (reps.length > 0) out.repScheme = reps;
  }

  const num = (v: unknown, range: { min: number; max: number }) =>
    typeof v === 'number' && Number.isFinite(v) ? clampTo(range, v) : undefined;

  const hold = num(o.holdSeconds, TUNING_LIMITS.holdSeconds);
  if (hold !== undefined) out.holdSeconds = hold;
  const duration = num(o.durationSeconds, TUNING_LIMITS.durationSeconds);
  if (duration !== undefined) out.durationSeconds = duration;
  const distance = num(o.distanceM, TUNING_LIMITS.distanceM);
  if (distance !== undefined) out.distanceM = distance;
  const rest = num(o.restSeconds, TUNING_LIMITS.restSeconds);
  if (rest !== undefined) out.restSeconds = rest;

  return Object.keys(out).length > 0 ? out : null;
}

export function coerceTuningMap(raw: unknown): Record<string, ExerciseTuning> {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Record<string, ExerciseTuning> = {};
  for (const [id, value] of Object.entries(raw)) {
    const tuning = coerceTuning(value);
    if (tuning) out[id] = tuning;
  }
  return out;
}

/**
 * The seed prescription is editorial, not generated — it carries wording like
 * "very light" that matters. So it is reused verbatim until the exercise is
 * actually adjusted, and only then rebuilt from the live numbers.
 */
export function describePrescription(ex: Exercise, seedPrescription: string): string {
  const parts: string[] = [];
  const uniform = ex.repScheme.every((r) => r === ex.repScheme[0]);

  if (ex.tracking === 'duration') {
    const seconds = ex.durationSeconds ?? 0;
    parts.push(seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} sec`);
  } else if (ex.tracking === 'distance') {
    parts.push(`${ex.sets} × ${ex.distanceM ?? 0} m`);
  } else {
    const scheme = uniform ? `${ex.sets} × ${ex.repScheme[0]}` : ex.repScheme.join(' / ');
    const perSide = ex.bilateral ? ' per side' : '';
    if (ex.tracking === 'hold') {
      parts.push(`${scheme}${perSide}`, `${ex.holdSeconds ?? 0}s holds`);
    } else {
      parts.push(`${scheme}${perSide}`);
    }
  }

  // Editorial qualifiers survive: any seed segment with no numbers in it, such
  // as "very light" on the Jefferson curl, which the skill treats as frozen.
  for (const segment of seedPrescription.split('·').map((s) => s.trim())) {
    if (segment && !/\d/.test(segment)) parts.push(segment);
  }

  if (ex.tempo) parts.push(`${ex.tempo.down}s down / ${ex.tempo.up}s up`);
  if (ex.restSeconds > 0) parts.push(`rest ${ex.restSeconds} sec`);

  return parts.join(' · ');
}

export function isTuned(tuning: ExerciseTuning | undefined): boolean {
  return !!tuning && Object.keys(tuning).length > 0;
}

/**
 * Apply a tuning to one exercise. `sets` is always derived from `repScheme`
 * so the two can never disagree — see CLAUDE.md rule 3.
 */
export function tuneExercise(ex: Exercise, tuning: ExerciseTuning | undefined): Exercise {
  if (!isTuned(tuning)) return ex;
  const t = tuning as ExerciseTuning;

  const repScheme = t.repScheme ?? ex.repScheme;
  const next: Exercise = {
    ...ex,
    repScheme,
    sets: repScheme.length,
    restSeconds: t.restSeconds ?? ex.restSeconds,
    ...(ex.holdSeconds !== undefined ? { holdSeconds: t.holdSeconds ?? ex.holdSeconds } : {}),
    ...(ex.durationSeconds !== undefined
      ? { durationSeconds: t.durationSeconds ?? ex.durationSeconds }
      : {}),
    ...(ex.distanceM !== undefined ? { distanceM: t.distanceM ?? ex.distanceM } : {}),
  };

  return { ...next, prescription: describePrescription(next, ex.prescription) };
}

/** Rough wall-clock estimate, used only once a session has been adjusted. */
function estimateMinutes(session: Session): number {
  const SECONDS_PER_REP = 4;
  const SECONDS_PER_CARRY = 35;

  const total = session.exercises.reduce((sum, ex) => {
    const reps = ex.repScheme.reduce((a, b) => a + b, 0);
    const sides = ex.bilateral ? 2 : 1;

    let work: number;
    if (ex.tracking === 'duration') work = (ex.durationSeconds ?? 0) * ex.sets;
    else if (ex.tracking === 'distance') work = SECONDS_PER_CARRY * ex.sets;
    else if (ex.tracking === 'hold') work = reps * (ex.holdSeconds ?? 0) * sides;
    else work = reps * SECONDS_PER_REP;

    return sum + work + ex.restSeconds * Math.max(0, ex.sets - 1);
  }, 0);

  return Math.max(1, Math.round(total / 60));
}

export function coerceSwaps(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Record<string, string> = {};
  for (const [id, sub] of Object.entries(raw)) {
    if (typeof sub === 'string' && isVettedSwap(id, sub)) out[id] = sub;
  }
  return out;
}

export function coerceOrder(raw: unknown): Record<string, string[]> {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Record<string, string[]> = {};
  for (const [sessionId, ids] of Object.entries(raw)) {
    if (!Array.isArray(ids)) continue;
    const clean = [...new Set(ids.filter((v): v is string => typeof v === 'string'))];
    if (clean.length > 0) out[sessionId] = clean;
  }
  return out;
}

/**
 * A swap is only honoured if the original itself lists it, and if the two sit
 * in the same block. Both halves matter: the first keeps substitution inside
 * the authored, medically vetted set rather than the whole library; the second
 * stops a swap quietly moving work across the block ordering.
 */
export function isVettedSwap(exerciseId: string, substituteId: string): boolean {
  const original = EXERCISE_BY_ID[exerciseId];
  const substitute = EXERCISE_BY_ID[substituteId];
  return (
    !!original &&
    !!substitute &&
    (original.alternates?.includes(substituteId) ?? false) &&
    original.block === substitute.block
  );
}

export interface Customisation {
  tuning: Record<string, ExerciseTuning>;
  swaps: Record<string, string>;
  order: Record<string, string[]>;
}

/**
 * The single place user customisation is layered over the seed: reorder, then
 * substitute, then apply the numbers.
 *
 * Ordering is by block first and the stored preference only second, so no
 * stored order — however it was written, imported or corrupted — can lift spine
 * work off the end of a session. That is CLAUDE.md rule 2, kept structural
 * rather than trusted to the UI.
 */
export function resolveSession(session: Session, custom: Customisation): Session {
  // Substitute first, then order. The stored order therefore holds the ids the
  // user is actually looking at, which is what the reorder controls hand back.
  // Undoing a swap drops that one exercise back to its seed position.
  let exercises = session.exercises.map((ex) => {
    const substituteId = custom.swaps[ex.id];
    if (!substituteId || !isVettedSwap(ex.id, substituteId)) return ex;
    return EXERCISE_BY_ID[substituteId] as Exercise;
  });

  const preferred = custom.order[session.id];
  if (preferred?.length) {
    const rank = new Map(preferred.map((id, i) => [id, i]));
    const at = (ex: Exercise) => rank.get(ex.id) ?? Number.MAX_SAFE_INTEGER;
    exercises = [...exercises].sort(
      (a, b) => BLOCK_ORDER[a.block] - BLOCK_ORDER[b.block] || at(a) - at(b),
    );
  }

  const changed = exercises.some((ex, i) => ex.id !== session.exercises[i]?.id);
  return tuneSession(changed ? { ...session, exercises } : session, custom.tuning);
}

/** A session with every adjustment applied. Untouched sessions pass through unchanged. */
export function tuneSession(session: Session, tuning: Record<string, ExerciseTuning>): Session {
  const touched = session.exercises.some((ex) => isTuned(tuning[ex.id]));
  if (!touched) return session;

  const next: Session = {
    ...session,
    exercises: session.exercises.map((ex) => tuneExercise(ex, tuning[ex.id])),
  };
  // The curated durationMin is only an estimate to begin with; once the numbers
  // have moved it would be misleading, so recompute rather than leave it stale.
  return { ...next, durationMin: estimateMinutes(next) };
}
