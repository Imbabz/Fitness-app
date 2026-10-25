---
name: exercise-animation
description: Use when creating, editing or debugging an exercise stick-figure animation — anything in src/animations/ (registry.tsx, animations.css, primitives.tsx), any `animation` key on an Exercise, or any report that a figure looks wrong, a limb detaches, a loop is too fast or slow, or a movement is unreadable at thumbnail size. Load before writing SVG or CSS keyframes for a movement.
---

# Authoring an exercise animation

Every exercise gets a looping SVG stick figure: 64×64 viewBox, two or three
stroke elements, animated with hand-written CSS keyframes. No animation
library, no Lottie, no GIFs, no video.

The figure has to be legible at **28px** in the trailhead list, not just at
140px on a stage. Prefer one clear articulated joint over anatomical accuracy.

## Conventions

Use `Figure`, `Ground`, `Prop` and `Head` from `primitives.tsx`:

```tsx
const myMove = ({ size, className }: AnimProps) => (
  <Figure size={size} loop={2.2} className={className}>
    <Ground />                       {/* floor-based movements only */}
    <Head />                         {/* default: cx 32, cy 12, r 5 */}
    <line x1={32} y1={17} x2={32} y2={38} />
    <g className="ra-my-limb">
      <line x1={32} y1={22} x2={20} y2={32} />
    </g>
  </Figure>
);
```

- 64×64 viewBox, always
- Stroke inherits `currentColor` — day/night theming is then free, and the
  spine block tints its figures by setting `text-spine` on the wrapper
- `stroke-width: 3`, `stroke-linecap: round` (set on `<Figure>`)
- `Ground` for anything performed on the floor; `Prop` for bars, benches and
  walls — both render in the muted colour so they read as environment, not body
- Loop duration: **1.8–2.4s for day movements**, **2.8–3.2s for night**. Night
  animations breathe; day animations snap.

## The rigid-body rule

**Every animated group is either a rigid group rotating about its proximal
joint, or a rigid body translating.** Nothing may be animated in a way that
detaches an endpoint from what it is attached to — a floating forearm is the
single most obvious way one of these figures looks broken.

Two consequences worth internalising:

- A rotation preserves limb length. If a movement needs the distance between
  two joints to change, one rotation cannot express it — you need a second
  joint, not a translate.
- When a movement really does need two joints (a segmental spine roll, a hinge
  where the arms must stay plumb), **nest the groups**. Transforms compose, and
  each child's `transform-origin` is stated in the same base coordinates:

```tsx
<g className="ra-roll-lower">          {/* origin = hip */}
  <line x1={32} y1={36} x2={32} y2={28} />
  <g className="ra-roll-upper">        {/* origin = mid-spine */}
    <line x1={32} y1={28} x2={32} y2={20} />
    <g className="ra-roll-arms">       {/* origin = shoulder */}
      <line x1={32} y1={22} x2={32} y2={38} />
    </g>
  </g>
</g>
```

### Counter-rotation must share timing exactly

The Jefferson curl's arms counter-rotate by the sum of the two spine segments
so the weight hangs plumb. That cancellation only holds if all three keyframe
sets use **identical percentages and identical easing** — different magnitudes
are what make the roll read as segmental, different *timings* just make the
weight swing out sideways. This was a real bug; do not reintroduce it.

## The CSS side

Origins live in `animations.css` and must match the joint coordinates drawn in
`registry.tsx`. **If you move a joint in the SVG, move the origin in the same
commit** — a mismatch shows up as a limb pivoting around empty space.

```css
.ra-my-limb {
  transform-origin: 32px 22px;   /* the shoulder, in viewBox units */
  animation-name: ra-my-limb;
}
@keyframes ra-my-limb {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(-45deg); }
}
```

`transform-box: view-box`, the duration (`var(--loop)`), `ease-in-out` and
`infinite` are all applied by the `[class^='ra-']` base rule. Your class only
needs an origin and an `animation-name`.

### Check the origin actually applied

The base rule is `.ridge-anim :where([class^='ra-'])`. The `:where()` is
load-bearing: without it the base selector is (0,2,0), your `.ra-my-limb` rule
is (0,1,0), and **the base wins** — your origin is silently discarded and the
figure rotates about the viewBox centre. That shipped once, across every
animation in the app, and it reads as thirty subtly-wrong figures rather than
one wrong line, which is why it survived so long.

A rotation about the wrong centre still looks like *a* movement, so eyeballing
it does not catch this. Measure instead:

```js
getComputedStyle(document.querySelector('.ra-my-limb')).transformOrigin
// → "22px 38px", not "32px 32px"
```

The stronger check is that the joint does not move. Take the group's proximal
point through `getCTM()` at several phases of the loop and confirm it lands on
the same spot as the static bone it attaches to; a non-zero drift is the origin
being wrong, and the drift is `2 · d · sin(θ/2)` where `d` is how far off the
origin is.

Positive rotation is **clockwise** in SVG. Sketch the endpoint arithmetic before
committing to an angle — it is quicker than three rounds of screenshots.

## Reduced motion

Handled centrally: a negative delay of half the loop seeks to 50%, and
`animation-play-state: paused` holds it there, so the figure freezes at its
**mid-point pose** rather than collapsing to a neutral stand. Nothing to do
per-animation, but check your 50% keyframe is a pose worth freezing on — that
is the still image a reduced-motion user sees.

## Worked example 1 — a single-joint movement (hammer curl)

The elbow is the only joint that matters. Draw the upper arm as a static line,
put the forearm and the dumbbell in one group, rotate about the elbow.

```tsx
<line x1={32} y1={22} x2={24} y2={34} />        {/* upper arm, fixed */}
<g className="ra-curl-forearm">
  <line x1={24} y1={34} x2={20} y2={46} />      {/* forearm */}
  <line x1={16} y1={46} x2={24} y2={46} />      {/* dumbbell, rides along */}
</g>
```

```css
.ra-curl-forearm { transform-origin: 24px 34px; animation-name: ra-curl; }
@keyframes ra-curl {
  0%, 100% { transform: rotate(0deg); }
  50%      { transform: rotate(-120deg); }
}
```

The dumbbell sits *inside* the rotating group, so it stays in the hand.

## Worked example 2 — a closed chain (dip)

Both hands are fixed on the bars, so the shoulder can only occupy positions
where two circles intersect. With hands at (24,24) and (40,24) and 10-unit
arms, the shoulder is at either (32,18) or (32,30) — exactly the top and bottom
of the dip, and rotating between them is a valid rigid motion.

```css
.ra-dip-arm-l { transform-origin: 24px 24px; }   /* rotate 0 → 74deg  */
.ra-dip-arm-r { transform-origin: 40px 24px; }   /* rotate 0 → -74deg */
.ra-dip-body  { }                                /* translateY 0 → 12px */
```

The body translates by exactly the shoulder's travel, so nothing separates.
Geometry first, then keyframes.

## Registry wiring

1. Add the component to `registry.tsx`.
2. Add it to the `ANIMATIONS` map.
3. Set `animation: 'myMove'` on the exercise in `data/exercises.ts`.

A missing key renders a neutral standing figure instead of crashing — that
fallback exists so a typo cannot take a stage down mid-session, not as a licence
to skip step 2.

## Checklist

- [ ] Legible at 28px, not just 140px
- [ ] Every animated group is rigid; no endpoint detaches at any point in the loop
- [ ] `transform-origin` matches the drawn joint coordinate — and actually
      applies; see below
- [ ] Counter-rotating groups share keyframe percentages exactly
- [ ] Loop duration in range for the mode (day 1.8–2.4s, night 2.8–3.2s)
- [ ] `Ground` present for floor-based movements
- [ ] The 50% pose is a good freeze-frame
- [ ] Registered in `ANIMATIONS` and referenced by an exercise
