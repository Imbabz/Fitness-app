import type { AmbientKind, SynthKind } from './lib/ambient';

export type Mode = 'day' | 'night';

export type Block = 'warmup' | 'main' | 'spine' | 'mobility';

export type TrackingMode = 'reps' | 'hold' | 'distance' | 'duration';

export type View = 'home' | 'session' | 'routine' | 'history' | 'settings';

export interface Exercise {
  id: string;
  name: string;
  block: Block;
  /** Human-readable summary, e.g. "3 × 12 · rest 90 sec". */
  prescription: string;
  /** Drives which tracker the stage renders. */
  tracking: TrackingMode;
  sets: number;
  /**
   * One entry per set. [12,12,12] for straight sets, [6,4,2] for McGill's
   * descending format. Never collapse this to `sets × reps` — see CLAUDE.md.
   */
  repScheme: number[];
  /** Per rep, for tracking: 'hold'. */
  holdSeconds?: number;
  /** Whole-set duration, for tracking: 'duration'. */
  durationSeconds?: number;
  /** Target metres per set, for tracking: 'distance'. */
  distanceM?: number;
  /** Seconds per phase. Drives the metronome bar on the rep counter. */
  tempo?: { down: number; up: number };
  restSeconds: number;
  execution: string;
  /** The one thing to hold in your head mid-set. */
  cue?: string;
  /** Rationale. Part of the product — it is what makes the user comply. */
  why?: string;
  /** Key into the animation registry. */
  animation: string;
  loadTracked: boolean;
  /**
   * Side-specific work (side plank, bird dog, dead bug). Both sides must be
   * completed before the set counts. Only meaningful for tracking: 'hold'.
   */
  bilateral?: boolean;
  /**
   * Suggested stand-ins, by exercise id — the movements that genuinely cover the
   * same pattern. A **suggestion, not a gate**: anything in the same block may
   * be substituted. These are surfaced first because "which one actually
   * replaces this" is knowledge worth keeping, not a restriction worth imposing.
   *
   * Must sit in the same block, or the suggestion could not be honoured.
   */
  alternates?: string[];
}

export interface Session {
  id: 'A' | 'B' | 'C' | 'daily';
  mode: Mode;
  title: string;
  subtitle: string;
  durationMin: number;
  exercises: Exercise[];
}

export interface LoggedSet {
  exerciseId: string;
  setIndex: number;
  reps: number;
  weightKg: number | null;
  completedAt: string;
}

export interface CompletedSession {
  sessionId: string;
  /** YYYY-MM-DD, local time. */
  date: string;
  startedAt: string;
  finishedAt: string;
  sets: LoggedSet[];
  note?: string;
  painFlag: boolean;
  /**
   * exerciseId → the repScheme that was prescribed when this session was
   * finished. Frozen here so "was it clean?" is judged against the target of
   * the day, not against whatever the exercise has been adjusted to since.
   *
   * Absent on sessions logged before adjustments existed; those fall back to
   * the exercise's current scheme, which is what they were judged by anyway.
   */
  targets?: Record<string, number[]>;
}

export interface ActiveSession {
  sessionId: string;
  startedAt: string;
  sets: LoggedSet[];
  /** -1 is the trailhead, exercises.length is the summit. */
  stageIndex: number;
}

/**
 * User adjustments to an exercise's prescribed numbers. Every field is optional
 * and absent means "use the seed value", so clearing one restores the original.
 *
 * Deliberately limited to how much work and for how long. Movement selection,
 * ordering, block and tempo are medical decisions and are not adjustable here.
 */
export interface ExerciseTuning {
  /** One entry per set, so `sets` stays derived. Never collapse to a count. */
  repScheme?: number[];
  holdSeconds?: number;
  durationSeconds?: number;
  distanceM?: number;
  restSeconds?: number;
}

export interface Settings {
  /** Fallback when an exercise has no restSeconds of its own. */
  restDefaultSeconds: number;
  /** Duration timer finishing sound. Off by default — see BUILD_SPEC §5.3. */
  soundOnTimerEnd: boolean;
  haptics: boolean;
  /** exerciseId → auto-chain preference for the hold timer. */
  autoChain: Record<string, boolean>;
  /**
   * exerciseId → beep through the last seconds of that exercise's timers.
   * Per exercise rather than global: a rest timer you want to hear during
   * deadlifts is not one you want during the nightly routine.
   */
  countdown: Record<string, boolean>;
  /** What plays while a session is open. Off by default. */
  ambient: AmbientKind;
  /**
   * A texture laid under your own music. Only ever a texture, never a pad or a
   * second track: rain and surf have no key, so they cannot clash with whatever
   * the music is doing. Two arbitrary recordings would.
   */
  ambientLayer: 'off' | SynthKind;
  /**
   * Per-block overrides. The main block can carry something with more weight
   * than the spine block wants, and one choice for a whole session cannot say
   * that. Absent entries fall back to `ambient`.
   */
  ambientByBlock: Partial<Record<Block, AmbientKind>>;
}

export interface AppState {
  version: 1;
  mode: Mode;
  /** YYYY-MM-DD the manual mode override was set. Expires the next day. */
  modeOverrideDate: string | null;
  history: CompletedSession[];
  activeSession: ActiveSession | null;
  /** exerciseId → last used kg. */
  lastWeights: Record<string, number>;
  /** exerciseId → adjusted prescription. Absent entries use the seed values. */
  tuning: Record<string, ExerciseTuning>;
  /**
   * sessionId → the exercises that session contains, in order. Absent means
   * "as seeded". This one field covers adding, removing, replacing and
   * reordering: each is just a different edit to the same list.
   *
   * Order within it is honoured only *within* a block. `resolveSession()`
   * sorts by block first, so no stored composition — however written, imported
   * or corrupted — can lift spine work off the end. See CLAUDE.md rule 2.
   */
  composition: Record<string, string[]>;
  streak: { current: number; longest: number; lastDailyDate: string | null };
  settings: Settings;
}
