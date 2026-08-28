import { ArrowRight, Check, Clock, Flame, Moon, TriangleAlert } from 'lucide-react';
import type { Session } from '../types';
import { useApp } from '../state/AppStateContext';
import { GYM_SESSIONS } from '../data/sessions';
import { dailyDoneToday, isTrainingDense, nextSession, tunedSession } from '../state/selectors';
import { WeekStrip } from '../components/WeekStrip';
import { ExerciseAnimation } from '../animations/registry';

/**
 * One home screen, two priorities. In day mode the gym session is the hero and
 * the routine is a chip; at night that inverts. The structure is shared so the
 * mode transition is genuinely a change of light, not a different screen.
 */
export function Home({ onOpen }: { onOpen: (session: Session) => void }) {
  const { state, setMode } = useApp();
  const night = state.mode === 'night';
  const upNext = nextSession(state);
  const daily = tunedSession(state, 'daily') as Session;
  const routineDone = dailyDoneToday(state);
  const dense = isTrainingDense(state);

  const greeting = night ? 'Wind it down' : hourGreeting();
  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const resuming = state.activeSession?.sessionId;

  return (
    <div className="ridge-enter space-y-6">
      <header>
        <h1 className="text-[2rem] ridge-title leading-tight text-ink">{greeting}</h1>
        <p className="mt-0.5 text-sm text-faint">{dateLine}</p>
      </header>

      {night ? (
        <>
          <HeroCard
            session={daily}
            done={routineDone}
            onOpen={onOpen}
            resuming={resuming === 'daily'}
          />
          <StreakLine />
          <TomorrowPreview session={upNext} />
        </>
      ) : (
        <>
          <HeroCard
            session={upNext}
            done={false}
            onOpen={onOpen}
            resuming={resuming === upNext.id}
          />

          {/* The streak is the main lever on daily compliance, so it belongs on
              the screen actually opened during the day, not only at night. */}
          <StreakLine />

          <div className="grid grid-cols-2 gap-3">
            {GYM_SESSIONS.filter((s) => s.id !== upNext.id).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpen(s)}
                className="rounded-card border border-line/60 bg-surface p-3.5 text-left active:bg-raised"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
                  Session {s.id}
                </span>
                <span className="mt-1 block text-base font-semibold text-ink">{s.title}</span>
                <span className="mt-0.5 block truncate text-xs text-faint">{s.subtitle}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMode('night')}
            className={[
              'flex h-14 w-full items-center gap-3 rounded-card border px-4 text-left transition-colors',
              routineDone
                ? 'border-mobility/40 bg-mobility/[0.08]'
                : 'border-line/60 bg-surface active:bg-raised',
            ].join(' ')}
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${routineDone ? 'bg-mobility/25 text-mobility' : 'bg-raised text-muted'}`}
            >
              {routineDone ? <Check size={16} strokeWidth={3} /> : <Moon size={15} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">
                {routineDone ? 'Daily routine done' : 'Daily routine — not yet done'}
              </span>
              <span className="block text-xs text-faint">
                {routineDone ? 'Nice. See you tomorrow.' : `${daily.durationMin} min · McGill Big 3`}
              </span>
            </span>
            <ArrowRight size={17} className="shrink-0 text-faint" />
          </button>
        </>
      )}

      {dense && (
        <div className="flex gap-2.5 rounded-card border border-line/60 bg-surface p-3.5 text-sm">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-faint" />
          <p className="leading-relaxed text-muted">
            Three gym sessions in four days. Not a problem in itself — just worth noticing, since
            adaptation happens on the rest days.
          </p>
        </div>
      )}

      <section>
        <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          Last 7 days
        </h2>
        <WeekStrip />
      </section>
    </div>
  );
}

function HeroCard({
  session,
  done,
  onOpen,
  resuming,
}: {
  session: Session;
  done: boolean;
  onOpen: (s: Session) => void;
  resuming: boolean;
}) {
  const summary = session.exercises
    .filter((e) => e.block === 'main' || e.block === 'mobility')
    .slice(0, 3)
    .map((e) => e.name)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={() => onOpen(session)}
      className="ridge-hero relative w-full overflow-hidden rounded-card border border-line/60 bg-surface p-5 text-left active:opacity-90"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            {resuming ? 'Resume' : done ? 'Done today' : session.id === 'daily' ? 'Tonight' : `Session ${session.id}`}
          </span>
          <h2 className="mt-1.5 text-3xl ridge-title text-ink">{session.title}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Clock size={14} />
            {session.durationMin} min · {session.exercises.length} stages
          </p>
        </div>
        <span className="shrink-0 text-accent">
          <ExerciseAnimation
            animation={session.exercises.find((e) => e.block !== 'warmup')?.animation ?? 'hinge'}
            size={64}
          />
        </span>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-faint">{summary}</p>

      <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-accent">
        {resuming ? 'Pick up where you left off' : done ? 'Do it again' : 'Start'}
        <ArrowRight size={16} />
      </div>
    </button>
  );
}

function StreakLine() {
  const { state } = useApp();
  const { current, longest } = state.streak;
  if (current === 0 && longest === 0) {
    return (
      <p className="text-sm text-faint">
        Do this every day. The streak starts counting once you do.
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <Flame size={15} className="text-accent" />
      <span className="font-semibold text-ink">{current} day{current === 1 ? '' : 's'}</span>
      <span className="text-faint">· best {longest}</span>
    </div>
  );
}

function TomorrowPreview({ session }: { session: Session }) {
  return (
    <div className="rounded-card border border-line/40 bg-surface/60 p-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
        Next gym session
      </span>
      <p className="mt-1 text-base font-semibold text-ink">
        {session.title}
        <span className="ml-2 text-sm font-normal text-faint">Session {session.id}</span>
      </p>
      <p className="mt-0.5 text-xs text-faint">{session.subtitle}</p>
    </div>
  );
}

function hourGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
