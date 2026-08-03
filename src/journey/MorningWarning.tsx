import { Sunrise, X } from 'lucide-react';

/**
 * Domain rule 5. Discs rehydrate overnight and are at their most pressurised
 * first thing, which is exactly when repeated flexion or extension is least
 * advisable. Dismissible — this is a note, not a gate.
 */
export function MorningWarning({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mt-5 flex gap-3 rounded-card border border-line/60 bg-surface p-4">
      <Sunrise size={18} className="mt-0.5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p className="font-medium text-ink">It is early.</p>
        <p className="mt-1 text-muted">
          Discs take on water overnight and are at their most pressurised in the first hour after
          getting up. If you can wait an hour before doing this, it is worth it — especially the
          cobra.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-faint active:bg-raised"
      >
        <X size={16} />
      </button>
    </div>
  );
}
