import { ArrowRight, ChevronDown, ChevronLeft, TrendingUp, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Exercise, LoggedSet, Session } from '../types';
import { BLOCK_LABEL } from '../data/sessions';
import { ExerciseAnimation } from '../animations/registry';
import { RepCounter } from '../trackers/RepCounter';
import { HoldTimer } from '../trackers/HoldTimer';
import { DurationTimer } from '../trackers/DurationTimer';
import { DistanceLogger } from '../trackers/DistanceLogger';
import { RestTimer } from '../trackers/RestTimer';
import type { TrackerProps } from '../trackers/shared';
import { useApp } from '../state/AppStateContext';
import { progressionReady } from '../state/selectors';

const TRACKERS: Record<Exercise['tracking'], (p: TrackerProps) => JSX.Element> = {
  reps: RepCounter,
  hold: HoldTimer,
  duration: DurationTimer,
  distance: DistanceLogger,
};

export function Stage({
  session,
  stageIndex,
  onNext,
  onBack,
  onLeave,
  onDiscard,
}: {
  session: Session;
  stageIndex: number;
  onNext: () => void;
  onBack: () => void;
  /** Leave the session where it is — it stays resumable from the home screen. */
  onLeave: () => void;
  /** Throw the session away, including anything logged in it. */
  onDiscard: () => void;
}) {
  const { state, logSet } = useApp();
  const [confirmExit, setConfirmExit] = useState(false);
  const exercise = session.exercises[stageIndex] as Exercise;

  const logged = useMemo<LoggedSet[]>(
    () =>
      (state.activeSession?.sets ?? [])
        .filter((s) => s.exerciseId === exercise.id)
        .sort((a, b) => a.setIndex - b.setIndex),
    [state.activeSession?.sets, exercise.id],
  );

  const setIndex = logged.length;
  const allSetsDone = setIndex >= exercise.sets;

  const [weightKg, setWeightKg] = useState<number | null>(
    () => state.lastWeights[exercise.id] ?? null,
  );
  const [resting, setResting] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setWeightKg(state.lastWeights[exercise.id] ?? null);
    setResting(false);
    setOpen(false);
    // Weight is pre-filled per exercise, so it must re-read on stage change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const handleSetComplete = useCallback(
    (reps: number) => {
      logSet({
        exerciseId: exercise.id,
        setIndex,
        reps,
        weightKg: exercise.loadTracked ? weightKg : null,
        completedAt: new Date().toISOString(),
      });
      // Rest is suppressed after the final set — that flows straight into the
      // next-stage prompt instead.
      if (setIndex + 1 < exercise.sets) setResting(true);
    },
    [exercise.id, exercise.loadTracked, exercise.sets, logSet, setIndex, weightKg],
  );

  const Tracker = TRACKERS[exercise.tracking];
  const isSpine = exercise.block === 'spine';
  const showProgression = allSetsDone && progressionReady(state, exercise);

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-8">
      <div className="flex items-center justify-between pb-1 pt-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Previous stage"
          className="-ml-2 grid h-11 w-11 place-items-center rounded-full text-muted active:bg-raised"
        >
          <ChevronLeft size={22} />
        </button>
        <span
          className={[
            'text-[11px] font-semibold uppercase tracking-[0.18em]',
            isSpine ? 'text-spine' : 'text-faint',
          ].join(' ')}
        >
          {BLOCK_LABEL[exercise.block]} · stage {stageIndex + 1} of {session.exercises.length}
        </span>
        {/* Without this, leaving mid-session means walking back to stage one. */}
        <button
          type="button"
          onClick={() => setConfirmExit(true)}
          aria-label="Leave session"
          className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-muted active:bg-raised"
        >
          <X size={20} />
        </button>
      </div>

      <div
        className={[
          'mt-2 flex flex-col items-center rounded-card px-4 py-5',
          isSpine ? 'border border-spine/35 bg-spine/[0.07]' : '',
        ].join(' ')}
      >
        <span className={isSpine ? 'text-spine' : 'text-accent'}>
          <ExerciseAnimation
            animation={exercise.animation}
            size={140}
            // A prescribed tempo is an instruction, so the figure moves at it.
            {...(exercise.tempo
              ? { loopSeconds: exercise.tempo.down + exercise.tempo.up }
              : {})}
          />
        </span>
        <h2 className="mt-3 text-center text-2xl ridge-title text-ink">
          {exercise.name}
        </h2>
        <p className="mt-0.5 text-center text-xs font-medium tracking-wide text-faint">
          {exercise.prescription}
        </p>
        {exercise.cue && (
          <p className="mt-3 text-balance text-center text-lg font-medium leading-snug text-ink/90">
            “{exercise.cue}”
          </p>
        )}
      </div>

      <div className="mt-6">
        <Tracker
          exercise={exercise}
          setIndex={Math.min(setIndex, exercise.sets - 1)}
          logged={logged}
          weightKg={weightKg}
          onWeightChange={setWeightKg}
          onSetComplete={handleSetComplete}
        />
      </div>

      {showProgression && (
        <div
          className={[
            'mt-5 flex gap-2.5 rounded-card border p-3.5 text-sm',
            isSpine ? 'border-spine/40 bg-spine/[0.07]' : 'border-accent/35 bg-accent/[0.07]',
          ].join(' ')}
        >
          <TrendingUp size={16} className={`mt-0.5 shrink-0 ${isSpine ? 'text-spine' : 'text-accent'}`} />
          <p className="leading-relaxed text-muted">
            {isSpine ? (
              <>
                <span className="font-semibold text-ink">Four clean sessions here.</span> If nothing
                has been sore in between, a very small increase is reasonable — 1-2 kg, not more.
                There is no hurry with this block.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">Two clean sessions in a row.</span> Ready
                to add load next time?
              </>
            )}
          </p>
        </div>
      )}

      <details
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="mt-5 rounded-card border border-line/60 bg-surface"
      >
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium text-muted [&::-webkit-details-marker]:hidden">
          Execution &amp; why
          <ChevronDown
            size={17}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </summary>
        <div className="space-y-3 border-t border-line/50 px-4 py-4 text-sm leading-relaxed">
          <p className="text-muted">{exercise.execution}</p>
          {exercise.why && (
            <p className="border-l-2 border-line pl-3 text-faint">
              <span className="font-semibold uppercase tracking-wider text-faint">Why</span>
              <br />
              {exercise.why}
            </p>
          )}
        </div>
      </details>

      {/* Sticky only once the sets are done. While work remains, the tracker's
          own Log button is the primary action and must not be covered — that is
          the gesture repeated three times per exercise, against one Next. */}
      <div
        className={[
          '-mx-5 mt-auto px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3',
          allSetsDone ? 'sticky bottom-0 z-10 bg-base/92 backdrop-blur-md' : '',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={onNext}
          className={[
            'flex h-16 w-full items-center justify-center gap-2 rounded-card text-lg font-bold transition-colors',
            allSetsDone
              ? 'bg-accent text-base active:opacity-90'
              : 'border border-line bg-surface text-muted active:bg-raised',
          ].join(' ')}
        >
          {stageIndex + 1 === session.exercises.length ? 'Finish' : 'Next stage'}
          <ArrowRight size={20} />
        </button>
        {!allSetsDone && (
          <p className="mt-2 text-center text-xs text-faint">
            {exercise.sets - setIndex} set{exercise.sets - setIndex === 1 ? '' : 's'} left · skipping
            is allowed
          </p>
        )}
      </div>

      {confirmExit && (
        <ExitConfirm
          onCancel={() => setConfirmExit(false)}
          onLeave={onLeave}
          onDiscard={onDiscard}
        />
      )}

      {resting && (
        <RestTimer
          exercise={exercise}
          nextSetIndex={setIndex}
          seconds={exercise.restSeconds || state.settings.restDefaultSeconds}
          onDone={() => setResting(false)}
        />
      )}
    </div>
  );
}

/**
 * Leaving is two different intentions and they must not be one button: pausing
 * because the gym is closing, and abandoning a session started by mistake. The
 * first keeps everything logged and is the default.
 */
function ExitConfirm({
  onCancel,
  onLeave,
  onDiscard,
}: {
  onCancel: () => void;
  onLeave: () => void;
  onDiscard: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-base/70 backdrop-blur-sm">
      <button type="button" aria-label="Cancel" className="flex-1" onClick={onCancel} />
      <div className="ridge-sheet rounded-t-[1.75rem] border-t border-line bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
        <h2 className="text-xl ridge-title text-ink">Leave this session?</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Pausing keeps every set you have logged. You can pick the session back up from the home
          screen, on the stage you left it.
        </p>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onLeave}
            className="h-14 w-full rounded-card bg-accent text-base font-bold text-base active:opacity-90"
          >
            Pause and leave
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-12 w-full rounded-card border border-line text-sm font-medium text-muted active:bg-raised"
          >
            Stay here
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="h-12 w-full rounded-card text-sm font-medium text-danger active:bg-raised"
          >
            Discard this session
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
