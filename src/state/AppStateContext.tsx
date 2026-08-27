import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppState,
  CompletedSession,
  ExerciseTuning,
  LoggedSet,
  Mode,
  Settings,
} from '../types';
import { applyModeExpiry, flushState, loadState, saveState, seedState } from './store';
import { computeStreak, tunedSession } from './selectors';
import { canSubstitute, coerceTuning, compositionOf } from './tuning';
import { EXERCISE_BY_ID } from '../data/exercises';
import { SESSION_BY_ID } from '../data/sessions';
import { setHapticsEnabled } from '../lib/haptics';
import { todayKey } from '../lib/time';

interface Api {
  state: AppState;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Pass null to restore the seed prescription for that exercise. */
  setTuning: (exerciseId: string, tuning: ExerciseTuning | null) => void;
  resetAllTuning: () => void;
  /** Swap one movement for another. Same block only. */
  replaceExercise: (sessionId: string, exerciseId: string, substituteId: string) => void;
  /** Append a movement; it lands at the end of its own block. */
  addExercise: (sessionId: string, exerciseId: string) => void;
  removeExercise: (sessionId: string, exerciseId: string) => void;
  /** Move an exercise within its block. Blocks themselves never move. */
  moveExercise: (sessionId: string, exerciseId: string, direction: -1 | 1) => void;
  resetComposition: (sessionId: string) => void;

  beginSession: (sessionId: string) => void;
  setStageIndex: (i: number) => void;
  logSet: (set: LoggedSet) => void;
  abandonSession: () => void;
  finishSession: (opts: { note?: string; painFlag: boolean }) => CompletedSession | null;

  replaceState: (next: AppState) => void;
  resetAll: () => void;
}

const Ctx = createContext<Api | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist (debounced), and flush on the way out so nothing is lost when the
  // phone backgrounds the tab mid-set.
  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const flush = () => flushState();
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, []);

  // The mode override expires at midnight; re-check whenever the app is
  // brought back to the foreground rather than running a timer.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      setState((s) => {
        const next = applyModeExpiry(s);
        return next === s ? s : next;
      });
    };
    document.addEventListener('visibilitychange', recheck);
    return () => document.removeEventListener('visibilitychange', recheck);
  }, []);

  // Theme class on <html>. The one place mode touches the DOM — no component
  // below this ever needs to know which mode it is in.
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('mode-day', state.mode === 'day');
    el.classList.toggle('mode-night', state.mode === 'night');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', state.mode === 'day' ? '#1a1d23' : '#121322');
  }, [state.mode]);

  useEffect(() => {
    setHapticsEnabled(state.settings.haptics);
  }, [state.settings.haptics]);

  const setMode = useCallback((mode: Mode) => {
    setState((s) => ({ ...s, mode, modeOverrideDate: todayKey() }));
  }, []);

  const toggleMode = useCallback(() => {
    setState((s) => ({
      ...s,
      mode: s.mode === 'day' ? 'night' : 'day',
      modeOverrideDate: todayKey(),
    }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const setTuning = useCallback((exerciseId: string, tuning: ExerciseTuning | null) => {
    setState((s) => {
      const next = { ...s.tuning };
      const cleaned = tuning ? coerceTuning(tuning) : null;
      const seed = EXERCISE_BY_ID[exerciseId];

      // Values matching the seed are dropped rather than stored, so "adjusted"
      // means genuinely different and Reset has something to restore to.
      const diff: ExerciseTuning = {};
      if (cleaned && seed) {
        if (
          cleaned.repScheme &&
          (cleaned.repScheme.length !== seed.repScheme.length ||
            cleaned.repScheme.some((r, i) => r !== seed.repScheme[i]))
        ) {
          diff.repScheme = cleaned.repScheme;
        }
        if (cleaned.holdSeconds !== undefined && cleaned.holdSeconds !== seed.holdSeconds) {
          diff.holdSeconds = cleaned.holdSeconds;
        }
        if (
          cleaned.durationSeconds !== undefined &&
          cleaned.durationSeconds !== seed.durationSeconds
        ) {
          diff.durationSeconds = cleaned.durationSeconds;
        }
        if (cleaned.distanceM !== undefined && cleaned.distanceM !== seed.distanceM) {
          diff.distanceM = cleaned.distanceM;
        }
        if (cleaned.restSeconds !== undefined && cleaned.restSeconds !== seed.restSeconds) {
          diff.restSeconds = cleaned.restSeconds;
        }
      }

      if (Object.keys(diff).length === 0) delete next[exerciseId];
      else next[exerciseId] = diff;

      return { ...s, tuning: next };
    });
  }, []);

  const resetAllTuning = useCallback(() => {
    setState((s) => ({ ...s, tuning: {} }));
  }, []);

  /** Every session edit is the same shape: rewrite that session's id list. */
  const editComposition = useCallback(
    (sessionId: string, edit: (ids: string[]) => string[] | null) => {
      setState((s) => {
        const seed = SESSION_BY_ID[sessionId];
        if (!seed) return s;

        const current = compositionOf(seed, s.composition);
        const next = edit(current);
        if (!next) return s;

        const composition = { ...s.composition };
        const seedIds = seed.exercises.map((e) => e.id);
        // Back to the seed means no stored composition at all, so a later
        // change to the programme itself still reaches this session.
        if (next.length === seedIds.length && next.every((id, i) => id === seedIds[i])) {
          delete composition[sessionId];
        } else {
          composition[sessionId] = next;
        }
        return { ...s, composition };
      });
    },
    [],
  );

  const replaceExercise = useCallback(
    (sessionId: string, exerciseId: string, substituteId: string) => {
      editComposition(sessionId, (ids) => {
        if (!canSubstitute(exerciseId, substituteId) || ids.includes(substituteId)) return null;
        const at = ids.indexOf(exerciseId);
        if (at < 0) return null;
        const next = [...ids];
        next[at] = substituteId;
        return next;
      });
    },
    [editComposition],
  );

  const addExercise = useCallback(
    (sessionId: string, exerciseId: string) => {
      editComposition(sessionId, (ids) => {
        if (ids.includes(exerciseId) || !EXERCISE_BY_ID[exerciseId]) return null;
        // Appended plainly; resolveSession sorts it into its block on read.
        return [...ids, exerciseId];
      });
    },
    [editComposition],
  );

  const removeExercise = useCallback(
    (sessionId: string, exerciseId: string) => {
      editComposition(sessionId, (ids) =>
        ids.length <= 1 ? null : ids.filter((id) => id !== exerciseId),
      );
    },
    [editComposition],
  );

  const moveExercise = useCallback(
    (sessionId: string, exerciseId: string, direction: -1 | 1) => {
      setState((s) => {
        const session = tunedSession(s, sessionId);
        const seed = SESSION_BY_ID[sessionId];
        if (!session || !seed) return s;

        // Read the positions off the resolved session, so what moves is what
        // the user is looking at, then write the whole order back.
        const shown = session.exercises.map((e) => e.id);
        const from = shown.indexOf(exerciseId);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= shown.length) return s;
        if (session.exercises[from]?.block !== session.exercises[to]?.block) return s;

        const next = [...shown];
        [next[from], next[to]] = [next[to] as string, next[from] as string];
        return { ...s, composition: { ...s.composition, [sessionId]: next } };
      });
    },
    [],
  );

  const resetComposition = useCallback((sessionId: string) => {
    setState((s) => {
      const composition = { ...s.composition };
      delete composition[sessionId];
      return { ...s, composition };
    });
  }, []);

  const beginSession = useCallback((sessionId: string) => {
    setState((s) => ({
      ...s,
      activeSession: {
        sessionId,
        startedAt: new Date().toISOString(),
        sets: [],
        // Straight onto the first stage: Begin is one press, and the elapsed
        // clock starts here rather than when the trailhead was opened.
        stageIndex: 0,
      },
    }));
  }, []);

  const setStageIndex = useCallback((i: number) => {
    setState((s) =>
      s.activeSession ? { ...s, activeSession: { ...s.activeSession, stageIndex: i } } : s,
    );
  }, []);

  const logSet = useCallback((set: LoggedSet) => {
    setState((s) => {
      if (!s.activeSession) return s;
      // Re-logging the same set overwrites rather than duplicating: the user
      // can walk back a stage and redo a set, and history should show one.
      const sets = s.activeSession.sets.filter(
        (x) => !(x.exerciseId === set.exerciseId && x.setIndex === set.setIndex),
      );
      sets.push(set);
      const lastWeights =
        typeof set.weightKg === 'number' && set.weightKg > 0
          ? { ...s.lastWeights, [set.exerciseId]: set.weightKg }
          : s.lastWeights;
      return { ...s, activeSession: { ...s.activeSession, sets }, lastWeights };
    });
  }, []);

  const abandonSession = useCallback(() => {
    setState((s) => ({ ...s, activeSession: null }));
  }, []);

  const finishSession = useCallback((opts: { note?: string; painFlag: boolean }) => {
    const active = stateRef.current.activeSession;
    if (!active) return null;

    // Freeze what was prescribed today, for the exercises actually worked, so a
    // later adjustment cannot rewrite whether this session counted as clean.
    const worked = new Set(active.sets.map((s) => s.exerciseId));
    const session = tunedSession(stateRef.current, active.sessionId);
    const targets: Record<string, number[]> = {};
    for (const ex of session?.exercises ?? []) {
      if (worked.has(ex.id)) targets[ex.id] = [...ex.repScheme];
    }

    const completed: CompletedSession = {
      sessionId: active.sessionId,
      date: todayKey(),
      startedAt: active.startedAt,
      finishedAt: new Date().toISOString(),
      sets: [...active.sets].sort(
        (a, b) => a.completedAt.localeCompare(b.completedAt) || a.setIndex - b.setIndex,
      ),
      painFlag: opts.painFlag,
      ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
      ...(Object.keys(targets).length > 0 ? { targets } : {}),
    };

    setState((s) => {
      const history = [...s.history, completed];
      return { ...s, history, activeSession: null, streak: computeStreak(history) };
    });
    return completed;
  }, []);

  const replaceState = useCallback((next: AppState) => {
    setState({ ...next, streak: computeStreak(next.history) });
  }, []);

  const resetAll = useCallback(() => {
    setState(seedState());
  }, []);

  const api = useMemo<Api>(
    () => ({
      state,
      setMode,
      toggleMode,
      updateSettings,
      setTuning,
      resetAllTuning,
      replaceExercise,
      addExercise,
      removeExercise,
      moveExercise,
      resetComposition,
      beginSession,
      setStageIndex,
      logSet,
      abandonSession,
      finishSession,
      replaceState,
      resetAll,
    }),
    [
      state,
      setMode,
      toggleMode,
      updateSettings,
      setTuning,
      resetAllTuning,
      replaceExercise,
      addExercise,
      removeExercise,
      moveExercise,
      resetComposition,
      beginSession,
      setStageIndex,
      logSet,
      abandonSession,
      finishSession,
      replaceState,
      resetAll,
    ],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp(): Api {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppStateProvider');
  return ctx;
}
