import { Plus, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { Session } from '../types';
import { BLOCK_LABEL } from '../data/sessions';
import { ExerciseAnimation } from '../animations/registry';
import { additionsFor } from '../state/tuning';
import { haptic, HAPTIC } from '../lib/haptics';

/**
 * Putting a movement into a session. The counterpart to swapping: without this
 * the library is only reachable by displacing something, so a session can never
 * grow and most of the library is invisible.
 *
 * Grouped by block, and only the blocks this session already has — adding a
 * spine movement to the nightly routine would invent a block the session was
 * never designed around.
 */
export function AddSheet({
  session,
  onAdd,
  onClose,
}: {
  session: Session;
  onAdd: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const groups = additionsFor(
    session,
    session.exercises.map((e) => e.id),
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-base/70 backdrop-blur-sm">
      <button type="button" aria-label="Close" className="flex-1" onClick={onClose} />

      <div className="ridge-sheet max-h-[88dvh] overflow-y-auto rounded-t-[1.75rem] border-t border-line bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl ridge-title text-ink">Add an exercise</h2>
            <p className="mt-0.5 text-xs text-faint">
              It joins the end of its block. {session.title} keeps its shape.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted active:bg-raised"
          >
            <X size={20} />
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="mt-5 rounded-card border border-line/50 bg-raised/40 p-4 text-sm text-muted">
            This session already contains every movement available to it.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.block} className="mt-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
                {BLOCK_LABEL[group.block]}
              </span>
              <div className="mt-2 space-y-1.5">
                {group.exercises.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      haptic(HAPTIC.complete);
                      onAdd(ex.id);
                    }}
                    className="flex w-full items-center gap-3 rounded-card border border-line/60 bg-raised/40 px-3 py-2.5 text-left active:bg-raised"
                  >
                    <span className="shrink-0 text-muted">
                      <ExerciseAnimation animation={ex.animation} size={26} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{ex.name}</span>
                      <span className="block truncate text-xs text-faint">{ex.prescription}</span>
                    </span>
                    <Plus size={16} className="shrink-0 text-faint" />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}
