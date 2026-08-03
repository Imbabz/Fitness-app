import type { CSSProperties, ReactNode } from 'react';

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

export function Figure({
  children,
  size = 64,
  loop = 2.2,
  className = '',
}: AnimProps & { children: ReactNode; loop?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`ridge-anim ${className}`}
      style={{ '--loop': `${loop}s` } as CSSProperties}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
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
