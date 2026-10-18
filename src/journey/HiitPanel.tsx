import { Minus, Plus, Timer } from 'lucide-react';
import type { Session } from '../types';
import { DEFAULT_ROUNDS, defaultHiit, HIIT_LEVELS, levelOf, MAX_ROUNDS, MIN_ROUNDS } from '../data/hiit';
import { useApp } from '../state/AppStateContext';
import { haptic, HAPTIC } from '../lib/haptics';

/**
 * Turning a gym session into a circuit.
 *
 * Only offered on day sessions: the night routine is the McGill Big 3, which
 * are judged on position and must never be raced. The panel says what it will
 * and will not touch, because "HIIT mode" sounds like it applies to everything
 * and here it deliberately does not.
 */
export function HiitPanel({ session }: { session: Session }) {
  const { state, setHiit } = useApp();
  if (session.mode !== 'day') return null;

  const config = state.hiit[session.id];
  const on = config !== undefined;
  const level = config ? levelOf(config) : levelOf(defaultHiit());
  const rounds = config?.rounds ?? DEFAULT_ROUNDS;
  const main = session.exercises.filter((ex) => ex.block === 'main').length;

  const set = (next: Partial<{ level: string; rounds: number }>) => {
    haptic(HAPTIC.tick);
    const base = config ?? defaultHiit();
    setHiit(session.id, {
      level: (next.level ?? base.level) as typeof base.level,
      rounds: Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, next.rounds ?? base.rounds)),
    });
  };

  return (
    <div
      className={[
        'mt-3 rounded-card border transition-colors',
        on ? 'border-accent/50 bg-accent/[0.06]' : 'border-line/60 bg-surface',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => {
          haptic(HAPTIC.tick);
          setHiit(session.id, on ? null : defaultHiit());
        }}
        aria-pressed={on}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <Timer size={18} className={on ? 'text-accent' : 'text-faint'} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">Circuit mode</span>
          <span className="block text-xs text-faint">
            {on
              ? `${rounds} rounds · ${level.work}s work · ${level.rest}s rest`
              : 'Turn the main work into timed rounds'}
          </span>
        </span>
        <span
          className={[
            'relative h-8 w-14 shrink-0 rounded-full transition-colors',
            on ? 'bg-accent' : 'bg-raised',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-1 h-6 w-6 rounded-full bg-ink transition-transform duration-200',
              on ? 'translate-x-7' : 'translate-x-1',
            ].join(' ')}
          />
        </span>
      </button>

      {on && (
        <div className="space-y-3 border-t border-line/50 px-4 py-3.5">
          <div className="flex gap-1.5">
            {HIIT_LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => set({ level: l.id })}
                aria-pressed={l.id === config?.level}
                className={[
                  'h-10 flex-1 rounded-lg text-xs font-semibold transition-colors',
                  l.id === config?.level ? 'bg-accent text-base' : 'bg-raised text-muted',
                ].join(' ')}
              >
                {l.label}
                <span className="block text-[10px] font-normal opacity-80">
                  {l.work}/{l.rest}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-ink">Rounds</span>
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-line/70 bg-raised/60 p-1">
              <button
                type="button"
                aria-label="One round fewer"
                onClick={() => set({ rounds: rounds - 1 })}
                className="grid h-11 w-11 place-items-center rounded-full text-muted active:bg-surface"
              >
                <Minus size={16} />
              </button>
              <span className="min-w-[2.5rem] text-center text-base font-semibold tabular-nums text-ink">
                {rounds}
              </span>
              <button
                type="button"
                aria-label="One round more"
                onClick={() => set({ rounds: rounds + 1 })}
                className="grid h-11 w-11 place-items-center rounded-full text-muted active:bg-surface"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* The constraint, stated where it is acted on rather than buried. */}
          <p className="text-xs leading-relaxed text-faint">
            {main} main {main === 1 ? 'exercise' : 'exercises'} become a circuit, repeated {rounds}{' '}
            times. <span className="text-muted">The spine block and the warm-up stay as they are</span>{' '}
            — the Big 3 are judged on position, and against a clock while tired the position goes
            into flexion, which is the thing this programme exists to avoid.
          </p>
        </div>
      )}
    </div>
  );
}
