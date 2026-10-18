import { Check, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { CountdownToggle, Dial, SetPips, WeightInput, type TrackerProps } from './shared';
import { useCountdown, useCountdownBeeps, useWakeLock } from './hooks';
import { haptic, HAPTIC } from '../lib/haptics';
import { beep } from '../lib/sound';
import { mmss } from '../lib/time';
import { useApp } from '../state/AppStateContext';

/**
 * `tracking: 'interval'` — one round of a HIIT circuit.
 *
 * A round is one work bout, so this logs exactly one set and hands back to the
 * stage, which moves on to the next exercise in the circuit. The rest between
 * exercises is the stage's RestTimer, as it is everywhere else — this tracker
 * owns the work bout and nothing more.
 *
 * The clock runs on an end-timestamp rather than a counter, so locking the
 * screen mid-bout does not cost you seconds.
 */
export function IntervalTimer({
  exercise,
  setIndex,
  logged,
  weightKg,
  onWeightChange,
  onSetComplete,
}: TrackerProps) {
  const { state } = useApp();
  const workSeconds = exercise.holdSeconds ?? 40;
  const totalMs = workSeconds * 1000;

  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(totalMs);
  const [done, setDone] = useState(false);

  const running = endsAt !== null;
  useWakeLock(running);

  // A new round starts fresh. Walking back to an earlier exercise and
  // returning lands here too, which is correct — that round is already banked.
  useEffect(() => {
    setEndsAt(null);
    setPausedMs(totalMs);
    setDone(false);
  }, [exercise.id, setIndex, totalMs]);

  const finish = useCallback(() => {
    setEndsAt(null);
    setPausedMs(0);
    setDone(true);
    haptic(HAPTIC.complete);
    if (state.settings.soundOnTimerEnd) beep(520, 0.3);
  }, [state.settings.soundOnTimerEnd]);

  const { remainingMs, remainingSeconds } = useCountdown(endsAt, finish);
  useCountdownBeeps(remainingSeconds, running && state.settings.countdown[exercise.id] !== false);
  const displayMs = running ? remainingMs : pausedMs;

  const start = () => {
    haptic(HAPTIC.tick);
    setDone(false);
    setEndsAt(Date.now() + pausedMs);
  };

  const pause = () => {
    haptic(HAPTIC.tick);
    setPausedMs(remainingMs);
    setEndsAt(null);
  };

  const round = setIndex + 1;
  // Every round already banked. Journey moves on before this is normally
  // reachable, but without the guard a stray tap keeps logging rounds that do
  // not exist — which is how one exercise ended up with 37 of them.
  const allRoundsDone = logged.length >= exercise.sets;

  return (
    <div className="ridge-stack">
      <Dial
        progress={1 - displayMs / totalMs}
        complete={done}
        label={`Interval timer, round ${round} of ${exercise.sets}, ${mmss(displayMs / 1000)} remaining. Tap to ${running ? 'pause' : 'start'}.`}
        onClick={running ? pause : start}
      >
        {done ? (
          <>
            <Check className="text-accent" size={44} strokeWidth={2.5} />
            <span className="mt-1 text-sm font-medium text-accent">Round done</span>
          </>
        ) : (
          <>
            <span className="text-[3.5rem] font-bold leading-none tabular-nums text-ink">
              {mmss(displayMs / 1000)}
            </span>
            <span className="mt-1 text-sm font-medium text-faint">
              {running ? 'Work' : pausedMs === totalMs ? 'Tap to start' : 'Paused'}
            </span>
          </>
        )}
      </Dial>

      <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-2">
        {/* Pips count rounds here, not sets of reps — one bout per round. */}
        <SetPips exercise={exercise} setIndex={setIndex} completedCount={logged.length} />
        <span className="text-xs font-semibold uppercase tracking-wider text-faint">
          Round {round}/{exercise.sets}
        </span>
      </div>

      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={running ? pause : start}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-card bg-raised text-base font-semibold text-ink active:opacity-80"
        >
          {running ? <Pause size={20} /> : <Play size={20} />}
          {running ? 'Pause' : pausedMs === totalMs ? 'Start' : 'Resume'}
        </button>
        <CountdownToggle exerciseId={exercise.id} compact shape="h-14 w-14 rounded-card" />
      </div>

      {exercise.loadTracked && <WeightInput weightKg={weightKg} onChange={onWeightChange} />}

      {/* Banking the round early is allowed: a circuit you cannot cut short is
          a circuit you abandon entirely. */}
      <button
        type="button"
        disabled={allRoundsDone}
        onClick={() => {
          haptic(HAPTIC.complete);
          setEndsAt(null);
          onSetComplete(1);
        }}
        className={[
          'h-14 w-full rounded-card text-base font-semibold transition-colors disabled:opacity-40',
          done ? 'bg-accent text-base' : 'border border-line bg-surface text-muted',
        ].join(' ')}
      >
        {allRoundsDone
          ? 'All rounds done'
          : done
            ? round < exercise.sets
              ? 'Log round · rest'
              : 'Log final round'
            : 'Log round and move on'}
      </button>
    </div>
  );
}
