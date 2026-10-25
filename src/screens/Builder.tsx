import { Check, ChevronLeft, GripVertical, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { HiitConfig, Workout } from '../types';
import { useApp } from '../state/AppStateContext';
import {
  circuitByPattern,
  EQUIPMENT_LABEL,
  PATTERN_LABEL,
  type Equipment,
} from '../data/circuit';
import { EXERCISE_BY_ID } from '../data/exercises';
import {
  defaultHiit,
  formatOf,
  HIIT_FORMATS,
  HIIT_LEVELS,
  MAX_ROUNDS,
  MIN_ROUNDS,
  specOf,
} from '../data/hiit';
import { ExerciseAnimation } from '../animations/registry';
import { haptic, HAPTIC } from '../lib/haptics';

const KIT: Equipment[] = ['band', 'dip-bars', 'box'];

/**
 * Building a circuit: what kit you have, which stations, and the format.
 *
 * The order you pick them in is the order you run them in, which is why the
 * chosen list is shown separately and reorderable rather than being inferred
 * from the library's order. Alternating patterns is most of what makes a
 * circuit tolerable, so the chosen list labels each station's pattern and
 * flags two of the same in a row rather than preventing it — it is a hint, not
 * a rule, because sometimes two pulls in a row is exactly what you want.
 */
export function Builder({
  editing,
  onDone,
  onCancel,
}: {
  editing?: Workout;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const { saveWorkout } = useApp();
  const [name, setName] = useState(editing?.name ?? '');
  const [kit, setKit] = useState<Equipment[]>(() => {
    if (!editing) return [...KIT];
    // Re-open with whatever the saved circuit actually needs selected, so none
    // of its own stations are filtered out of the picker.
    const needed = new Set<Equipment>();
    for (const id of editing.exerciseIds) {
      for (const e of (EXERCISE_BY_ID[id] as { equipment?: Equipment[] })?.equipment ?? []) {
        needed.add(e);
      }
    }
    return KIT.filter((k) => needed.has(k));
  });
  const [chosen, setChosen] = useState<string[]>(editing?.exerciseIds ?? []);
  const [config, setConfig] = useState<HiitConfig>(editing?.config ?? defaultHiit());

  const groups = useMemo(() => circuitByPattern(kit), [kit]);
  const spec = specOf(config);
  const format = formatOf(config);
  const enough = chosen.length >= 2 && name.trim().length > 0;

  const toggle = (id: string) => {
    haptic(HAPTIC.tick);
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= chosen.length) return;
    haptic(HAPTIC.tick);
    setChosen((c) => {
      const next = [...c];
      [next[i], next[j]] = [next[j] as string, next[i] as string];
      return next;
    });
  };

  const save = () => {
    haptic(HAPTIC.transition);
    onDone(
      saveWorkout({
        id: editing?.id,
        name: name.trim(),
        note: `${chosen.length} stations · ${format.label}`,
        exerciseIds: chosen,
        config,
      }),
    );
  };

  return (
    <div className="ridge-enter space-y-5 pb-28">
      <header className="flex items-center gap-1">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted active:bg-raised"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-[1.75rem] ridge-title leading-tight text-ink">
          {editing ? 'Edit circuit' : 'Build a circuit'}
        </h1>
      </header>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name it"
        maxLength={40}
        className="h-14 w-full rounded-card border border-line/70 bg-surface px-4 text-lg font-semibold text-ink placeholder:font-normal placeholder:text-faint focus:border-accent/60 focus:outline-none"
      />

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase ridge-label text-faint">
          What you have
        </h2>
        <div className="flex flex-wrap gap-2">
          <span className="flex h-11 items-center rounded-full border border-line/50 bg-raised/50 px-4 text-sm text-faint">
            {EQUIPMENT_LABEL.bodyweight} — always
          </span>
          {KIT.map((k) => {
            const on = kit.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  haptic(HAPTIC.tick);
                  setKit((c) => (on ? c.filter((x) => x !== k) : [...c, k]));
                }}
                aria-pressed={on}
                className={[
                  'h-11 rounded-full border px-4 text-sm font-medium transition-colors',
                  on ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line bg-surface text-muted',
                ].join(' ')}
              >
                {EQUIPMENT_LABEL[k]}
              </button>
            );
          })}
        </div>
      </section>

      {chosen.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase ridge-label text-faint">
            In order · {chosen.length} stations
          </h2>
          <ol className="space-y-2">
            {chosen.map((id, i) => {
              const ex = EXERCISE_BY_ID[id];
              if (!ex) return null;
              const pattern = (ex as { pattern?: keyof typeof PATTERN_LABEL }).pattern;
              const prev = chosen[i - 1] ? EXERCISE_BY_ID[chosen[i - 1] as string] : undefined;
              const samePattern =
                prev && pattern && (prev as { pattern?: string }).pattern === pattern;

              return (
                <li
                  key={id}
                  className="flex items-center gap-2.5 rounded-card border border-line/60 bg-surface p-3"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-faint">
                    {i + 1}
                  </span>
                  <span className="shrink-0 text-accent">
                    <ExerciseAnimation animation={ex.animation} size={32} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{ex.name}</span>
                    <span
                      className={[
                        'block truncate text-xs',
                        samePattern ? 'text-danger' : 'text-faint',
                      ].join(' ')}
                    >
                      {pattern ? PATTERN_LABEL[pattern] : ''}
                      {samePattern ? ' — same as the one before' : ''}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label={`Move ${ex.name} earlier`}
                      onClick={() => move(i, -1)}
                      className="grid h-11 w-9 place-items-center rounded-lg text-faint active:bg-raised"
                    >
                      <GripVertical size={15} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${ex.name}`}
                      onClick={() => toggle(id)}
                      className="grid h-11 w-9 place-items-center rounded-lg text-faint active:bg-raised"
                    >
                      <X size={16} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase ridge-label text-faint">
          Stations
        </h2>
        <div className="space-y-4">
          {groups.map(({ pattern, exercises }) => (
            <div key={pattern}>
              <h3 className="mb-1.5 text-xs font-semibold text-muted">{PATTERN_LABEL[pattern]}</h3>
              <div className="flex flex-wrap gap-2">
                {exercises.map((ex) => {
                  const on = chosen.includes(ex.id);
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => toggle(ex.id)}
                      aria-pressed={on}
                      className={[
                        'flex min-h-[2.75rem] items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors',
                        on
                          ? 'border-accent/60 bg-accent/10 font-medium text-accent'
                          : 'border-line bg-surface text-muted',
                      ].join(' ')}
                    >
                      {on && <Check size={14} className="shrink-0" />}
                      {ex.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase ridge-label text-faint">
          Format
        </h2>
        <div className="flex gap-1.5">
          {HIIT_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                haptic(HAPTIC.tick);
                setConfig((c) => ({ ...c, format: f.id }));
              }}
              aria-pressed={f.id === config.format}
              aria-label={`${f.label} format — ${f.note}`}
              className={[
                'min-h-[3.25rem] flex-1 rounded-lg px-1.5 py-1.5 text-xs font-semibold transition-colors',
                f.id === config.format ? 'bg-accent text-base' : 'bg-raised text-muted',
              ].join(' ')}
            >
              {f.label}
              <span className="mt-0.5 block text-[10px] font-normal leading-tight opacity-80">
                {f.note}
              </span>
            </button>
          ))}
        </div>

        {!format.fixed && (
          <>
            <div className="mt-2 flex gap-1.5">
              {HIIT_LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    haptic(HAPTIC.tick);
                    setConfig((c) => ({ ...c, level: l.id }));
                  }}
                  aria-pressed={l.id === config.level}
                  className={[
                    'h-10 flex-1 rounded-lg text-xs font-semibold transition-colors',
                    l.id === config.level ? 'bg-accent text-base' : 'bg-raised text-muted',
                  ].join(' ')}
                >
                  {l.label}
                  <span className="block text-[10px] font-normal opacity-80">
                    {spec.timed ? `${l.work}/${l.rest}` : `${l.rest}s rest`}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 rounded-card border border-line/60 bg-surface px-4 py-2">
              <span className="text-sm font-medium text-ink">Rounds</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="One round fewer"
                  onClick={() =>
                    setConfig((c) => ({ ...c, rounds: Math.max(MIN_ROUNDS, c.rounds - 1) }))
                  }
                  className="grid h-11 w-11 place-items-center rounded-full text-muted active:bg-raised"
                >
                  −
                </button>
                <span className="min-w-[2.5rem] text-center text-base font-semibold tabular-nums text-ink">
                  {config.rounds}
                </span>
                <button
                  type="button"
                  aria-label="One round more"
                  onClick={() =>
                    setConfig((c) => ({ ...c, rounds: Math.min(MAX_ROUNDS, c.rounds + 1) }))
                  }
                  className="grid h-11 w-11 place-items-center rounded-full text-muted active:bg-raised"
                >
                  +
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-line/60 bg-base/95 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button
          type="button"
          disabled={!enough}
          onClick={save}
          className="h-14 w-full rounded-card bg-accent text-base font-semibold text-base transition-opacity disabled:opacity-40"
        >
          {enough
            ? `Save · ${chosen.length} stations, ${spec.rounds} rounds`
            : chosen.length < 2
              ? 'Pick at least two stations'
              : 'Give it a name'}
        </button>
      </div>
    </div>
  );
}
