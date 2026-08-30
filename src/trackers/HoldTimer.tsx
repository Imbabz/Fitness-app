import { Check, Infinity as InfinityIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CountdownToggle,
  Dial,
  SetPips,
  SideIndicator,
  WeightInput,
  targetFor,
  type TrackerProps,
} from './shared';
import { useCountdown, useCountdownBeeps, useWakeLock } from './hooks';
import { haptic, HAPTIC } from '../lib/haptics';
import { beep } from '../lib/sound';
import { useApp } from '../state/AppStateContext';

const GAP_SECONDS = 3;

type Phase = 'idle' | 'holding' | 'gap';

/**
 * `tracking: 'hold'` — the McGill Big 3, cobra, pinch blocks.
 *
 * These have a rep count AND a per-rep hold duration, which is why they cannot
 * reuse the rep counter or the duration timer. Bilateral exercises require both
 * sides before a rep counts.
 */
export function HoldTimer({
  exercise,
  setIndex,
  logged,
  weightKg,
  onWeightChange,
  onSetComplete,
}: TrackerProps) {
  const { state, updateSettings } = useApp();
  const target = targetFor(exercise, setIndex);
  const holdMs = (exercise.holdSeconds ?? 5) * 1000;
  const bilateral = exercise.bilateral === true;

  const [reps, setReps] = useState(0);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [phase, setPhase] = useState<Phase>('idle');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const lastBeep = useRef(-1);

  const autoChain = state.settings.autoChain[exercise.id] === true;

  useWakeLock(phase !== 'idle');

  useEffect(() => {
    setReps(0);
    setSide('left');
    setPhase('idle');
    setEndsAt(null);
  }, [exercise.id, setIndex]);

  const startHold = useCallback(() => {
    setPhase('holding');
    setEndsAt(Date.now() + holdMs);
  }, [holdMs]);

  const finishHold = useCallback(() => {
    haptic(HAPTIC.complete);
    setEndsAt(null);

    // On a bilateral exercise a rep is only banked once both sides are done.
    const repDone = !bilateral || side === 'right';
    const nextReps = repDone ? reps + 1 : reps;
    if (bilateral) setSide(side === 'left' ? 'right' : 'left');
    setReps(nextReps);

    if (nextReps >= target) {
      setPhase('idle');
      return;
    }
    if (autoChain) {
      lastBeep.current = -1;
      setPhase('gap');
      setEndsAt(Date.now() + GAP_SECONDS * 1000);
    } else {
      setPhase('idle');
    }
  }, [autoChain, bilateral, reps, side, target]);

  const finishGap = useCallback(() => {
    beep(660, 0.12);
    startHold();
  }, [startHold]);

  const { remainingMs, remainingSeconds } = useCountdown(
    endsAt,
    phase === 'holding' ? finishHold : phase === 'gap' ? finishGap : undefined,
  );

  // One short tick per remaining second of the auto-chain gap, so the user
  // knows the next rep is coming without looking at the phone.
  useEffect(() => {
    if (phase !== 'gap') return;
    if (remainingSeconds > 0 && remainingSeconds !== lastBeep.current) {
      lastBeep.current = remainingSeconds;
      beep(420, 0.07);
    }
  }, [phase, remainingSeconds]);

  useCountdownBeeps(
    remainingSeconds,
    phase === 'holding' && state.settings.countdown[exercise.id] === true,
  );

  const done = reps >= target;
  const progress =
    phase === 'holding' ? Math.max(0, remainingMs / holdMs) : phase === 'gap' ? 0 : done ? 1 : 0;

  const onDialPress = () => {
    if (done) return;
    if (phase === 'idle') {
      haptic(HAPTIC.tick);
      startHold();
    } else {
      // Tap again to abort a rep in progress. It does not count.
      haptic(HAPTIC.tick);
      setPhase('idle');
      setEndsAt(null);
    }
  };

  return (
    <div className="ridge-stack">
      <Dial
        progress={progress}
        complete={done}
        label={`Hold timer. ${reps} of ${target} holds done. Tap to ${phase === 'idle' ? 'start' : 'abort'} a hold.`}
        onClick={onDialPress}
      >
        {done ? (
          <>
            <Check className="text-accent" size={44} strokeWidth={2.5} />
            <span className="mt-1 text-sm font-medium text-accent">Set complete</span>
          </>
        ) : phase === 'idle' ? (
          <>
            <span className="text-[3.25rem] font-bold leading-none tabular-nums text-ink">
              {exercise.holdSeconds}s
            </span>
            <span className="mt-1 text-sm font-medium text-faint">Tap to hold</span>
          </>
        ) : phase === 'gap' ? (
          <>
            <span className="text-[3.25rem] font-bold leading-none tabular-nums text-muted">
              {remainingSeconds}
            </span>
            <span className="mt-1 text-sm font-medium text-faint">Next in…</span>
          </>
        ) : (
          <>
            <span className="text-[4.5rem] font-bold leading-none tabular-nums text-ink">
              {remainingSeconds}
            </span>
            <span className="mt-1 text-sm font-medium text-faint">Hold</span>
          </>
        )}
      </Dial>

      {bilateral && !done && <SideIndicator side={side} />}

      <RepPips count={target} done={reps} />

      <div className="w-full space-y-3">
        <SetPips exercise={exercise} setIndex={setIndex} completedCount={logged.length} />

        {exercise.loadTracked && <WeightInput weightKg={weightKg} onChange={onWeightChange} />}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              updateSettings({
                autoChain: { ...state.settings.autoChain, [exercise.id]: !autoChain },
              })
            }
            className={[
              'flex h-11 flex-1 items-center justify-center gap-2 rounded-card border text-sm font-medium transition-colors',
              autoChain
                ? 'border-accent/50 bg-accent/10 text-accent'
                : 'border-line bg-surface text-muted',
            ].join(' ')}
          >
            <InfinityIcon size={16} />
            Auto-chain {autoChain ? 'on' : 'off'}
            <span className="text-faint">· {GAP_SECONDS}s between holds</span>
          </button>
          <CountdownToggle exerciseId={exercise.id} compact shape="h-11 w-11 rounded-card" />
        </div>

        <button
          type="button"
          onClick={() => {
            haptic(HAPTIC.complete);
            onSetComplete(reps);
          }}
          disabled={reps === 0}
          className={[
            'h-14 w-full rounded-card text-base font-semibold transition-colors disabled:opacity-40',
            done ? 'bg-accent text-base' : 'border border-line bg-surface text-muted',
          ].join(' ')}
        >
          {done
            ? setIndex + 1 < exercise.sets
              ? 'Log set · rest'
              : 'Log final set'
            : `Log ${reps} hold${reps === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}

/** Reps within the set — for a McGill set of 6, six pips filling one at a time. */
function RepPips({ count, done }: { count: number; done: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={[
            'h-2.5 w-2.5 rounded-full transition-colors',
            i < done ? 'bg-accent' : 'bg-line',
          ].join(' ')}
        />
      ))}
    </div>
  );
}
