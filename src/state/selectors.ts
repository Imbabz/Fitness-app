import type { AppState, CompletedSession, Exercise, LoggedSet, Session } from '../types';
import { ROTATION, SESSION_BY_ID } from '../data/sessions';
import { EXERCISE_BY_ID } from '../data/exercises';
import { addDays, daysBetween, todayKey } from '../lib/time';
import { resolveSession } from './tuning';

/** Progression thresholds differ by block and must not be unified. */
export const PROGRESSION_THRESHOLD = { main: 2, spine: 4 } as const;

export function gymHistory(state: AppState): CompletedSession[] {
  return state.history.filter((h) => h.sessionId !== 'daily');
}

/** Next in the A → B → C cycle after the last gym session completed. */
export function nextSessionId(state: AppState): 'A' | 'B' | 'C' {
  const last = gymHistory(state).at(-1);
  if (!last) return 'A';
  const idx = ROTATION.indexOf(last.sessionId as 'A' | 'B' | 'C');
  if (idx === -1) return 'A';
  return ROTATION[(idx + 1) % ROTATION.length] as 'A' | 'B' | 'C';
}

export function nextSession(state: AppState): Session {
  return tunedSession(state, nextSessionId(state)) as Session;
}

/**
 * The single way to read a session. Everything user-facing goes through here so
 * an adjustment shows up in the preview, the stages and the trackers alike.
 */
export function tunedSession(state: AppState, sessionId: string): Session | null {
  const session = SESSION_BY_ID[sessionId];
  return session ? resolveSession(session, state) : null;
}

export function dailyDoneOn(state: AppState, date: string): boolean {
  return state.history.some((h) => h.sessionId === 'daily' && h.date === date);
}

export function dailyDoneToday(state: AppState): boolean {
  return dailyDoneOn(state, todayKey());
}

export function sessionsOn(state: AppState, date: string): CompletedSession[] {
  return state.history.filter((h) => h.date === date);
}

/** The last 7 days, oldest first. Drives the week strip. */
export function weekStrip(state: AppState): Array<{
  date: string;
  gym: string | null;
  daily: boolean;
}> {
  const today = todayKey();
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    const done = sessionsOn(state, date);
    return {
      date,
      gym: done.find((d) => d.sessionId !== 'daily')?.sessionId ?? null,
      daily: done.some((d) => d.sessionId === 'daily'),
    };
  });
}

/**
 * Recompute the streak from history rather than incrementing a counter — a
 * counter drifts the first time a session is deleted or imported.
 */
export function computeStreak(history: CompletedSession[]): {
  current: number;
  longest: number;
  lastDailyDate: string | null;
} {
  const dates = [...new Set(history.filter((h) => h.sessionId === 'daily').map((h) => h.date))].sort();
  if (dates.length === 0) return { current: 0, longest: 0, lastDailyDate: null };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    run = daysBetween(dates[i - 1] as string, dates[i] as string) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  // The current run only counts if it reaches today or yesterday — miss two
  // days and the streak is genuinely broken.
  const last = dates.at(-1) as string;
  const gap = daysBetween(last, todayKey());
  const current = gap <= 1 ? run : 0;

  return { current, longest, lastDailyDate: last };
}

// ── Load history ───────────────────────────────────────────────────────────

export function setsFor(history: CompletedSession[], exerciseId: string): LoggedSet[] {
  return history.flatMap((h) => h.sets.filter((s) => s.exerciseId === exerciseId));
}

/** Heaviest weight ever logged for an exercise, ignoring the given session. */
export function bestWeight(
  history: CompletedSession[],
  exerciseId: string,
  excludeStartedAt?: string,
): number | null {
  const weights = history
    .filter((h) => h.startedAt !== excludeStartedAt)
    .flatMap((h) => h.sets)
    .filter((s) => s.exerciseId === exerciseId && typeof s.weightKg === 'number')
    .map((s) => s.weightKg as number);
  return weights.length ? Math.max(...weights) : null;
}

export interface PersonalRecord {
  exerciseId: string;
  name: string;
  weightKg: number;
  previous: number | null;
}

/** Weight PRs set by the sets just logged, versus everything before them. */
export function detectPRs(history: CompletedSession[], sets: LoggedSet[]): PersonalRecord[] {
  const byExercise = new Map<string, number>();
  for (const s of sets) {
    if (typeof s.weightKg !== 'number') continue;
    byExercise.set(s.exerciseId, Math.max(byExercise.get(s.exerciseId) ?? 0, s.weightKg));
  }

  const prs: PersonalRecord[] = [];
  for (const [exerciseId, weightKg] of byExercise) {
    if (weightKg <= 0) continue;
    const previous = bestWeight(history, exerciseId);
    if (previous === null || weightKg > previous) {
      prs.push({
        exerciseId,
        name: EXERCISE_BY_ID[exerciseId]?.name ?? exerciseId,
        weightKg,
        previous,
      });
    }
  }
  return prs.sort((a, b) => b.weightKg - a.weightKg);
}

// ── Domain rules ───────────────────────────────────────────────────────────

/**
 * Did this session hit every prescribed set at or above its rep target?
 *
 * Judged against the scheme frozen into the session when it was finished, so
 * lowering a target later cannot retroactively turn past sessions clean and
 * raise a progression prompt that was never earned.
 */
export function wasClean(session: CompletedSession, exercise: Exercise): boolean {
  const scheme = session.targets?.[exercise.id] ?? exercise.repScheme;
  const logged = session.sets.filter((s) => s.exerciseId === exercise.id);
  if (logged.length < scheme.length) return false;
  return scheme.every((target, i) => {
    const set = logged.find((s) => s.setIndex === i);
    return !!set && set.reps >= target;
  });
}

/**
 * "Ready to add load?" — full prescription hit cleanly across the threshold
 * number of consecutive sessions containing this exercise.
 *
 * Two sessions for main work, four for the spine block. This asymmetry is a
 * medical requirement, not a tuning knob.
 */
export function progressionReady(state: AppState, exercise: Exercise): boolean {
  if (!exercise.loadTracked) return false;
  const threshold =
    exercise.block === 'spine' ? PROGRESSION_THRESHOLD.spine : PROGRESSION_THRESHOLD.main;

  const relevant = state.history.filter((h) => h.sets.some((s) => s.exerciseId === exercise.id));
  if (relevant.length < threshold) return false;

  return relevant.slice(-threshold).every((h) => wasClean(h, exercise));
}

/**
 * Was a pain flag raised in the most recent session that shared spine work with
 * this one? Surfaces a banner; it never adjusts anything by itself.
 */
export function painFlagFollowUp(state: AppState, session: Session): CompletedSession | null {
  const spineIds = session.exercises.filter((e) => e.block === 'spine').map((e) => e.id);
  if (spineIds.length === 0) return null;

  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i] as CompletedSession;
    const overlaps = h.sets.some((s) => spineIds.includes(s.exerciseId));
    if (!overlaps) continue;
    // Only the most recent overlapping session matters — once a clean session
    // follows a flagged one, the banner clears.
    return h.painFlag ? h : null;
  }
  return null;
}

/** Three gym sessions inside four days is worth a soft word. */
export function isTrainingDense(state: AppState): boolean {
  const today = todayKey();
  const recent = gymHistory(state).filter((h) => daysBetween(h.date, today) <= 3);
  return new Set(recent.map((h) => h.date)).size >= 3;
}

export function suggestedWeight(state: AppState, exercise: Exercise): number {
  return state.lastWeights[exercise.id] ?? 0;
}
