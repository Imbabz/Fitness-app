import { Check, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Exercise, ExerciseTuning, Session } from '../types';
import { BLOCK_LABEL } from '../data/sessions';
import { EXERCISE_BY_ID } from '../data/exercises';
import { ExerciseAnimation } from '../animations/registry';
import { useApp } from '../state/AppStateContext';
import { clampTo, substitutesFor, tuneExercise, TUNING_LIMITS } from '../state/tuning';
import { haptic, HAPTIC } from '../lib/haptics';

/**
 * Adjusting the numbers on one exercise. Reachable from the trailhead, because
 * that is where you stand deciding what today actually looks like.
 *
 * What is adjustable is deliberately narrow — how many, how long, how much
 * rest. Movement selection, ordering and the Jefferson curl's tempo are medical
 * decisions and are not offered here. See CLAUDE.md.
 */
export function TuningSheet({
  session,
  exercise,
  onClose,
}: {
  session: Session;
  exercise: Exercise;
  onClose: () => void;
}) {
  const { state, setTuning, replaceExercise, removeExercise } = useApp();
  const seed = EXERCISE_BY_ID[exercise.id] as Exercise;

  const ids = session.exercises.map((e) => e.id);
  // Suggestions carry the "which one actually replaces this" knowledge; the
  // rest of the block is there because the block is the real boundary and the
  // choice is the user's. Movements already in the session are left out — the
  // swap would be refused to avoid a duplicate, and a dead option is worse.
  const { suggested, others } = substitutesFor(exercise, ids);
  const canRemove = ids.length > 1;

  const [draft, setDraft] = useState<ExerciseTuning>(() => ({
    repScheme: [...exercise.repScheme],
    ...(exercise.holdSeconds !== undefined ? { holdSeconds: exercise.holdSeconds } : {}),
    ...(exercise.durationSeconds !== undefined
      ? { durationSeconds: exercise.durationSeconds }
      : {}),
    ...(exercise.distanceM !== undefined ? { distanceM: exercise.distanceM } : {}),
    restSeconds: exercise.restSeconds,
  }));

  // The preview is the real thing: the same function the stages read.
  const preview = tuneExercise(seed, draft);
  const isDuration = seed.tracking === 'duration';
  const scheme = draft.repScheme ?? seed.repScheme;

  const patch = (next: Partial<ExerciseTuning>) => {
    haptic(HAPTIC.tick);
    setDraft((d) => ({ ...d, ...next }));
  };

  const setReps = (index: number, value: number) => {
    const next = [...scheme];
    next[index] = clampTo(TUNING_LIMITS.reps, value);
    patch({ repScheme: next });
  };

  const setSets = (count: number) => {
    const target = clampTo(TUNING_LIMITS.sets, count);
    const next = [...scheme];
    while (next.length < target) next.push(next.at(-1) ?? 1);
    next.length = target;
    patch({ repScheme: next });
  };

  const save = () => {
    haptic(HAPTIC.complete);
    setTuning(exercise.id, draft);
    onClose();
  };

  const pick = (substituteId: string) => {
    haptic(HAPTIC.tick);
    replaceExercise(session.id, exercise.id, substituteId);
    onClose();
  };

  const restore = () => {
    haptic(HAPTIC.tick);
    setTuning(exercise.id, null);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-base/70 backdrop-blur-sm">
      <button type="button" aria-label="Close" className="flex-1" onClick={onClose} />

      <div className="ridge-sheet max-h-[88dvh] overflow-y-auto rounded-t-[1.75rem] border-t border-line bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
              {BLOCK_LABEL[seed.block]}
            </span>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">{seed.name}</h2>
            <p className="mt-0.5 text-xs text-faint">{preview.prescription}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted active:bg-raised"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-ink">Movement</span>
            <span className="text-xs text-faint">{BLOCK_LABEL[seed.block].toLowerCase()}</span>
          </div>

          <div className="mt-2 space-y-1.5">
            <Choice exercise={exercise} active badge="current" onPick={() => undefined} />
            {suggested.map((choice) => (
              <Choice
                key={choice.id}
                exercise={choice}
                active={choice.id === exercise.id}
                badge="suggested"
                onPick={() => pick(choice.id)}
              />
            ))}
          </div>

          {others.length > 0 && (
            <details className="mt-2">
              <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-card px-1 text-sm font-medium text-muted [&::-webkit-details-marker]:hidden">
                Anything else in this block
                <span className="text-xs text-faint">{others.length}</span>
              </summary>
              <div className="mt-1.5 space-y-1.5">
                {others.map((choice) => (
                  <Choice
                    key={choice.id}
                    exercise={choice}
                    active={choice.id === exercise.id}
                    onPick={() => pick(choice.id)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="mt-7 space-y-4">
          <span className="block text-sm font-medium text-ink">How much</span>
          {isDuration ? (
            <Stepper
              label="Duration"
              value={Math.round((draft.durationSeconds ?? 0) / 60)}
              unit="min"
              step={1}
              min={Math.ceil(TUNING_LIMITS.durationSeconds.min / 60)}
              max={Math.floor(TUNING_LIMITS.durationSeconds.max / 60)}
              onChange={(v) => patch({ durationSeconds: v * 60 })}
            />
          ) : (
            <>
              <Stepper
                label="Sets"
                value={scheme.length}
                step={1}
                min={TUNING_LIMITS.sets.min}
                max={TUNING_LIMITS.sets.max}
                onChange={setSets}
              />

              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-ink">
                    {seed.tracking === 'distance' ? 'Carries per set' : 'Reps per set'}
                  </span>
                  <span className="text-xs text-faint">
                    {seed.bilateral ? 'per side' : 'tap a set to change it'}
                  </span>
                </div>
                {/* One control per set — a 6/4/2 exercise stays 6/4/2. */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {scheme.map((reps, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 rounded-full border border-line/70 bg-raised/60 p-1"
                    >
                      <IconButton
                        label={`Set ${i + 1}: one less`}
                        onClick={() => setReps(i, reps - 1)}
                      >
                        <Minus size={15} />
                      </IconButton>
                      <span className="min-w-[2.5rem] text-center text-base font-semibold tabular-nums text-ink">
                        {reps}
                      </span>
                      <IconButton
                        label={`Set ${i + 1}: one more`}
                        onClick={() => setReps(i, reps + 1)}
                      >
                        <Plus size={15} />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {seed.tracking === 'hold' && (
            <Stepper
              label="Hold per rep"
              value={draft.holdSeconds ?? 0}
              unit="sec"
              step={1}
              min={TUNING_LIMITS.holdSeconds.min}
              max={TUNING_LIMITS.holdSeconds.max}
              onChange={(v) => patch({ holdSeconds: v })}
            />
          )}

          {seed.tracking === 'distance' && (
            <Stepper
              label="Distance"
              value={draft.distanceM ?? 0}
              unit="m"
              step={5}
              min={TUNING_LIMITS.distanceM.min}
              max={TUNING_LIMITS.distanceM.max}
              onChange={(v) => patch({ distanceM: v })}
            />
          )}

          <Stepper
            label="Rest between sets"
            value={draft.restSeconds ?? 0}
            unit="sec"
            step={15}
            min={TUNING_LIMITS.restSeconds.min}
            max={TUNING_LIMITS.restSeconds.max}
            onChange={(v) => patch({ restSeconds: v })}
          />
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={() => {
              haptic(HAPTIC.tick);
              removeExercise(session.id, exercise.id);
              onClose();
            }}
            className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-card text-sm font-medium text-danger active:bg-raised"
          >
            <Trash2 size={15} />
            Remove from this session
          </button>
        )}

        {seed.block === 'spine' && (
          <p className="mt-4 rounded-card border border-spine/35 bg-spine/[0.07] p-3 text-xs leading-relaxed text-muted">
            Spine block. Adding volume here is the one place worth being slow about — this work is
            the reason the session is ordered the way it is.
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={restore}
            disabled={!state.tuning[exercise.id]}
            className="flex h-14 items-center justify-center gap-1.5 rounded-card border border-line px-4 text-sm font-medium text-muted active:bg-raised disabled:opacity-40"
          >
            <RotateCcw size={15} />
            Original
          </button>
          <button
            type="button"
            onClick={save}
            className="h-14 flex-1 rounded-card bg-accent text-base font-bold text-base active:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-full text-muted active:bg-surface"
    >
      {children}
    </button>
  );
}

function Stepper({
  label,
  value,
  unit,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-line/70 bg-raised/60 p-1">
        <IconButton label={`${label}: decrease`} onClick={() => onChange(Math.max(min, value - step))}>
          <Minus size={16} />
        </IconButton>
        <span className="min-w-[4.25rem] text-center text-base font-semibold tabular-nums text-ink">
          {value}
          {unit && <span className="ml-1 text-xs font-normal text-faint">{unit}</span>}
        </span>
        <IconButton label={`${label}: increase`} onClick={() => onChange(Math.min(max, value + step))}>
          <Plus size={16} />
        </IconButton>
      </div>
    </div>
  );
}

function Choice({
  exercise,
  active,
  badge,
  onPick,
}: {
  exercise: Exercise;
  active: boolean;
  badge?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={[
        'flex w-full items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-colors',
        active ? 'border-accent/60 bg-accent/[0.08]' : 'border-line/60 bg-raised/40 active:bg-raised',
      ].join(' ')}
    >
      <span className={active ? 'text-accent' : 'text-muted'}>
        <ExerciseAnimation animation={exercise.animation} size={26} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${active ? 'text-ink' : 'text-muted'}`}>
          {exercise.name}
          {badge && <span className="ml-1.5 text-xs font-normal text-faint">{badge}</span>}
        </span>
        <span className="block truncate text-xs text-faint">{exercise.prescription}</span>
      </span>
      {active && <Check size={16} className="shrink-0 text-accent" />}
    </button>
  );
}
