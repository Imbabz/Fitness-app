import { Children, createContext, isValidElement, useContext, type CSSProperties, type ReactNode } from 'react';

/*
 * Shared conventions for every exercise animation. See
 * .claude/skills/exercise-animation/SKILL.md before adding one.
 *
 *  · 64×64 viewBox, always
 *  · stroke inherits `currentColor` so day/night theming is free
 *  · stroke-width 3, round caps
 *  · ground line in a muted colour for floor-based movements
 *  · loop 1.8–2.4s for day work, 2.8–3.2s for night work
 *  · legible at 28px — one clear articulated joint beats anatomy
 */

export interface AnimProps {
  /** Rendered pixel size. 140 on a stage, ~28 in a list. */
  size?: number;
  className?: string;
}

/**
 * Overrides every figure's loop length below it. Used to play a movement at the
 * tempo it is actually prescribed at — a 5-second descent shown in 5 seconds is
 * instruction; shown in 2 it is decoration. Set by `ExerciseAnimation`, so no
 * individual animation has to thread the value through.
 */
export const LoopOverride = createContext<number | null>(null);

/*
 * The body breathes.
 *
 * Every figure gets a slow vertical rise and fall on top of whatever its own
 * joints are doing, so a figure between reps is alive rather than switched off.
 * It is the cheapest way to make these read as drawn rather than diagrammed,
 * and it costs nothing: no new element, no new asset, one transform.
 *
 * Three things make it safe:
 *
 *  - It is a TRANSLATE and never a scale. The group wraps the animated joints,
 *    so a scale here would move where their origins land and quietly break the
 *    rigid-body rule; a translate shifts everything together and cannot.
 *  - The ground and any equipment stay out of it. They are the room, not the
 *    body, and a floor that breathes is a floor that is wrong. `Figure` sorts
 *    them out of the breathing group rather than asking each animation to.
 *  - Its period is the movement's loop times phi, so the two rhythms never
 *    settle into step with each other. A breath locked to the rep reads as one
 *    mechanism; drifting against it reads as two. That also avoids inventing a
 *    fourth timing constant, which the theme has a rule against.
 */
const ENVIRONMENT = new Set<unknown>([Ground, Prop]);

export function Figure({
  children,
  size = 64,
  loop = 2.2,
  className = '',
}: AnimProps & { children: ReactNode; loop?: number }) {
  const override = useContext(LoopOverride);
  const seconds = override ?? loop;

  const room: ReactNode[] = [];
  const body: ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    (isValidElement(child) && ENVIRONMENT.has(child.type) ? room : body).push(child);
  }

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`ridge-anim ${className}`}
      style={{ '--loop': `${seconds}s` } as CSSProperties}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {room}
      <g className="ra-breath">{body}</g>
    </svg>
  );
}

/** Floor reference. Muted so it reads as environment, not body. */
export function Ground({ y = 56, x1 = 6, x2 = 58 }: { y?: number; x1?: number; x2?: number }) {
  return <line x1={x1} y1={y} x2={x2} y2={y} className="ridge-ground" strokeWidth={2} />;
}

/** Equipment: bars, benches, walls. Same muted treatment as the ground. */
export function Prop({ children }: { children: ReactNode }) {
  return (
    <g className="ridge-ground" strokeWidth={2}>
      {children}
    </g>
  );
}

export function Head({ cx = 32, cy = 12, r = 5 }: { cx?: number; cy?: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} />;
}
