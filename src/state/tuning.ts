import type { Exercise, ExerciseTuning, Session } from '../types';
import { EXERCISES, EXERCISE_BY_ID } from '../data/exercises';
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

/**
 * Any movement in the library may stand in for any other in the same block.
 *
 * The library is the vetted set — dangerous movements are absent from it rather
 * than excluded by a list — so a second allow-list on top would be curation
 * rather than safety, and would put a judgement in the app's hands that belongs
 * to the user's. The block check is the part that carries weight: it is what
 * stops a substitution quietly moving work across the block ordering.
 */
export function canSubstitute(exerciseId: string, substituteId: string): boolean {
  const original = EXERCISE_BY_ID[exerciseId];
  const substitute = EXERCISE_BY_ID[substituteId];
  return (
    !!original &&
    !!substitute &&
    original.id !== substitute.id &&
    original.block === substitute.block
  );
}

/**
 * Everything that may stand in for an exercise: its whole block, minus itself,
 * minus anything the session already prescribes, and with same-named clones
 * collapsed — `a-cardio`, `b-cardio` and `c-cardio` are one movement to a
 * reader even though history keys them separately.
 */
export function substitutesFor(
  exercise: Exercise,
  sessionExerciseIds: string[],
): { suggested: Exercise[]; others: Exercise[] } {
  const inSession = new Set(sessionExerciseIds.filter((id) => id !== exercise.id));
  const seen = new Set<string>([exercise.name]);

  const usable = (candidate: Exercise | undefined): candidate is Exercise =>
    !!candidate &&
    canSubstitute(exercise.id, candidate.id) &&
    !inSession.has(candidate.id) &&
    !seen.has(candidate.name);

  // Suggestions first, in the order they were authored — that order carries
  // meaning, so it is not alphabetised the way the rest of the block is.
  const suggested: Exercise[] = [];
  for (const id of exercise.alternates ?? []) {
    const candidate = EXERCISE_BY_ID[id];
    if (!usable(candidate)) continue;
    seen.add(candidate.name);
    suggested.push(candidate);
  }

  const others: Exercise[] = [];
  for (const candidate of EXERCISES) {
    if (!usable(candidate)) continue;
    seen.add(candidate.name);
    others.push(candidate);
  }
  others.sort((a, b) => a.name.localeCompare(b.name));

  return { suggested, others };
}

/** Everything that could be added to a session: its blocks, minus what is in it. */
export function additionsFor(
  session: Session,
  sessionExerciseIds: string[],
): Array<{ block: Exercise['block']; exercises: Exercise[] }> {
  const inSession = new Set(sessionExerciseIds);
  const blocks = [...new Set(session.exercises.map((e) => e.block))].sort(
    (a, b) => BLOCK_ORDER[a] - BLOCK_ORDER[b],
  );

  return blocks
    .map((block) => {
      const seen = new Set<string>(
        EXERCISES.filter((e) => inSession.has(e.id)).map((e) => e.name),
      );
      const exercises: Exercise[] = [];
      for (const candidate of EXERCISES) {
        if (candidate.block !== block || inSession.has(candidate.id)) continue;
        if (seen.has(candidate.name)) continue;
        seen.add(candidate.name);
        exercises.push(candidate);
      }
      exercises.sort((a, b) => a.name.localeCompare(b.name));
      return { block, exercises };
    })
    .filter((g) => g.exercises.length > 0);
}

export interface Customisation {
  tuning: Record<string, ExerciseTuning>;
  composition: Record<string, string[]>;
}

/** Keeps ids that name a real exercise, in order, without repeats. */
export function coerceComposition(raw: unknown): Record<string, string[]> {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Record<string, string[]> = {};
  for (const [sessionId, ids] of Object.entries(raw)) {
    if (!Array.isArray(ids)) continue;
    const clean = [...new Set(ids.filter((v): v is string => typeof v === 'string'))].filter(
      (id) => EXERCISE_BY_ID[id],
    );
    if (clean.length > 0) out[sessionId] = clean;
  }
  return out;
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
  const stored = custom.composition[session.id];
  const seedIds = session.exercises.map((e) => e.id);
  const ids = stored?.length ? stored : seedIds;

  const resolved = ids.map((id) => EXERCISE_BY_ID[id]).filter((e): e is Exercise => !!e);

  // A session with no exercises would be a blank journey. Storage is scrubbed
  // on load, so this only fires if a composition names nothing real — but it is
  // the last line before the UI, and degrading to the seed beats degrading to
  // nothing.
  const exercises = (resolved.length > 0 ? resolved : session.exercises)
    // Block order is structural and wins over anything stored. A composition
    // listing spine work first still renders it last: that is CLAUDE.md rule 2,
    // kept in code rather than trusted to the UI that writes the list.
    .map((ex, i) => ({ ex, i }))
    .sort((a, b) => BLOCK_ORDER[a.ex.block] - BLOCK_ORDER[b.ex.block] || a.i - b.i)
    .map(({ ex }) => ex);

  const changed =
    exercises.length !== session.exercises.length ||
    exercises.some((ex, i) => ex.id !== session.exercises[i]?.id);

  return tuneSession(changed ? { ...session, exercises } : session, custom.tuning);
}

/** The list a session edit starts from — stored if there is one, else the seed. */
export function compositionOf(session: Session, composition: Record<string, string[]>): string[] {
  const stored = composition[session.id];
  return stored?.length ? [...stored] : session.exercises.map((e) => e.id);
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
