import { Check, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SetPips, WeightInput, type TrackerProps } from './shared';
import { useWakeLock } from './hooks';
import { haptic, HAPTIC } from '../lib/haptics';

const STEP_M = 5;

/**
 * `tracking: 'distance'` — farmer's carries.
 *
 * Deliberately dumb: a stepper in 5m increments. No GPS, no step counting, no
 * permissions dialog in the middle of a gym.
 */
export function DistanceLogger({
  exercise,
  setIndex,
  logged,
  weightKg,
  onWeightChange,
  onSetComplete,
}: TrackerProps) {
  const target = exercise.distanceM ?? 30;
  const [metres, setMetres] = useState(target);

  useWakeLock(true);

  useEffect(() => {
    setMetres(target);
  }, [exercise.id, setIndex, target]);

  const bump = (delta: number) => {
    haptic(HAPTIC.tick);
    setMetres((m) => Math.max(0, m + delta));
  };

  const reached = metres >= target;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex w-full items-center justify-between gap-3">
        <button
          type="button"
          aria-label={`Subtract ${STEP_M} metres`}
          onClick={() => bump(-STEP_M)}
          className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted active:bg-raised"
        >
          <Minus size={28} />
        </button>

        <div className="flex flex-1 flex-col items-center">
          <div className="flex items-baseline gap-1">
            <span
              className={`text-[4rem] font-bold leading-none tabular-nums ${reached ? 'text-accent' : 'text-ink'}`}
            >
              {metres}
            </span>
            <span className="text-2xl font-medium text-faint">m</span>
          </div>
          <span className="mt-1 text-sm font-medium text-faint">target {target} m</span>
        </div>

        <button
          type="button"
          aria-label={`Add ${STEP_M} metres`}
          onClick={() => bump(STEP_M)}
          className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted active:bg-raised"
        >
          <Plus size={28} />
        </button>
      </div>

      <SetPips exercise={exercise} setIndex={setIndex} completedCount={logged.length} />

      {exercise.loadTracked && <WeightInput weightKg={weightKg} onChange={onWeightChange} />}

      <button
        type="button"
        onClick={() => {
          haptic(HAPTIC.complete);
          // Metres are the meaningful unit here, so they go in the reps field —
          // history renders it with the exercise's tracking mode in hand.
          onSetComplete(metres);
        }}
        className={[
          'flex h-14 w-full items-center justify-center gap-2 rounded-card text-base font-semibold transition-colors',
          reached ? 'bg-accent text-base' : 'border border-line bg-surface text-muted',
        ].join(' ')}
      >
        {reached && <Check size={20} />}
        {setIndex + 1 < exercise.sets ? 'Log carry · rest' : 'Log final carry'}
      </button>
    </div>
  );
}
