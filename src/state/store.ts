import type { AppState, Mode } from '../types';
import { todayKey } from '../lib/time';

/** Versioned so a schema change can migrate rather than corrupt. */
export const STORAGE_KEY = 'ridge:state:v1';

/** Before 18:00 → day, after → night. */
export const NIGHT_HOUR = 18;

export function defaultModeForNow(now: Date = new Date()): Mode {
  return now.getHours() < NIGHT_HOUR ? 'day' : 'night';
}

export function seedState(): AppState {
  return {
    version: 1,
    mode: defaultModeForNow(),
    modeOverrideDate: null,
    history: [],
    activeSession: null,
    lastWeights: {},
    streak: { current: 0, longest: 0, lastDailyDate: null },
    settings: {
      restDefaultSeconds: 90,
      soundOnTimerEnd: false,
      haptics: true,
      autoChain: {},
    },
  };
}

/**
 * Rebuild a trusted AppState from whatever was in localStorage. Anything
 * missing or of the wrong shape falls back to the seed value — a corrupt store
 * must degrade, never white-screen.
 */
export function coerceState(raw: unknown): AppState {
  const seed = seedState();
  if (typeof raw !== 'object' || raw === null) return seed;
  const o = raw as Partial<AppState>;

  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const rec = (v: unknown): Record<string, number> => {
    if (typeof v !== 'object' || v === null) return {};
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
    }
    return out;
  };
  const boolRec = (v: unknown): Record<string, boolean> => {
    if (typeof v !== 'object' || v === null) return {};
    const out: Record<string, boolean> = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === 'boolean') out[k] = val;
    }
    return out;
  };

  const settings = (o.settings ?? {}) as Partial<AppState['settings']>;
  const streak = (o.streak ?? {}) as Partial<AppState['streak']>;

  return {
    version: 1,
    mode: o.mode === 'night' ? 'night' : o.mode === 'day' ? 'day' : seed.mode,
    modeOverrideDate: typeof o.modeOverrideDate === 'string' ? o.modeOverrideDate : null,
    history: arr<AppState['history'][number]>(o.history).filter(
      (h) => h && typeof h.sessionId === 'string' && typeof h.date === 'string',
    ),
    activeSession:
      o.activeSession && typeof o.activeSession.sessionId === 'string'
        ? {
            sessionId: o.activeSession.sessionId,
            startedAt: o.activeSession.startedAt ?? new Date().toISOString(),
            sets: arr(o.activeSession.sets),
            stageIndex:
              typeof o.activeSession.stageIndex === 'number' ? o.activeSession.stageIndex : -1,
          }
        : null,
    lastWeights: rec(o.lastWeights),
    streak: {
      current: typeof streak.current === 'number' ? streak.current : 0,
      longest: typeof streak.longest === 'number' ? streak.longest : 0,
      lastDailyDate: typeof streak.lastDailyDate === 'string' ? streak.lastDailyDate : null,
    },
    settings: {
      restDefaultSeconds:
        typeof settings.restDefaultSeconds === 'number' ? settings.restDefaultSeconds : 90,
      soundOnTimerEnd: settings.soundOnTimerEnd === true,
      haptics: settings.haptics !== false,
      autoChain: boolRec(settings.autoChain),
    },
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    return applyModeExpiry(coerceState(JSON.parse(raw)));
  } catch {
    // Corrupt JSON, disabled storage, private-mode quota — all the same to us.
    return seedState();
  }
}

/** A manual mode override lasts until the end of that calendar day. */
export function applyModeExpiry(state: AppState, now: Date = new Date()): AppState {
  if (state.modeOverrideDate === todayKey(now)) return state;
  return { ...state, modeOverrideDate: null, mode: defaultModeForNow(now) };
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pending: AppState | null = null;

/** Debounced to 500ms — see CLAUDE.md. Never write on every keystroke. */
export function saveState(state: AppState) {
  pending = state;
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    flushState();
  }, 500);
}

export function flushState() {
  if (!pending) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // Quota or Safari private mode. The session continues in memory; losing
    // persistence is bad but white-screening mid-set is worse.
  }
  pending = null;
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
  pending = null;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): AppState {
  return coerceState(JSON.parse(json));
}
