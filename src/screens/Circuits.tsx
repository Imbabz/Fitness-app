import { ChevronLeft, Plus, Repeat, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Session, Workout } from '../types';
import { useApp } from '../state/AppStateContext';
import { allWorkouts, tunedSession } from '../state/selectors';
import { formatOf, specOf } from '../data/hiit';
import { EXERCISE_BY_ID } from '../data/exercises';
import { ExerciseAnimation } from '../animations/registry';
import { haptic, HAPTIC } from '../lib/haptics';

/**
 * The circuits list: presets first, then what you built.
 *
 * A circuit opens as a Session like any other, so everything from here on —
 * the trailhead, the journey, the history entry — is the same code the gym
 * sessions use. Nothing about a circuit is a special case after this screen.
 */
export function Circuits({
  onOpen,
  onBuild,
  onBack,
}: {
  onOpen: (session: Session) => void;
  onBuild: (workout?: Workout) => void;
  onBack: () => void;
}) {
  const { state, deleteWorkout } = useApp();
  const [confirming, setConfirming] = useState<string | null>(null);
  const workouts = allWorkouts(state);

  return (
    <div className="ridge-enter space-y-5">
      <header className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted active:bg-raised"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[1.75rem] ridge-title leading-tight text-ink">Circuits</h1>
          <p className="text-sm text-faint">Rounds, not straight sets</p>
        </div>
      </header>

      <button
        type="button"
        onClick={() => {
          haptic(HAPTIC.tick);
          onBuild();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-line py-4 text-sm font-semibold text-muted active:bg-raised"
      >
        <Plus size={17} />
        Build a circuit
      </button>

      <ul className="space-y-2.5">
        {workouts.map((w) => {
          const session = tunedSession(state, w.id);
          const spec = specOf(w.config);
          const format = formatOf(w.config);
          const stations = w.exerciseIds.filter((id) => EXERCISE_BY_ID[id]);
          const lead = EXERCISE_BY_ID[stations[0] ?? ''];

          return (
            <li key={w.id} className="overflow-hidden rounded-card border border-line/60 bg-surface">
              <button
                type="button"
                onClick={() => session && onOpen(session)}
                className="flex w-full items-center gap-3.5 p-4 text-left active:bg-raised"
              >
                <span className="shrink-0 text-accent">
                  <ExerciseAnimation animation={lead?.animation ?? 'squat'} size={40} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-ink">{w.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-faint">
                    {stations.length} stations · {format.label} · {spec.rounds} rounds
                    {session ? ` · ${session.durationMin} min` : ''}
                  </span>
                  {w.note && (
                    <span className="mt-0.5 block truncate text-xs text-muted">{w.note}</span>
                  )}
                </span>
                <Repeat size={16} className="shrink-0 text-faint" />
              </button>

              {!w.builtIn && (
                <div className="flex items-center gap-2 border-t border-line/50 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      haptic(HAPTIC.tick);
                      onBuild(w);
                    }}
                    className="h-10 flex-1 rounded-lg bg-raised text-xs font-semibold text-muted active:opacity-80"
                  >
                    Edit
                  </button>
                  {confirming === w.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          haptic(HAPTIC.tick);
                          deleteWorkout(w.id);
                          setConfirming(null);
                        }}
                        className="h-10 rounded-lg bg-danger/20 px-3 text-xs font-semibold text-danger active:opacity-80"
                      >
                        Delete for good
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="h-10 rounded-lg px-3 text-xs font-semibold text-muted active:bg-raised"
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(w.id)}
                      aria-label={`Delete ${w.name}`}
                      className="grid h-10 w-11 place-items-center rounded-lg text-faint active:bg-raised"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-faint">
        Every circuit opens with four easy minutes, which is not optional and is not in the list
        below — interval work needs more warm-up than straight sets, not less. The Big 3 are
        deliberately not available as stations: they are judged on position, and against a clock
        while tired the position goes into flexion.
      </p>
    </div>
  );
}
