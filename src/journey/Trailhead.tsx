import { ArrowRight, Clock, GripVertical, Plus, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { Block, Exercise, Session } from '../types';
import { BLOCK_LABEL } from '../data/sessions';
import { ExerciseAnimation } from '../animations/registry';
import { PainFlagBanner } from './PainFlagBanner';
import { useApp } from '../state/AppStateContext';
import { haptic, HAPTIC } from '../lib/haptics';
import { painFlagFollowUp } from '../state/selectors';
import { TuningSheet } from './TuningSheet';
import { AddSheet } from './AddSheet';

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
  const { state, moveExercise, addExercise, resetComposition } = useApp();
  const flagged = painFlagFollowUp(state, session);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [adding, setAdding] = useState(false);

  const listRef = useRef<HTMLUListElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const lastTops = useRef(new Map<string, number>());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dy, setDy] = useState(0);
  const drag = useRef({ startY: 0, rowH: 64 });

  // Only within a block: the block sequence is structural, so a drag that would
  // cross a boundary meets resistance instead of moving anything.
  const canMove = (i: number, delta: -1 | 1) => {
    const target = session.exercises[i + delta];
    return !!target && target.block === session.exercises[i]?.block;
  };

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const row = (e.currentTarget as HTMLElement).closest('li');
    // Row height plus the list's 8px gap: one row of travel is one swap.
    drag.current = { startY: e.clientY, rowH: (row?.offsetHeight ?? 56) + 8 };
    setDragId(id);
    setDy(0);
    haptic(HAPTIC.tick);
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (!dragId) return;
    let offset = e.clientY - drag.current.startY;
    const from = session.exercises.findIndex((x) => x.id === dragId);
    const dir: -1 | 1 = offset > 0 ? 1 : -1;

    if (Math.abs(offset) >= drag.current.rowH && canMove(from, dir)) {
      moveExercise(session.id, dragId, dir);
      drag.current.startY += dir * drag.current.rowH;
      offset -= dir * drag.current.rowH;
      haptic(HAPTIC.tick);
    }
    // Held at one row past the last legal position, so the block boundary is
    // something you can feel rather than a control that silently does nothing.
    const limit = drag.current.rowH;
    setDy(Math.max(-limit, Math.min(limit, offset)));
  };

  const endDrag = () => {
    if (dragId) haptic(HAPTIC.complete);
    setDragId(null);
    setDy(0);
  };

  /*
   * Reordering changes the DOM order, which CSS cannot transition on its own —
   * rows simply appear in their new places. FLIP fills that in: measure where
   * each row was, put it back there with a transform, then let it travel to
   * where it now is.
   *
   * The dragged row is skipped: it is already following the finger, and giving
   * it a second transform would fight that.
   */
  const orderKey = session.exercises.map((e) => e.id).join();
  useLayoutEffect(() => {
    const tops = new Map<string, number>();
    for (const [id, el] of rows.current) tops.set(id, el.getBoundingClientRect().top);

    for (const [id, el] of rows.current) {
      const was = lastTops.current.get(id);
      const now = tops.get(id);
      if (was === undefined || now === undefined || id === dragId) continue;

      const delta = was - now;
      if (Math.abs(delta) < 1) continue;

      el.style.transition = 'none';
      el.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform var(--t-motion) cubic-bezier(0.2, 0, 0, 1)';
        el.style.transform = '';
      });
    }
    lastTops.current = tops;
  }, [orderKey, dragId]);

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
        <h1 className="text-4xl ridge-title text-ink">{session.title}</h1>
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

        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-xs text-faint">
            Tap to swap, adjust or remove. Drag the handle to reorder.
          </p>
          {state.composition[session.id] && (
            <button
              type="button"
              onClick={() => resetComposition(session.id)}
              className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-raised px-3 text-xs font-semibold text-muted active:opacity-80"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          )}
        </div>

        <ul ref={listRef} className="space-y-2">
          {session.exercises.map((ex, i) => {
            const dragging = ex.id === dragId;
            return (
              <li
                key={ex.id}
                ref={(el) => {
                  if (el) rows.current.set(ex.id, el);
                  else rows.current.delete(ex.id);
                }}
                className="relative"
                style={
                  dragging
                    ? // `transition: none` so the finger is tracked exactly; the
                      // FLIP above would otherwise lag the drag by one frame.
                      { transform: `translateY(${dy}px)`, transition: 'none', zIndex: 20 }
                    : undefined
                }
              >
                <button
                  type="button"
                  onClick={() => setEditing(ex)}
                  aria-label={`Adjust ${ex.name}`}
                  className={[
                    'flex w-full items-center gap-3 rounded-card border py-2.5 pl-3 pr-12 text-left transition-colors active:bg-raised',
                    ex.block === 'spine'
                      ? 'border-spine/40 bg-spine/[0.07]'
                      : 'border-line/60 bg-surface',
                    dragging ? 'border-accent/60 shadow-lg' : '',
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
                      className={
                        state.tuning[ex.id] ? 'text-accent' : 'text-faint/60'
                      }
                    />
                  </span>
                </button>

                {/* Its own pointer target, so a tap on the row still opens the
                    sheet. `touch-none` stops the page scrolling under the drag. */}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Reorder ${ex.name}`}
                  onPointerDown={(e) => startDrag(e, ex.id)}
                  onPointerMove={onDragMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className={`absolute inset-y-0 right-0 grid w-11 touch-none place-items-center ${
                    dragging ? 'text-accent' : 'text-faint/50'
                  }`}
                >
                  <GripVertical size={17} />
                </span>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-card border border-dashed border-line text-sm font-medium text-muted active:bg-raised"
        >
          <Plus size={16} />
          Add an exercise
        </button>
      </div>

      {editing && (
        <TuningSheet session={session} exercise={editing} onClose={() => setEditing(null)} />
      )}
      {adding && (
        <AddSheet
          session={session}
          onAdd={(id) => {
            addExercise(session.id, id);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}

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
