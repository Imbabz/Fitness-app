import { Check, Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Dial, type TrackerProps } from './shared';
import { useCountdown, useWakeLock } from './hooks';
import { haptic, HAPTIC } from '../lib/haptics';
import { beep } from '../lib/sound';
import { mmss } from '../lib/time';
import { useApp } from '../state/AppStateContext';

/**
 * `tracking: 'duration'` — the 15-minute cardio warm-ups.
 *
 * Pausing is prominent: treadmills stop for all kinds of reasons. The countdown
 * stores a target end-timestamp rather than decrementing a counter, so screen
 * lock or backgrounding does not make it drift.
 */
export function DurationTimer({ exercise, onSetComplete }: TrackerProps) {
  const { state } = useApp();
  const totalMs = (exercise.durationSeconds ?? 900) * 1000;

  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(totalMs);
  const [finished, setFinished] = useState(false);

  const running = endsAt !== null;
  useWakeLock(running);

  useEffect(() => {
    setEndsAt(null);
    setPausedMs(totalMs);
    setFinished(false);
  }, [exercise.id, totalMs]);

  const onDone = useCallback(() => {
    setEndsAt(null);
    setPausedMs(0);
    setFinished(true);
    haptic(HAPTIC.complete);
    if (state.settings.soundOnTimerEnd) beep(520, 0.35);
  }, [state.settings.soundOnTimerEnd]);

  const { remainingMs } = useCountdown(endsAt, onDone);
  const displayMs = running ? remainingMs : pausedMs;

  const start = () => {
    haptic(HAPTIC.tick);
    setFinished(false);
    setEndsAt(Date.now() + pausedMs);
  };

  const pause = () => {
    haptic(HAPTIC.tick);
    setPausedMs(remainingMs);
    setEndsAt(null);
  };

  const reset = () => {
    haptic(HAPTIC.tick);
    setEndsAt(null);
    setPausedMs(totalMs);
    setFinished(false);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <Dial
        progress={1 - displayMs / totalMs}
        complete={finished}
        label={`Duration timer, ${mmss(displayMs / 1000)} remaining. Tap to ${running ? 'pause' : 'start'}.`}
        onClick={running ? pause : start}
      >
        {finished ? (
          <>
            <Check className="text-accent" size={44} strokeWidth={2.5} />
            <span className="mt-1 text-sm font-medium text-accent">Done</span>
          </>
        ) : (
          <>
            <span className="text-[3.5rem] font-bold leading-none tabular-nums text-ink">
              {mmss(displayMs / 1000)}
            </span>
            <span className="mt-1 text-sm font-medium text-faint">
              {running ? 'Tap to pause' : pausedMs === totalMs ? 'Tap to start' : 'Paused'}
            </span>
          </>
        )}
      </Dial>

      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={running ? pause : start}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-card bg-raised text-base font-semibold text-ink active:opacity-80"
        >
          {running ? <Pause size={20} /> : <Play size={20} />}
          {running ? 'Pause' : pausedMs === totalMs ? 'Start' : 'Resume'}
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="Reset timer"
          className="grid h-14 w-14 place-items-center rounded-card border border-line bg-surface text-muted active:bg-raised"
        >
          <RotateCcw size={20} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          haptic(HAPTIC.complete);
          // Recorded as one "rep" — the set is the block of time itself.
          onSetComplete(1);
        }}
        className={[
          'h-14 w-full rounded-card text-base font-semibold transition-colors',
          finished ? 'bg-accent text-base' : 'border border-line bg-surface text-muted',
        ].join(' ')}
      >
        {finished ? 'Warm-up done' : 'Mark done and move on'}
      </button>
    </div>
  );
}
