import { Bell, BellOff, Minus, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Exercise, LoggedSet } from '../types';
import { haptic, HAPTIC } from '../lib/haptics';
import { useApp } from '../state/AppStateContext';

/**
 * The contract every tracker shares: it owns the current set, it emits a
 * LoggedSet on completion, and the stage handles rest + advancing. See
 * .claude/skills/tracker-component/SKILL.md.
 */
export interface TrackerProps {
  exercise: Exercise;
  setIndex: number;
  logged: LoggedSet[];
  weightKg: number | null;
  onWeightChange: (kg: number) => void;
  /** Fires once the set is done. `reps` is what was actually achieved. */
  onSetComplete: (reps: number) => void;
}

export function targetFor(exercise: Exercise, setIndex: number): number {
  return exercise.repScheme[setIndex] ?? exercise.repScheme.at(-1) ?? 1;
}

/** The big circular control every tracker is built around. Minimum 180px so it
 *  is hittable with a phone propped against a water bottle. */
export function Dial({
  progress,
  complete,
  children,
  label,
  accentClass = 'text-accent',
  ...handlers
}: {
  /** 0-1. Drives the ring. */
  progress: number;
  complete: boolean;
  children: ReactNode;
  label: string;
  accentClass?: string;
} & React.ComponentProps<'button'>) {
  const R = 86;
  const C = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <button
      type="button"
      aria-label={label}
      className={[
        'relative mx-auto grid aspect-square w-full max-w-[240px] min-w-[180px] place-items-center',
        'touch-none select-none rounded-full transition-colors',
        complete ? 'bg-accent/10' : 'bg-raised/60 active:bg-raised',
      ].join(' ')}
      {...handlers}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={R} className="stroke-line/70" strokeWidth="9" fill="none" />
        <circle
          cx="100"
          cy="100"
          r={R}
          className={`${complete ? accentClass : 'text-muted'} transition-colors duration-300`}
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 180ms ease-out' }}
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center">{children}</div>
    </button>
  );
}

/** Weight stepper. ±2.5kg per press, direct numeric entry on tap. */
export function WeightInput({
  weightKg,
  onChange,
  step = 2.5,
}: {
  weightKg: number | null;
  onChange: (kg: number) => void;
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const value = weightKg ?? 0;

  const bump = (delta: number) => {
    haptic(HAPTIC.tick);
    onChange(Math.max(0, Math.round((value + delta) * 10) / 10));
  };

  const commit = () => {
    const parsed = Number.parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) onChange(Math.round(parsed * 10) / 10);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        aria-label={`Decrease weight by ${step} kilograms`}
        onClick={() => bump(-step)}
        className="grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-muted active:bg-raised"
      >
        <Minus size={20} />
      </button>

      {editing ? (
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          step="0.5"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-12 w-28 rounded-lg border border-accent/60 bg-surface text-center text-xl font-semibold text-ink outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(value ? String(value) : '');
            setEditing(true);
          }}
          className="h-12 w-28 rounded-lg border border-line/70 bg-surface text-xl font-semibold tabular-nums text-ink active:bg-raised"
        >
          {value ? `${value}` : '—'}
          <span className="ml-1 text-sm font-normal text-faint">kg</span>
        </button>
      )}

      <button
        type="button"
        aria-label={`Increase weight by ${step} kilograms`}
        onClick={() => bump(step)}
        className="grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-muted active:bg-raised"
      >
        <Plus size={20} />
      </button>
    </div>
  );
}

/** Set position within the exercise. Reads the repScheme honestly, so a
 *  6/4/2 exercise shows three pips with three different targets. */
export function SetPips({
  exercise,
  setIndex,
  completedCount,
}: {
  exercise: Exercise;
  setIndex: number;
  completedCount: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {exercise.repScheme.map((target, i) => {
        const done = i < completedCount;
        const current = i === setIndex;
        return (
          <div
            key={i}
            className={[
              'flex h-7 min-w-[2rem] items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums transition-colors',
              done
                ? 'bg-accent/20 text-accent'
                : current
                  ? 'bg-raised text-ink ring-1 ring-accent/50'
                  : 'bg-surface text-faint',
            ].join(' ')}
          >
            {target}
          </div>
        );
      })}
    </div>
  );
}

/** Left / right indicator for bilateral holds. Both sides before the set counts. */
export function SideIndicator({ side }: { side: 'left' | 'right' }) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-widest">
      <span className={side === 'left' ? 'text-accent' : 'text-faint'}>Left</span>
      <span className="text-faint">·</span>
      <span className={side === 'right' ? 'text-accent' : 'text-faint'}>Right</span>
    </div>
  );
}

/**
 * Countdown beeps, on or off, for this exercise. The same control appears in
 * the config sheet and on every timer that exercise runs, all writing the one
 * per-exercise preference — so switching it off mid-set is remembered next time.
 *
 * `compact` drops to the bell alone, for rows that already have a primary
 * action competing for the width.
 */
export function CountdownToggle({
  exerciseId,
  compact = false,
  shape = 'h-12 w-12 rounded-full',
}: {
  exerciseId: string;
  compact?: boolean;
  /** Compact only. Matches the size and corner of whatever it sits beside. */
  shape?: string;
}) {
  const { state, updateSettings } = useApp();
  const on = state.settings.countdown[exerciseId] === true;

  const toggle = () => {
    haptic(HAPTIC.tick);
    updateSettings({
      countdown: { ...state.settings.countdown, [exerciseId]: !on },
    });
  };

  const tone = on
    ? 'border-accent/60 bg-accent/10 text-accent'
    : 'border-line bg-surface text-muted';

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        aria-label={`Countdown beeps ${on ? 'on' : 'off'}`}
        className={`grid ${shape} shrink-0 place-items-center border transition-colors ${tone}`}
      >
        {on ? <Bell size={17} /> : <BellOff size={17} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      className={`flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors ${tone}`}
    >
      {on ? <Bell size={15} /> : <BellOff size={15} />}
      Countdown {on ? 'on' : 'off'}
    </button>
  );
}
