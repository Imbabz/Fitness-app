import type { ReactNode } from 'react';
import { Figure, Ground, Head, LoopOverride, Prop, type AnimProps } from './primitives';
import './animations.css';

/*
 * One stick figure per movement. 64×64, 2-3 stroke elements, pure CSS keyframes
 * (see animations.css).
 *
 * Design rule that keeps these honest: every animated limb is a RIGID group
 * rotating about its proximal joint, or a rigid body translating. Nothing is
 * ever animated in a way that detaches an endpoint from what it is attached to.
 * Where a real movement needs a joint the stick figure does not have, nested
 * groups are used (see `roll` and `hinge`) rather than faking it.
 *
 * Day loops run 1.8-2.4s and snap. Night loops run 2.8-3.2s and breathe.
 */

const legs = (hipX = 32, hipY = 38, footY = 54, spread = 6) => (
  <>
    <line x1={hipX} y1={hipY} x2={hipX - spread} y2={footY} />
    <line x1={hipX} y1={hipY} x2={hipX + spread} y2={footY} />
  </>
);

// ── Day · warm-up ──────────────────────────────────────────────────────────

const bike = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2} className={className}>
    <Ground y={58} />
    <Prop>
      <circle cx={36} cy={46} r={8} />
      <line x1={40} y1={29} x2={46} y2={25} />
    </Prop>
    <Head cx={20} cy={16} r={4.5} />
    <line x1={21} y1={20.5} x2={28} y2={34} />
    <line x1={22} y1={23} x2={40} y2={29} />
    <g className="ra-bike-leg">
      <polyline points="28,34 36,40 36,46" />
    </g>
    <g className="ra-bike-crank">
      <line x1={36} y1={46} x2={36} y2={39} />
    </g>
  </Figure>
);

const scapRetract = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.2} className={className}>
    <Ground />
    <Head />
    <line x1={32} y1={17} x2={32} y2={38} />
    {legs()}
    <g className="ra-open-l">
      <polyline points="32,22 20,22 20,31" />
    </g>
    <g className="ra-open-r">
      <polyline points="32,22 44,22 44,31" />
    </g>
  </Figure>
);

const pullApart = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2} className={className}>
    <Ground />
    <Head />
    <line x1={32} y1={17} x2={32} y2={38} />
    {legs()}
    <Prop>
      <path d="M16 26 Q32 21 48 26" />
    </Prop>
    <g className="ra-open-l">
      <line x1={32} y1={22} x2={16} y2={26} />
    </g>
    <g className="ra-open-r">
      <line x1={32} y1={22} x2={48} y2={26} />
    </g>
  </Figure>
);

const wristRotate = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={1.8} className={className}>
    <line x1={20} y1={48} x2={32} y2={32} />
    <g className="ra-wrist-hand">
      <polyline points="32,32 42,25 48,27" />
      <line x1={42} y1={25} x2={44} y2={18} />
    </g>
  </Figure>
);

// ── Day · main work ────────────────────────────────────────────────────────

const pull = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.2} className={className}>
    <Ground />
    <Prop>
      <line x1={10} y1={14} x2={54} y2={14} className="ra-pull-bar" />
    </Prop>
    <Head cx={32} cy={21} />
    <line x1={32} y1={26} x2={32} y2={42} />
    {legs(32, 42, 54, 7)}
    <g className="ra-pull-arm-l">
      <line x1={32} y1={30} x2={14} y2={14} />
    </g>
    <g className="ra-pull-arm-r">
      <line x1={32} y1={30} x2={50} y2={14} />
    </g>
  </Figure>
);

const pullup = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.4} className={className}>
    <Prop>
      <line x1={10} y1={12} x2={54} y2={12} />
    </Prop>
    <g className="ra-pullup-body">
      <Head cx={32} cy={24} />
      <line x1={32} y1={29} x2={32} y2={42} />
      {legs(32, 42, 56, 5)}
    </g>
    <g className="ra-pullup-arm-l">
      <line x1={22} y1={12} x2={32} y2={29} />
    </g>
    <g className="ra-pullup-arm-r">
      <line x1={42} y1={12} x2={32} y2={29} />
    </g>
  </Figure>
);

const row = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.2} className={className}>
    <Ground y={58} />
    <Prop>
      <line x1={56} y1={22} x2={56} y2={50} />
    </Prop>
    <Head cx={20} cy={20} />
    <line x1={20} y1={25} x2={20} y2={42} />
    <line x1={20} y1={42} x2={36} y2={44} />
    <line x1={36} y1={44} x2={36} y2={54} />
    <g className="ra-row-arm">
      <polyline points="20,28 34,25 46,29" />
      <line x1={44} y1={23} x2={44} y2={35} />
    </g>
  </Figure>
);

const curl = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2} className={className}>
    <Ground />
    <Head />
    <line x1={32} y1={17} x2={32} y2={38} />
    {legs()}
    <line x1={32} y1={22} x2={24} y2={34} />
    <g className="ra-curl-forearm">
      <line x1={24} y1={34} x2={20} y2={46} />
      <line x1={16} y1={46} x2={24} y2={46} />
    </g>
  </Figure>
);

const press = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.2} className={className}>
    <Ground />
    <Prop>
      <line x1={12} y1={42} x2={50} y2={42} />
    </Prop>
    <Head cx={16} cy={37} r={4.5} />
    <line x1={21} y1={39} x2={42} y2={39} />
    <line x1={42} y1={39} x2={50} y2={47} />
    <line x1={50} y1={47} x2={50} y2={54} />
    <g className="ra-press-arm">
      <line x1={24} y1={38} x2={24} y2={24} />
      <line x1={17} y1={24} x2={31} y2={24} />
    </g>
  </Figure>
);

const dip = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.2} className={className}>
    <Prop>
      <line x1={14} y1={24} x2={28} y2={24} />
      <line x1={36} y1={24} x2={50} y2={24} />
    </Prop>
    <g className="ra-dip-body">
      <Head cx={32} cy={13} r={4.5} />
      <line x1={32} y1={17.5} x2={32} y2={34} />
      {legs(32, 34, 46, 4)}
    </g>
    <g className="ra-dip-arm-l">
      <line x1={24} y1={24} x2={32} y2={18} />
    </g>
    <g className="ra-dip-arm-r">
      <line x1={40} y1={24} x2={32} y2={18} />
    </g>
  </Figure>
);

const shoulderPress = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.2} className={className}>
    <Ground y={54} />
    <Prop>
      <line x1={44} y1={20} x2={44} y2={44} />
    </Prop>
    <Head cx={32} cy={16} />
    <line x1={32} y1={21} x2={32} y2={38} />
    {legs(32, 38, 50, 6)}
    <g className="ra-shoulder-arm-l">
      <polyline points="32,24 20,30 20,20" />
      <line x1={15} y1={20} x2={25} y2={20} />
    </g>
    <g className="ra-shoulder-arm-r">
      <polyline points="32,24 44,30 44,20" />
      <line x1={39} y1={20} x2={49} y2={20} />
    </g>
  </Figure>
);

const externalRotation = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2} className={className}>
    <Ground />
    <Head />
    <line x1={32} y1={17} x2={32} y2={38} />
    {legs()}
    <line x1={32} y1={22} x2={26} y2={32} />
    <g className="ra-extrot-forearm">
      <line x1={26} y1={32} x2={40} y2={34} />
    </g>
  </Figure>
);

const carry = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2} className={className}>
    <Ground />
    <Head />
    <line x1={32} y1={17} x2={32} y2={36} />
    <g className="ra-carry-leg-l">
      <line x1={32} y1={36} x2={28} y2={54} />
    </g>
    <g className="ra-carry-leg-r">
      <line x1={32} y1={36} x2={36} y2={54} />
    </g>
    <g className="ra-carry-load">
      <line x1={27} y1={22} x2={24} y2={38} />
      <line x1={37} y1={22} x2={40} y2={38} />
      <line x1={18} y1={38} x2={30} y2={38} />
      <line x1={34} y1={38} x2={46} y2={38} />
    </g>
  </Figure>
);

const pinch = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.4} className={className}>
    <Ground y={58} />
    <g className="ra-pinch-lift">
      <line x1={32} y1={10} x2={32} y2={30} />
      <polyline points="28,30 32,34 36,30" />
      <rect x={26} y={36} width={12} height={16} rx={1.5} />
    </g>
  </Figure>
);

// ── Day · spine block ──────────────────────────────────────────────────────

const roll = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.8} className={className}>
    <Prop>
      <line x1={20} y1={54} x2={44} y2={54} />
    </Prop>
    {legs(32, 36, 54, 4)}
    <g className="ra-roll-lower">
      <line x1={32} y1={36} x2={32} y2={28} />
      <g className="ra-roll-upper">
        <line x1={32} y1={28} x2={32} y2={20} />
        <Head cx={32} cy={15} r={4.5} />
        <g className="ra-roll-arms">
          <line x1={32} y1={22} x2={32} y2={38} />
          <line x1={27} y1={38} x2={37} y2={38} />
        </g>
      </g>
    </g>
  </Figure>
);

const hinge = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.2} className={className}>
    <Ground />
    {legs(32, 36, 54, 3)}
    <g className="ra-hinge-torso">
      <line x1={32} y1={36} x2={32} y2={18} />
      <Head cx={32} cy={13} r={4.5} />
      <g className="ra-hinge-arms">
        <line x1={32} y1={21} x2={32} y2={38} />
        <line x1={23} y1={38} x2={41} y2={38} />
      </g>
    </g>
  </Figure>
);

const hipThrust = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.2} className={className}>
    <Ground y={54} />
    <Prop>
      <line x1={8} y1={30} x2={26} y2={30} />
    </Prop>
    <g className="ra-thrust-body">
      <Head cx={13} cy={28} r={4.5} />
      <line x1={18} y1={32} x2={38} y2={34} />
      <line x1={38} y1={34} x2={46} y2={44} />
      <line x1={46} y1={44} x2={46} y2={52} />
      <line x1={32} y1={29} x2={44} y2={29} />
    </g>
  </Figure>
);

// ── Night · restore ────────────────────────────────────────────────────────

const cobra = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={3} className={className}>
    <Ground />
    <line x1={34} y1={50} x2={56} y2={54} />
    <Prop>
      <line x1={22} y1={48} x2={22} y2={55} />
    </Prop>
    <g className="ra-cobra-torso">
      <line x1={34} y1={50} x2={18} y2={50} />
      <Head cx={13} cy={49} r={4.5} />
    </g>
  </Figure>
);

const deadbug = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={3} className={className}>
    <Ground />
    <line x1={24} y1={44} x2={40} y2={44} />
    <Head cx={19} cy={43} r={4.5} />
    <g className="ra-deadbug-arm">
      <line x1={28} y1={44} x2={28} y2={30} />
    </g>
    <g className="ra-deadbug-leg">
      <polyline points="36,44 36,32 46,32" />
    </g>
  </Figure>
);

const plank = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={3} className={className}>
    <Ground y={58} />
    <g className="ra-plank-body">
      <polyline points="14,54 20,42 38,46 52,52" />
      <Head cx={20} cy={37} r={4.5} />
    </g>
  </Figure>
);

const birddog = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={3.2} className={className}>
    <Ground />
    <line x1={22} y1={38} x2={44} y2={38} />
    <line x1={22} y1={38} x2={22} y2={54} />
    <line x1={44} y1={38} x2={44} y2={54} />
    <Head cx={17} cy={36} r={4.5} />
    <g className="ra-birddog-arm">
      <line x1={22} y1={38} x2={6} y2={36} />
    </g>
    <g className="ra-birddog-leg">
      <line x1={44} y1={38} x2={60} y2={36} />
    </g>
  </Figure>
);

const wallslide = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={3} className={className}>
    <Ground />
    <Prop>
      <line x1={14} y1={6} x2={14} y2={56} />
    </Prop>
    <Head cx={22} cy={16} />
    <line x1={22} y1={21} x2={22} y2={40} />
    <line x1={22} y1={40} x2={27} y2={54} />
    <line x1={22} y1={40} x2={19} y2={54} />
    <g className="ra-glide-arm">
      <polyline points="22,24 34,24 34,14" />
    </g>
  </Figure>
);

const standExt = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.6} className={className}>
    <Ground />
    {legs(32, 38, 54, 5)}
    <g className="ra-standext-torso">
      <line x1={32} y1={38} x2={32} y2={17} />
      <Head />
      <polyline points="32,26 23,32 29,38" />
      <polyline points="32,26 41,32 35,38" />
    </g>
  </Figure>
);

const downDog = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={3.2} className={className}>
    <Ground />
    <g className="ra-downdog">
      <line x1={32} y1={24} x2={13} y2={54} />
      <Head cx={20} cy={41} r={4.5} />
      <line x1={32} y1={24} x2={45} y2={42} />
      <line x1={45} y1={42} x2={50} y2={54} />
    </g>
  </Figure>
);

const nerveGlide = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.4} className={className}>
    <Ground y={58} />
    <Prop>
      <line x1={10} y1={38} x2={30} y2={38} />
      <line x1={12} y1={38} x2={12} y2={56} />
    </Prop>
    <g className="ra-glide-torso">
      <line x1={22} y1={38} x2={22} y2={20} />
      <Head cx={22} cy={15} r={4.5} />
    </g>
    <line x1={22} y1={38} x2={36} y2={38} />
    <g className="ra-glide-shin">
      <line x1={36} y1={38} x2={36} y2={52} />
      <line x1={36} y1={52} x2={43} y2={52} />
    </g>
  </Figure>
);

export const ANIMATIONS: Record<string, (p: AnimProps) => ReactNode> = {
  bike,
  scapRetract,
  pullApart,
  wristRotate,
  pull,
  pullup,
  row,
  curl,
  press,
  dip,
  shoulderPress,
  externalRotation,
  carry,
  pinch,
  roll,
  hinge,
  hipThrust,
  cobra,
  deadbug,
  plank,
  birddog,
  wallslide,
  standext: standExt,
  downdog: downDog,
  nerveglide: nerveGlide,
};

/** Renders the animation for a key, or a neutral placeholder if it is missing.
 *  A typo in seed data must never take the stage down mid-session. */
export function ExerciseAnimation({
  animation,
  size = 64,
  className,
  loopSeconds,
}: {
  animation: string;
  size?: number;
  className?: string;
  /** Play one repetition over this many seconds instead of the figure's own
   *  loop. Pass an exercise's tempo so the demonstration matches the work. */
  loopSeconds?: number;
}) {
  const Anim = ANIMATIONS[animation];
  const figure = Anim ? (
    <>{Anim({ size, ...(className !== undefined ? { className } : {}) })}</>
  ) : (
    <Figure size={size} className={className}>
      <Head />
      <line x1={32} y1={17} x2={32} y2={38} />
      {legs()}
    </Figure>
  );

  if (loopSeconds === undefined) return figure;
  return <LoopOverride.Provider value={loopSeconds}>{figure}</LoopOverride.Provider>;
}
