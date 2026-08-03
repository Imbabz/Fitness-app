import { Check, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Session } from '../types';
import { useApp } from '../state/AppStateContext';
import { detectPRs } from '../state/selectors';
import { humanDuration } from '../lib/time';
import { haptic, HAPTIC } from '../lib/haptics';

export function Summit({
  session,
  onSaved,
  onBack,
}: {
  session: Session;
  onSaved: () => void;
  onBack: () => void;
}) {
  const { state, finishSession } = useApp();
  const active = state.activeSession;

  const [note, setNote] = useState('');
  const [painFlag, setPainFlag] = useState(false);

  const elapsed = active ? Date.now() - new Date(active.startedAt).getTime() : 0;
  const sets = active?.sets ?? [];
  const totalSets = session.exercises.reduce((n, e) => n + e.sets, 0);

  const prs = useMemo(() => detectPRs(state.history, sets), [state.history, sets]);

  const save = () => {
    haptic(HAPTIC.complete);
    finishSession({ note, painFlag });
    onSaved();
  };

  return (
    <div className="ridge-enter flex min-h-dvh flex-col px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-faint">Summit</span>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink">{session.title} done.</h1>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat value={humanDuration(elapsed)} label="Elapsed" />
        <Stat value={`${sets.length} / ${totalSets}`} label="Sets logged" />
      </div>

      {prs.length > 0 && (
        <div className="mt-4 rounded-card border border-accent/35 bg-accent/[0.07] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent">
            <Trophy size={16} />
            {prs.length === 1 ? 'New best' : `${prs.length} new bests`}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {prs.map((pr) => (
              <li key={pr.exerciseId} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-muted">{pr.name}</span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">
                  {pr.weightKg} kg
                  {pr.previous !== null && (
                    <span className="ml-1 font-normal text-faint">from {pr.previous}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Domain rule 3. The wording is deliberately specific — "sore" is normal,
          radiating symptoms down a dermatome are not the same thing. */}
      <button
        type="button"
        onClick={() => {
          haptic(HAPTIC.tick);
          setPainFlag((v) => !v);
        }}
        className={[
          'mt-5 flex items-start gap-3 rounded-card border p-4 text-left transition-colors',
          painFlag ? 'border-danger/50 bg-danger/[0.09]' : 'border-line/60 bg-surface',
        ].join(' ')}
      >
        <span
          className={[
            'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors',
            painFlag ? 'border-danger bg-danger text-base' : 'border-line',
          ].join(' ')}
        >
          {painFlag && <Check size={15} strokeWidth={3} />}
        </span>
        <span className="text-sm leading-relaxed">
          <span className="block font-medium text-ink">
            Anything radiating into the glute, calf or heel?
          </span>
          <span className="mt-0.5 block text-faint">
            Local stiffness is fine. Symptoms travelling down the leg are the thing to record.
          </span>
        </span>
      </button>

      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-wider text-faint">Note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="How did it feel? Anything you changed?"
          className="mt-2 w-full resize-none rounded-card border border-line/60 bg-surface p-3.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent/50"
        />
      </label>

      <div className="mt-auto space-y-3 pt-8">
        <button
          type="button"
          onClick={save}
          className="h-16 w-full rounded-card bg-accent text-lg font-bold text-base active:opacity-90"
        >
          Save session
        </button>
        <button
          type="button"
          onClick={onBack}
          className="h-12 w-full rounded-card text-sm font-medium text-muted active:bg-raised"
        >
          Back to the last stage
        </button>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-line/60 bg-surface p-4">
      <div className="text-2xl font-bold tabular-nums text-ink">{value}</div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wider text-faint">{label}</div>
    </div>
  );
}
