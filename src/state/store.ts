import type { AppState, Block, Mode } from '../types';

const BLOCKS: Block[] = ['warmup', 'main', 'spine', 'mobility'];
const SYNTH_IDS: string[] = ['rain', 'waves', 'wind', 'fire', 'drone'];
import { todayKey } from '../lib/time';
import { coerceComposition, coerceTuningMap } from './tuning';
import { SESSIONS } from '../data/sessions';
import { EXERCISE_BY_ID } from '../data/exercises';
import { AMBIENT_KINDS, THEMES } from '../lib/ambient';
import { credentialsLook } from '../lib/library';
import type { AmbientKind } from '../lib/ambient';

/**
 * A constant bed, a session soundtrack, or a reference to one of the user's own
 * files. The track id is only a key into IndexedDB — a bogus one resolves to
 * nothing and the session simply plays nothing, so for those the shape is all
 * that needs checking.
 */
function isAmbientKind(v: unknown): v is AmbientKind {
  if (typeof v !== 'string') return false;
  if (AMBIENT_KINDS.some((k) => k.id === v)) return true;
  if (THEMES.some((t) => t.id === v)) return true;
  // A category is free text the user typed. An empty or absurd one resolves to
  // no tracks and plays nothing, so length is the only thing worth checking.
  if (v.startsWith('cat:')) return v.length > 4 && v.length <= 40;
  return /^track:[a-z0-9]+-[a-z0-9]+$/.test(v);
}

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
    tuning: {},
    composition: {},
    streak: { current: 0, longest: 0, lastDailyDate: null },
    settings: {
      restDefaultSeconds: 90,
      soundOnTimerEnd: false,
      haptics: true,
      autoChain: {},
      countdown: {},
      ambient: 'off',
      ambientLayer: 'off',
      ambientByBlock: {},
      library: null,
      musicAppMode: true,
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

  /** exerciseId → repScheme, keeping only entries that are usable rep arrays. */
  function coerceTargets(v: unknown): Record<string, number[]> | null {
    if (typeof v !== 'object' || v === null) return null;
    const out: Record<string, number[]> = {};
    for (const [id, scheme] of Object.entries(v)) {
      if (!Array.isArray(scheme)) continue;
      const reps = scheme.filter(
        (n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0,
      );
      if (reps.length === scheme.length && reps.length > 0) out[id] = reps;
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  /**
   * Composition replaced two earlier fields, `swaps` and `order`. A store
   * written before that still has them, so they are folded into a composition
   * once rather than dropped — losing a customisation silently would be worse
   * than carrying this for a while.
   */
  function readComposition(raw: Record<string, unknown>): Record<string, string[]> {
    const current = coerceComposition(raw.composition);
    if (Object.keys(current).length > 0) return current;

    const swaps = (typeof raw.swaps === 'object' && raw.swaps ? raw.swaps : {}) as Record<
      string,
      unknown
    >;
    const order = (typeof raw.order === 'object' && raw.order ? raw.order : {}) as Record<
      string,
      unknown
    >;
    if (Object.keys(swaps).length === 0 && Object.keys(order).length === 0) return {};

    const migrated: Record<string, string[]> = {};
    for (const session of SESSIONS) {
      let ids = session.exercises.map((e) => e.id);

      const preferred = order[session.id];
      if (Array.isArray(preferred)) {
        const rank = new Map(preferred.map((id, i) => [id, i]));
        ids = [...ids].sort(
          (a, b) =>
            (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER),
        );
      }

      const taken = new Set<string>();
      ids = ids.map((id) => {
        const sub = swaps[id];
        const replacement = typeof sub === 'string' ? EXERCISE_BY_ID[sub] : undefined;
        if (!replacement || taken.has(replacement.id) || replacement.block !== EXERCISE_BY_ID[id]?.block) {
          taken.add(id);
          return id;
        }
        taken.add(replacement.id);
        return replacement.id;
      });

      const seed = session.exercises.map((e) => e.id);
      if (ids.some((id, i) => id !== seed[i])) migrated[session.id] = ids;
    }
    return coerceComposition(migrated);
  }

  return {
    version: 1,
    mode: o.mode === 'night' ? 'night' : o.mode === 'day' ? 'day' : seed.mode,
    modeOverrideDate: typeof o.modeOverrideDate === 'string' ? o.modeOverrideDate : null,
    history: arr<AppState['history'][number]>(o.history)
      .filter((h) => h && typeof h.sessionId === 'string' && typeof h.date === 'string')
      // Frozen targets arrived after the first sessions were logged, so they
      // are optional: anything missing or malformed is dropped and wasClean()
      // falls back to the exercise's current scheme, exactly as it used to.
      .map((h) => {
        const targets = coerceTargets(h.targets);
        if (targets) return { ...h, targets };
        const { targets: _dropped, ...rest } = h;
        return rest;
      }),
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
    tuning: coerceTuningMap(o.tuning),
    composition: readComposition(o),
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
      countdown: boolRec(settings.countdown),
      ambient: isAmbientKind(settings.ambient) ? settings.ambient : 'off',
      ambientLayer: SYNTH_IDS.includes(settings.ambientLayer as string)
        ? (settings.ambientLayer as AppState['settings']['ambientLayer'])
        : 'off',
      library: credentialsLook(settings.library) ? settings.library : null,
      musicAppMode: settings.musicAppMode !== false,
      ambientByBlock: (() => {
        const raw = settings.ambientByBlock;
        if (typeof raw !== 'object' || raw === null) return {};
        const out: AppState['settings']['ambientByBlock'] = {};
        for (const block of BLOCKS) {
          const v = (raw as Record<string, unknown>)[block];
          if (isAmbientKind(v)) out[block] = v;
        }
        return out;
      })(),
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

/**
 * A backup, minus anything that is a credential.
 *
 * The export is a file people mail themselves and drop in cloud storage. The
 * library key is a password for the audio bucket, so it must not travel in one
 * — and an export carrying a key that is later rotated would be worse than
 * useless. Reconnecting is two fields; leaking a key is not undoable.
 */
export function exportState(state: AppState): string {
  const { library: _redacted, ...settings } = state.settings;
  return JSON.stringify({ ...state, settings: { ...settings, library: null } }, null, 2);
}

export function importState(json: string): AppState {
  return coerceState(JSON.parse(json));
}
