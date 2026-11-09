import { useEffect } from 'react';
import type { Block } from '../types';
import { BLOCK_LABEL } from '../data/sessions';
import { hourOf } from '../data/hours';
import { haptic, HAPTIC } from '../lib/haptics';

/*
 * Moving between blocks is a marked moment, not just the next card. This is the
 * app's one chance to change the user's mental gear — most of all before the
 * spine block, where the whole point is that the load is deliberately light.
 */
const COPY: Record<Block, { line: string; tone: string }> = {
  warmup: {
    line: 'Easy to start.',
    tone: 'Fifteen minutes of circulation before anything gets loaded.',
  },
  main: {
    line: 'The work.',
    tone: 'Full range, controlled. Chase the reps, not the weight.',
  },
  spine: {
    line: 'Slow down here.',
    tone: 'The load is light on purpose. This block earns its progress through tempo and control, never through the number on the bar.',
  },
  mobility: {
    line: 'Let the ribs settle.',
    tone: 'Nothing here should feel like effort. Breathe out and let the position do the work.',
  },
};

/**
 * The spine copy is the longest and the only one that is a medical
 * instruction rather than encouragement, so it waits for a tap instead of
 * expiring after a second and a half. Every other block still auto-dismisses.
 */
const DISMISS_MS = 1500;

/*
 * Les classes de mouvement, écrites en toutes lettres.
 *
 * Elles vivent dans `@layer components`, que Tailwind purge quand la classe
 * n'apparaît nulle part littéralement dans les sources. Un gabarit
 * `ridge-el-${motion}` est invisible pour son analyseur : la règle est
 * supprimée du bundle et l'animation ne tourne jamais, sans la moindre erreur.
 * C'est arrivé ici et seule une mesure de l'angle l'a montré.
 */
const MOTION = {
  sway: 'ridge-el-sway',
  drift: 'ridge-el-drift',
  flicker: 'ridge-el-flicker',
} as const;

export function Interstitial({ block, onDismiss }: { block: Block; onDismiss: () => void }) {
  const spine = block === 'spine';

  useEffect(() => {
    haptic(HAPTIC.transition);
    if (spine) return;
    const t = window.setTimeout(onDismiss, DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [block, onDismiss, spine]);

  const copy = COPY[block];
  const hour = hourOf(block);

  return (
    <button
      type="button"
      onClick={onDismiss}
      className="ridge-interstitial fixed inset-0 z-50 isolate flex w-full flex-col items-center justify-center gap-3 bg-base px-8 text-center"
      style={hour ? ({ '--hour-tint': hour.tint } as React.CSSProperties) : undefined}
    >
      {/*
        The hour. It sits in the top third and dissolves downwards into the
        page — a plate with a hard bottom edge would read as a banner pasted
        on, which is the thing to avoid. Below the fade nothing competes with
        the text.

        Decoration only: aria-hidden, pointer-events none, and it carries no
        information the copy does not already give.
      */}
      {hour && (
        <>
          <img
            src={hour.src}
            alt=""
            aria-hidden="true"
            className="ridge-hour pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42%] w-full object-cover"
          />
          <span
            aria-hidden="true"
            className="ridge-hour-tint pointer-events-none absolute inset-0 -z-10"
          />
          {hour.element && (
            <img
              src={hour.element.src}
              alt=""
              aria-hidden="true"
              style={{ height: hour.element.h }}
              className={[
                'pointer-events-none absolute bottom-0 -z-10 w-auto',
                'ridge-el',
                MOTION[hour.element.motion],
                hour.element.side === 'left' ? 'left-3' : 'right-3',
              ].join(' ')}
            />
          )}
        </>
      )}
      <span
        className={[
          'text-xs font-semibold ridge-label',
          spine ? 'text-spine' : 'text-accent',
        ].join(' ')}
      >
        {BLOCK_LABEL[block]}
      </span>
      <span className="text-3xl ridge-title text-ink">{copy.line}</span>
      <span className="max-w-xs text-sm leading-relaxed text-muted">{copy.tone}</span>
      {spine && (
        <span className="mt-4 text-xs font-semibold ridge-label text-faint">
          Tap to continue
        </span>
      )}
    </button>
  );
}
