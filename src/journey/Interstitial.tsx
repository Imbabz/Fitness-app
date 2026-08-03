import { useEffect } from 'react';
import type { Block } from '../types';
import { BLOCK_LABEL } from '../data/sessions';
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

export function Interstitial({ block, onDismiss }: { block: Block; onDismiss: () => void }) {
  useEffect(() => {
    haptic(HAPTIC.transition);
    const t = window.setTimeout(onDismiss, 1500);
    return () => window.clearTimeout(t);
  }, [block, onDismiss]);

  const copy = COPY[block];
  const spine = block === 'spine';

  return (
    <button
      type="button"
      onClick={onDismiss}
      className="ridge-interstitial fixed inset-0 z-50 flex w-full flex-col items-center justify-center gap-3 bg-base px-8 text-center"
    >
      <span
        className={[
          'text-xs font-semibold uppercase tracking-[0.25em]',
          spine ? 'text-spine' : 'text-accent',
        ].join(' ')}
      >
        {BLOCK_LABEL[block]}
      </span>
      <span className="text-3xl font-bold tracking-tight text-ink">{copy.line}</span>
      <span className="max-w-xs text-sm leading-relaxed text-muted">{copy.tone}</span>
    </button>
  );
}
