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
  /*
   * Le cadran est un 円相 : un cercle tracé d'un seul geste, qui ne se referme
   * pas tout à fait.
   *
   * Ce qu'il y avait avant : une piste grise de 9 px, pleine, et un arc de la
   * même épaisseur par-dessus. Un indicateur d'interface. Trois choses le
   * font basculer dans le registre du trait :
   *
   *  - La piste s'ouvre en haut. Un cercle parfait est une forme produite ;
   *    celui qui garde l'écart du pinceau est une forme tracée. L'écart est
   *    au sommet, là où le geste commence et finit.
   *  - La piste maigrit à 2,5 px et l'arc actif reste épais : l'encre est
   *    dans ce qui est fait, pas dans ce qui reste à faire.
   *  - L'arc porte un second trait, plus fin, légèrement au large et à demi
   *    transparent. C'est le bord chargé du pinceau. De près on le voit, de
   *    loin il donne seulement au trait une épaisseur qui n'est pas constante.
   *
   * L'arc n'apparaît pas avant d'être assez long pour être un trait : en
   * dessous, un bout d'arc à bout rond n'est pas un début de cercle, c'est
   * un point posé à côté du cercle.
   *
   * Le fond plein disparaît. Ce qui tenait la cible tactile, c'est la taille
   * du bouton, pas sa couleur de remplissage — et un disque gris sous un
   * cercle d'encre, c'est le cercle qui perd.
   */
  const R = 86;
  const C = 2 * Math.PI * R;
  const clamped = Math.max(0, Math.min(1, progress));
  // L'ouverture, en fraction du tour. 0,035 ≈ 12,6°.
  const GAP = 0.035;
  const arc = (frac: number) => `${C * frac} ${C}`;

  return (
    <button
      type="button"
      aria-label={label}
      className={[
        'relative mx-auto grid aspect-square w-full max-w-[240px] min-w-[180px] place-items-center',
        'touch-none select-none rounded-full transition-colors',
        complete ? 'bg-accent/[0.07]' : 'bg-raised/25 active:bg-raised/60',
      ].join(' ')}
      {...handlers}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
        {/* L'écart est au sommet, et tout ce qui tourne part de son bord :
            piste comme arc actif. Sans cette rotation, l'arc commençait au
            sommet exact, c'est-à-dire au milieu de l'ouverture — à une
            seconde de course on voyait un point isolé flotter dans le vide
            du cercle, ce qui se lit comme une poussière, pas comme un début. */}
        <g transform={`rotate(${GAP * 180} 100 100)`}>
          <circle
            cx="100"
            cy="100"
            r={R}
            /* La piste porte un état : elle doit se voir. `--c-line` est une
               couleur de bordure de carte, à 1,2:1 du fond en clair — un
               cercle qu'on devine. Mesurée, la valeur ci-dessous tient
               au-dessus de 3:1 dans les deux modes, ce qui est le minimum
               pour un trait qui n'est pas du texte mais qui dit quelque
               chose. */
            className="stroke-faint/75"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={arc(1 - GAP)}
          />
          {clamped > 0.012 && (
            <>
              <circle
                cx="100"
                cy="100"
                r={R}
                className={`${complete ? accentClass : 'text-ink'} transition-colors duration-300`}
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={arc(clamped * (1 - GAP))}
                style={{ transition: 'stroke-dasharray 180ms ease-out' }}
              />
              {/* Le bord chargé du pinceau. */}
              <circle
                cx="100"
                cy="100"
                r={R + 4.2}
                className={complete ? accentClass : 'text-ink'}
                stroke="currentColor"
                strokeOpacity="0.28"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={arc(clamped * (1 - GAP))}
                style={{ transition: 'stroke-dasharray 180ms ease-out' }}
              />
            </>
          )}
        </g>
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
    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold ridge-label">
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
  const on = state.settings.countdown[exerciseId] !== false;

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
