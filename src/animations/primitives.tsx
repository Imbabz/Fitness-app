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

/**
 * Floor reference. Muted so it reads as environment, not body.
 *
 * A tapered brush mark rather than a line, because a stroke of constant
 * thickness is a pictogram and not a drawing — see the `visual-language`
 * skill. It is a filled lens shape: swelling through the middle, coming to a
 * point at both ends, and deliberately lopsided (the swell sits at 45% on the
 * way out and 55% on the way back) so it does not read as machine-made.
 *
 * Filled, so it carries its own class rather than the stroked `ridge-ground`
 * one — a CSS `stroke` declaration beats a `stroke="none"` attribute, and the
 * mark would have picked up the figure's full stroke weight on top of its fill.
 */
export function Ground({ y = 56, x1 = 6, x2 = 58 }: { y?: number; x1?: number; x2?: number }) {
  const span = x2 - x1;
  const t = Math.min(1.5, Math.max(0.6, span * 0.029)); // half-thickness at the swell
  const d =
    `M${x1} ${y}` +
    `Q${(x1 + span * 0.45).toFixed(1)} ${(y - t).toFixed(1)} ${x2} ${(y - t * 0.14).toFixed(1)}` +
    `Q${(x1 + span * 0.55).toFixed(1)} ${(y + t).toFixed(1)} ${x1} ${y}Z`;
  return <path d={d} className="ridge-ground-mark" />;
}

/** Equipment: bars, benches, walls. Same muted treatment as the ground. */
export function Prop({ children }: { children: ReactNode }) {
  return (
    <g className="ridge-ground" strokeWidth={2}>
      {children}
    </g>
  );
}

/**
 * The head carries slightly more weight than the limbs.
 *
 * The other half of what separates a drawing from a pictogram is a hierarchy
 * of weight — a drawn figure is not one uniform line. A head is the mark you
 * commit to first and it reads heavier; everything else hangs off it. The
 * difference is small on purpose: enough to feel deliberate, not enough to
 * notice as a decision.
 */
export function Head({ cx = 32, cy = 12, r = 5 }: { cx?: number; cy?: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} className="ridge-head" />;
}
