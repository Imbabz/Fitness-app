import { Check, Pause, Play } from 'lucide-react';
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
  const [auto, setAuto] = useState(false);

  useWakeLock(true);

  // Hands-free pace. A prescribed tempo is the honest interval; without one,
  // three seconds is a normal controlled rep.
  const secondsPerRep = exercise.tempo ? exercise.tempo.down + exercise.tempo.up : 3;

  // A new set starts from zero. Walking back to a previous stage and returning
  // lands here too, which is correct — the logged set is already stored.
  useEffect(() => {
    setCount(0);
    setAuto(false);
  }, [exercise.id, setIndex]);

  // Self-rescheduling rather than an interval, so the tick always sees the
  // current count and stops itself exactly on the target.
  useEffect(() => {
    if (!auto) return;
    if (count >= target) {
      setAuto(false);
      return;
    }
    const t = window.setTimeout(() => {
      setCount((c) => c + 1);
      setPulse((p) => p + 1);
      haptic(count + 1 >= target ? HAPTIC.complete : HAPTIC.tick);
    }, secondsPerRep * 1000);
    return () => window.clearTimeout(t);
  }, [auto, count, target, secondsPerRep]);

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
    <div className="ridge-stack">
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

      {/* Sharing a row with the pips rather than taking one of its own: the Log
          button below is the primary action and has to stay above the fold. */}
      <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <SetPips exercise={exercise} setIndex={setIndex} completedCount={logged.length} />

        {/* Both hands are on the bar during a set, so tapping once per rep is
            not something you can actually do. This counts at the prescribed
            pace instead; tapping the dial still works and overrides nothing. */}
        <button
          type="button"
          onClick={() => {
            haptic(HAPTIC.tick);
            setAuto((a) => !a);
          }}
          disabled={reached}
          className={[
            'flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-40',
            auto ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line bg-surface text-muted',
          ].join(' ')}
        >
          {auto ? <Pause size={15} /> : <Play size={15} />}
          {auto ? 'Counting' : 'Hands-free'}
          <span className="font-normal text-faint">{secondsPerRep}s</span>
        </button>
      </div>

      {exercise.loadTracked && <WeightInput weightKg={weightKg} onChange={onWeightChange} />}

      {/* At zero this logs the prescribed set outright: finishing a set without
          having counted anything is the normal case, not an error. Counting —
          by tap or hands-free — is for when the set did not go to plan. */}
      <button
        type="button"
        onClick={() => {
          haptic(HAPTIC.complete);
          setAuto(false);
          onSetComplete(count === 0 ? target : count);
        }}
        className={[
          'h-14 w-full rounded-card text-base font-semibold transition-colors',
          reached || count === 0
            ? 'bg-accent text-base'
            : 'border border-line bg-surface text-muted',
        ].join(' ')}
      >
        {count === 0
          ? `Log ${target} rep${target === 1 ? '' : 's'}`
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
