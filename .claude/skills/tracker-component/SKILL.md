---
name: tracker-component
description: Use when building, modifying or debugging anything in src/trackers/ — RepCounter, HoldTimer, DurationTimer, DistanceLogger, RestTimer, or their shared Dial, WeightInput and SetPips. Also use for any work involving countdowns, rest between sets, wake lock, haptics, set logging or auto-advance, and whenever a timer drifts, a set logs twice, or a set fails to log. Trackers are where the subtle bugs live — load this before writing timer or set-logging code.
---

# Building a tracker

A tracker is the thing the user actually touches, mid-set, with chalky hands, in
a loud gym or a dark bedroom. It gets the largest targets and the clearest
state in the app. It is also where every subtle bug in this codebase has lived.

## The shared contract

Every tracker implements `TrackerProps` from `src/trackers/shared.tsx`:

```ts
interface TrackerProps {
  exercise: Exercise;
  setIndex: number;                       // which set is in progress
  logged: LoggedSet[];                    // already banked for this exercise
  weightKg: number | null;
  onWeightChange: (kg: number) => void;
  onSetComplete: (reps: number) => void;  // fire ONCE per set
}
```

Three obligations:

1. **Own the current set.** Local state, reset on `[exercise.id, setIndex]`.
2. **Emit exactly one `onSetComplete` per set.** The stage builds the
   `LoggedSet` and persists it; the tracker reports what was achieved.
3. **Do not manage rest or stage navigation.** `Stage` owns both.

Read the target with `targetFor(exercise, setIndex)` — never `repScheme[0]`,
never `repScheme` as a scalar. A 6/4/2 exercise has a different target per set
and flattening that is a bug, not a simplification.

## Rule 1: timers store an end-timestamp, never a counter

A decrementing `setInterval` drifts the moment the screen locks, the tab
backgrounds, or the browser throttles timers — which is most of a gym session.

```ts
// Correct
const [endsAt, setEndsAt] = useState(Date.now() + seconds * 1000);
const { remainingMs, remainingSeconds } = useCountdown(endsAt, onDone);

// Wrong — drifts, silently, only on real devices
setInterval(() => setLeft((n) => n - 1), 1000);
```

`useCountdown(endsAt, onDone)` in `hooks.ts` recomputes from `Date.now()` on
every tick and fires `onDone` exactly once per distinct `endsAt`. Pass `null`
to idle. To extend a timer, add to `endsAt` — do not restart it.

## Rule 2: wake lock while active, released on exit

```ts
useWakeLock(phase !== 'idle');
```

`useWakeLock` re-acquires on `visibilitychange`, because the browser drops the
sentinel whenever the tab is hidden and without that the screen sleeps the
moment you glance away. It releases on unmount. Never call
`navigator.wakeLock.request` directly.

## Rule 3: haptics accompany, never replace, a visual change

```ts
haptic(HAPTIC.tick);       // one rep
haptic(HAPTIC.complete);   // set or hold finished
haptic(HAPTIC.transition); // stage or block change
```

They are absent on iOS Safari, so every haptic must be paired with something
visible. Respect `state.settings.haptics` — `setHapticsEnabled` already gates
this globally, so just call `haptic()`.

## Rule 4: persistence is the stage's job, and it is debounced

The tracker calls `onSetComplete`; `Stage` calls `logSet`; the provider writes
to `localStorage` with a 500ms debounce and flushes on `pagehide`. Never write
to `localStorage` from a tracker, and never write on every keystroke or tap.

`logSet` overwrites by `(exerciseId, setIndex)` rather than appending, so
walking back a stage and redoing a set produces one entry, not two.

## Rule 5: `prefers-reduced-motion`

Rings still fill — that is information, not decoration. Pulses, slides and
sheet animations are dropped. This is handled in `index.css`; do not add
motion that bypasses it.

## Rule 6: touch targets

The dial is a minimum of 180px and the **whole circle** is the button.
Everything else is at least 44px. No small +/− controls on the primary
interaction — the rep counter decrements with a 400ms press-and-hold
(`useTapOrHold`) precisely because a small "−" gets mis-hit with chalk on your
fingers.

## Gotchas that have actually bitten

- **`position: fixed` inside a transformed ancestor.** A retained
  `transform` — even `translateX(0)` from an animation with
  `fill-mode: forwards`/`both` — makes that element the containing block, and a
  fixed bottom sheet then anchors to the bottom of the scrollable stage instead
  of the viewport. `RestTimer` portals to `document.body` for this reason, and
  the stage transitions use `fill-mode: backwards`. Keep both.
- **Overshoot is data.** Do not cap the rep counter at the target. Thirteen reps
  when twelve were prescribed is recorded as thirteen.
- **Rest is suppressed after the final set** of an exercise — it flows into the
  next-stage prompt instead.
- **Bilateral holds** need both sides before a rep banks. `exercise.bilateral`
  drives the left/right indicator.

## Checklist

- [ ] State resets on `[exercise.id, setIndex]`
- [ ] `onSetComplete` fires exactly once per set
- [ ] Every countdown uses `useCountdown` with an end-timestamp
- [ ] `useWakeLock` while active
- [ ] Targets read via `targetFor`, never a flattened rep count
- [ ] Tested by backgrounding the tab mid-set and returning
- [ ] `npm run build` passes
