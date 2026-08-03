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
import type { AppState, CompletedSession, LoggedSet, Mode, Settings } from '../types';
import { applyModeExpiry, flushState, loadState, saveState, seedState } from './store';
import { computeStreak } from './selectors';
import { setHapticsEnabled } from '../lib/haptics';
import { todayKey } from '../lib/time';

interface Api {
  state: AppState;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  updateSettings: (patch: Partial<Settings>) => void;

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
