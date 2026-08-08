import { ArrowRight, Clock, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import type { Block, Exercise, Session } from '../types';
import { BLOCK_LABEL } from '../data/sessions';
import { ExerciseAnimation } from '../animations/registry';
import { PainFlagBanner } from './PainFlagBanner';
import { useApp } from '../state/AppStateContext';
import { painFlagFollowUp } from '../state/selectors';
import { TuningSheet } from './TuningSheet';

const BLOCK_DOT: Record<Block, string> = {
  warmup: 'bg-warmup',
  main: 'bg-main',
  spine: 'bg-spine',
  mobility: 'bg-mobility',
};

/**
 * The session preview. The elapsed clock does not start until Begin is pressed,
 * so standing in the changing room reading this costs nothing.
 */
export function Trailhead({
  session,
  onBegin,
  onExit,
}: {
  session: Session;
  onBegin: () => void;
  onExit: () => void;
}) {
  const { state } = useApp();
  const flagged = painFlagFollowUp(state, session);
  const [editing, setEditing] = useState<Exercise | null>(null);

  // The route profile: consecutive stages grouped into their blocks.
  const profile: Array<{ block: Block; count: number }> = [];
  for (const ex of session.exercises) {
    const last = profile.at(-1);
    if (last?.block === ex.block) last.count += 1;
    else profile.push({ block: ex.block, count: 1 });
  }

  return (
    <div className="ridge-enter flex min-h-dvh flex-col px-5 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-faint">
          Session {session.id}
        </span>
        <button
          type="button"
          onClick={onExit}
          aria-label="Leave session"
          className="grid h-11 w-11 place-items-center rounded-full text-muted active:bg-raised"
        >
          <X size={20} />
        </button>
      </div>

      <div className="mt-6">
        <h1 className="text-4xl font-bold tracking-tight text-ink">{session.title}</h1>
        <p className="mt-1 text-base text-muted">{session.subtitle}</p>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-faint">
          <Clock size={15} />
          about {session.durationMin} min · {session.exercises.length} stages
        </p>
      </div>

      {flagged && <PainFlagBanner flaggedOn={flagged.date} />}

      <div className="mt-7">
        <div className="mb-3 flex gap-[3px]">
          {profile.map((p, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full ${BLOCK_DOT[p.block]}`}
              style={{ flexGrow: p.count }}
            />
          ))}
        </div>

        <p className="mb-2 text-xs text-faint">Tap an exercise to adjust its sets, reps or rest.</p>

        <ul className="space-y-2">
          {session.exercises.map((ex, i) => (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => setEditing(ex)}
                aria-label={`Adjust ${ex.name}`}
                className={[
                  'flex w-full items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-colors active:bg-raised',
                  ex.block === 'spine'
                    ? 'border-spine/40 bg-spine/[0.07]'
                    : 'border-line/60 bg-surface',
                ].join(' ')}
              >
                <span
                  className={`h-8 w-1 shrink-0 rounded-full ${BLOCK_DOT[ex.block]} opacity-80`}
                  aria-hidden="true"
                />
                <span className="shrink-0 text-muted">
                  <ExerciseAnimation animation={ex.animation} size={30} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{ex.name}</span>
                  <span className="block truncate text-xs text-faint">{ex.prescription}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                    {i === 0 || session.exercises[i - 1]?.block !== ex.block
                      ? BLOCK_LABEL[ex.block]
                      : ''}
                  </span>
                  <SlidersHorizontal
                    size={14}
                    className={state.tuning[ex.id] ? 'text-accent' : 'text-faint/60'}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {editing && <TuningSheet exercise={editing} onClose={() => setEditing(null)} />}

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={onBegin}
          className="flex h-16 w-full items-center justify-center gap-2 rounded-card bg-accent text-lg font-bold text-base active:opacity-90"
        >
          Begin
          <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
}
