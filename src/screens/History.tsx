import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../state/AppStateContext';
import { EXERCISE_BY_ID } from '../data/exercises';
import { SESSION_BY_ID } from '../data/sessions';
import { friendlyDate, humanDuration } from '../lib/time';
import { Sparkline } from '../components/Sparkline';
import type { CompletedSession } from '../types';

export function History() {
  const { state } = useApp();
  const sessions = useMemo(() => [...state.history].reverse(), [state.history]);

  const tracked = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const h of state.history) {
      for (const s of h.sets) {
        if (typeof s.weightKg !== 'number' || s.weightKg <= 0) continue;
        const arr = map.get(s.exerciseId) ?? [];
        arr.push(s.weightKg);
        map.set(s.exerciseId, arr);
      }
    }
    return [...map.entries()].filter(([, v]) => v.length >= 2);
  }, [state.history]);

  if (sessions.length === 0) {
    return (
      <div className="ridge-enter">
        <h1 className="text-[2rem] font-bold tracking-tight text-ink">History</h1>
        <p className="mt-6 rounded-card border border-line/60 bg-surface p-5 text-sm leading-relaxed text-muted">
          Nothing logged yet. Finish a session and it lands here — with the loads, so you have
          something concrete to show a physio rather than a memory of roughly how it went.
        </p>
      </div>
    );
  }

  return (
    <div className="ridge-enter space-y-7">
      <h1 className="text-[2rem] font-bold tracking-tight text-ink">History</h1>

      {tracked.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            Load over time
          </h2>
          <div className="space-y-1.5">
            {tracked.map(([id, values]) => (
              <div
                key={id}
                className="flex items-center justify-between gap-3 rounded-card border border-line/50 bg-surface px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-muted">
                  {EXERCISE_BY_ID[id]?.name ?? id}
                </span>
                <Sparkline values={values} width={72} />
                <span className="w-[4.5rem] shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-ink">
                  {values.at(-1)} kg
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          Sessions
        </h2>
        {sessions.map((h) => (
          <SessionRow key={`${h.startedAt}-${h.sessionId}`} entry={h} />
        ))}
      </section>
    </div>
  );
}

function SessionRow({ entry }: { entry: CompletedSession }) {
  const [open, setOpen] = useState(false);
  const session = SESSION_BY_ID[entry.sessionId];
  const elapsed =
    new Date(entry.finishedAt).getTime() - new Date(entry.startedAt).getTime();

  // Group by exercise, preserving the order they were performed in.
  const groups: Array<{ id: string; sets: CompletedSession['sets'] }> = [];
  for (const s of entry.sets) {
    const g = groups.find((x) => x.id === s.exerciseId);
    if (g) g.sets.push(s);
    else groups.push({ id: s.exerciseId, sets: [s] });
  }

  return (
    <div className="overflow-hidden rounded-card border border-line/50 bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-raised"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-xs font-bold text-accent">
          {entry.sessionId === 'daily' ? '·' : entry.sessionId}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">
            {session?.title ?? entry.sessionId}
            {entry.painFlag && (
              <AlertTriangle size={13} className="ml-1.5 inline align-[-1px] text-danger" />
            )}
          </span>
          <span className="block text-xs text-faint">
            {friendlyDate(entry.date)} · {humanDuration(elapsed)} · {entry.sets.length} sets
          </span>
        </span>
        <ChevronDown
          size={17}
          className={`shrink-0 text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-line/50 px-4 py-4">
          {groups.map((g) => {
            const ex = EXERCISE_BY_ID[g.id];
            return (
              <div key={g.id}>
                <div className="text-xs font-medium text-muted">{ex?.name ?? g.id}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {g.sets.map((s, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-raised px-2 py-1 text-[11px] font-medium tabular-nums text-ink"
                    >
                      {s.reps}
                      {ex?.tracking === 'hold' ? ' holds' : ex?.tracking === 'distance' ? ' m' : ''}
                      {typeof s.weightKg === 'number' && s.weightKg > 0 && (
                        <span className="text-faint"> · {s.weightKg} kg</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {entry.note && (
            <p className="border-l-2 border-line pl-3 text-sm italic leading-relaxed text-faint">
              {entry.note}
            </p>
          )}
          {entry.painFlag && (
            <p className="flex items-start gap-2 rounded-lg bg-danger/[0.08] p-2.5 text-xs leading-relaxed text-muted">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-danger" />
              Radiating symptoms flagged on this session.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
