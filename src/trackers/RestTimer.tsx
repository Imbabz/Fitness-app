import { Plus, SkipForward } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCountdown, useCountdownBeeps } from './hooks';
import { haptic, HAPTIC } from '../lib/haptics';
import { beep } from '../lib/sound';
import { mmss } from '../lib/time';
import { useApp } from '../state/AppStateContext';
import type { Exercise } from '../types';
import { CountdownToggle, targetFor } from './shared';

/**
 * Shared across all tracker types. A bottom sheet rather than a full-screen
 * takeover, so the next set's target and the exercise cue stay readable behind
 * it. Suppressed after the final set of an exercise — that flows straight into
 * the next-stage prompt instead.
 */
export function RestTimer({
  exercise,
  nextSetIndex,
  seconds,
  onDone,
}: {
  exercise: Exercise;
  nextSetIndex: number;
  seconds: number;
  onDone: () => void;
}) {
  const { state } = useApp();
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000);

  const finish = useCallback(() => {
    haptic(HAPTIC.complete);
    if (state.settings.soundOnTimerEnd) beep(520, 0.25);
    onDone();
  }, [onDone, state.settings.soundOnTimerEnd]);

  const { remainingMs, remainingSeconds } = useCountdown(endsAt, finish);
  useCountdownBeeps(remainingSeconds, state.settings.countdown[exercise.id] !== false);
  const total = seconds * 1000;
  const elapsed = Math.min(1, Math.max(0, 1 - remainingMs / total));

  // Auto-close only fires through the countdown's own callback; this guards
  // against a stale sheet if the stage changes underneath it.
  useEffect(() => {
    setEndsAt(Date.now() + seconds * 1000);
  }, [seconds, exercise.id, nextSetIndex]);

  // Portalled to <body>: the sheet must anchor to the viewport, and any
  // transformed ancestor in the stage tree would silently re-anchor it.
  return createPortal(
    <div className="ridge-sheet fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-surface/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200 ease-linear"
            style={{ width: `${elapsed * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-4xl font-bold tabular-nums leading-none text-ink">
              {mmss(remainingMs / 1000)}
            </div>
            <div className="mt-1 text-sm text-muted">
              Set {nextSetIndex + 1}/{exercise.sets} ·{' '}
              <span className="text-ink">
                {targetFor(exercise, nextSetIndex)}
                {exercise.tracking === 'hold'
                  ? ` × ${exercise.holdSeconds}s`
                  : exercise.tracking === 'distance'
                    ? ' m'
                    : ' reps'}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <CountdownToggle exerciseId={exercise.id} compact />
            <button
              type="button"
              onClick={() => {
                haptic(HAPTIC.tick);
                setEndsAt((e) => e + 30_000);
              }}
              className="flex h-12 items-center gap-1 rounded-full border border-line bg-raised px-4 text-sm font-semibold text-ink active:opacity-80"
            >
              <Plus size={15} />
              30s
            </button>
            <button
              type="button"
              onClick={() => {
                haptic(HAPTIC.tick);
                onDone();
              }}
              className="flex h-12 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-base active:opacity-80"
            >
              <SkipForward size={15} />
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
