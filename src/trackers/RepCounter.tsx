import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dial, SetPips, WeightInput, targetFor, type TrackerProps } from './shared';
import { useTapOrHold, useWakeLock } from './hooks';
import { haptic, HAPTIC } from '../lib/haptics';
import type { Exercise } from '../types';

/**
 * `tracking: 'reps'` — pulldowns, rows, dips, Jefferson curls, deadlifts.
 *
 * The whole circle is the button. Tap to increment, press and hold to
 * decrement. There is deliberately no small "−" control: with chalky hands,
 * misfires are common and the correction has to be forgiving.
 */
export function RepCounter({
  exercise,
  setIndex,
  logged,
  weightKg,
  onWeightChange,
  onSetComplete,
}: TrackerProps) {
  const target = targetFor(exercise, setIndex);
  const [count, setCount] = useState(0);
  const [pulse, setPulse] = useState(0);

  useWakeLock(true);

  // A new set starts from zero. Walking back to a previous stage and returning
  // lands here too, which is correct — the logged set is already stored.
  useEffect(() => {
    setCount(0);
  }, [exercise.id, setIndex]);

  const reached = count >= target;

  const handlers = useTapOrHold({
    onTap: () => {
      setCount((c) => {
        const next = c + 1;
        // Overshooting is allowed and recorded honestly — never cap this.
        haptic(next === target ? HAPTIC.complete : HAPTIC.tick);
        return next;
      });
      setPulse((p) => p + 1);
    },
    onHold: () => {
      setCount((c) => Math.max(0, c - 1));
      haptic(HAPTIC.tick);
    },
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <Dial
        progress={count / target}
        complete={reached}
        label={`Rep counter. ${count} of ${target}. Tap to add a rep, press and hold to remove one.`}
        {...handlers}
      >
        {reached ? (
          <>
            <Check className="text-accent" size={44} strokeWidth={2.5} />
            <span className="mt-1 text-3xl font-bold tabular-nums text-accent">{count}</span>
          </>
        ) : (
          <>
            <span
              key={pulse}
              className="ridge-rep-number text-[4.5rem] font-bold leading-none tabular-nums text-ink"
            >
              {count}
            </span>
            <span className="mt-1 text-base font-medium tabular-nums text-faint">/ {target}</span>
          </>
        )}
      </Dial>

      {exercise.tempo && <TempoBar tempo={exercise.tempo} />}

      <SetPips exercise={exercise} setIndex={setIndex} completedCount={logged.length} />

      {exercise.loadTracked && <WeightInput weightKg={weightKg} onChange={onWeightChange} />}

      <button
        type="button"
        onClick={() => {
          haptic(HAPTIC.complete);
          onSetComplete(count);
        }}
        disabled={count === 0}
        className={[
          'h-14 w-full rounded-card text-base font-semibold transition-colors disabled:opacity-40',
          reached
            ? 'bg-accent text-base'
            : 'border border-line bg-surface text-muted',
        ].join(' ')}
      >
        {/* At zero the button is disabled, so it says what to do instead of
            offering to log nothing. */}
        {count === 0
          ? 'Tap the dial to count'
          : reached
            ? setIndex + 1 < exercise.sets
              ? 'Log set · rest'
              : 'Log final set'
            : `Log ${count} rep${count === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}

/**
 * Slim metronome for tempo-prescribed work — the Jefferson curl's 5s down /
 * 5s up, and the wall glides' 3/3. Visual only, no sound: this runs in a gym
 * and in a bedroom at 22:00.
 */
function TempoBar({ tempo }: { tempo: NonNullable<Exercise['tempo']> }) {
  const total = tempo.down + tempo.up;
  return (
    <div className="w-full">
      <div className="mb-1.5 flex justify-between text-[11px] font-medium uppercase tracking-wider text-faint">
        <span>{tempo.down}s down</span>
        <span>{tempo.up}s up</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
        <div
          className="ridge-tempo h-full rounded-full bg-accent/70"
          style={{ animationDuration: `${total}s` }}
        />
      </div>
    </div>
  );
}
