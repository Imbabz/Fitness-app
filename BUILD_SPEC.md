# BUILD SPEC — "Ridge" · Training Companion

A personal training app with a **day/night cycle**: gym sessions live in daylight, the daily mobility routine lives at night. Built for a climber rehabbing an L5-S1 disc protrusion.

Feed this file to Claude Code as the build brief. Work through the phases in order — each ends in something runnable.

---

## 1. Product intent

One user. One phone, held in a gym with chalky hands. The app must answer three questions in under two seconds:

1. What am I doing today?
2. What's the next exercise?
3. Have I done my daily mobility yet?

Everything else is secondary. No social features, no accounts, no cloud.

**The day/night cycle is the core organising metaphor.** The app has two modes that the user moves between, and the entire visual language shifts with them:

| | **Day — Gym** | **Night — Restore** |
|---|---|---|
| Content | Sessions A / B / C (~60 min) | Daily mobility routine (~13 min) |
| Frequency | 3×/week | Every day |
| Palette | Warm amber, high contrast, sharp | Cool indigo/violet, soft, low luminance |
| Motion | Snappy (150ms) | Slow, breathing (400ms+) |
| Typography | Tighter, heavier | Looser tracking, lighter weights |
| Copy tone | Imperative — "Push the floor away" | Descriptive — "Let the ribs settle" |

Mode is **user-selected, with a time-of-day default**: before 18:00 → Day, after → Night. A persistent toggle in the header overrides, and the override is remembered for the rest of that calendar day.

The transition between modes is a genuine cross-fade of background gradient, accent colour and card treatment — around 600ms, `ease-in-out`. It should feel like the light changing, not a theme switch.

---

## 2. Tech stack

- **Vite + React 18** (TypeScript)
- **Tailwind CSS** — theme colours as CSS custom properties so the day/night swap is a single class on `<html>`, not a prop drilled through every component
- **localStorage only** — no backend, no auth, no network calls
- **No router library** — a `view` state machine is enough (`home | session | routine | history | settings`)
- **lucide-react** for icons
- Deployable as a static build to GitHub Pages. Set `base` in `vite.config.ts` accordingly.

Keep the dependency list to those. This should still build in three years.

---

## 3. Data model

```ts
type Mode = 'day' | 'night';
type Block = 'warmup' | 'main' | 'spine' | 'mobility';

type TrackingMode = 'reps' | 'hold' | 'distance' | 'duration';

interface Exercise {
  id: string;
  name: string;
  block: Block;
  prescription: string;      // "3 × 12 · rest 90 sec"
  tracking: TrackingMode;    // drives which stage UI renders — see §5
  sets: number;
  repScheme: number[];       // one entry per set. [12,12,12] or McGill's [6,4,2]
  holdSeconds?: number;      // per rep, for tracking: 'hold' — e.g. 8
  durationSeconds?: number;  // whole-set duration, for tracking: 'duration' — e.g. 900 for the bike
  distanceM?: number;        // for tracking: 'distance' — e.g. 35
  tempo?: { down: number; up: number };  // Jefferson curl: { down: 5, up: 5 }
  restSeconds: number;
  execution: string;         // how to perform it
  cue?: string;              // the one thing to remember mid-set
  why?: string;              // rationale
  animation: string;         // key into the animation registry
  loadTracked: boolean;      // does the user log a weight?
}

interface Session {
  id: 'A' | 'B' | 'C' | 'daily';
  mode: Mode;
  title: string;
  subtitle: string;
  durationMin: number;
  exercises: Exercise[];
}

interface LoggedSet {
  exerciseId: string;
  setIndex: number;
  reps: number;
  weightKg: number | null;
  completedAt: string;       // ISO
}

interface CompletedSession {
  sessionId: string;
  date: string;              // YYYY-MM-DD
  startedAt: string;
  finishedAt: string;
  sets: LoggedSet[];
  note?: string;
  painFlag: boolean;         // see §6
}

interface AppState {
  mode: Mode;
  modeOverrideDate: string | null;
  history: CompletedSession[];
  activeSession: { sessionId: string; startedAt: string; sets: LoggedSet[] } | null;
  lastWeights: Record<string, number>;   // exerciseId → last used kg
  streak: { current: number; longest: number; lastDailyDate: string | null };
}
```

Persist the whole `AppState` under one key (`ridge:state:v1`). Version the key so a schema change can migrate rather than corrupt.

Wrap every localStorage read in try/catch and fall back to seed defaults. A parse failure must never white-screen the app.

---

## 4. Screens

### 4.1 Home — Day mode

- Large greeting with date.
- **Next session card**: which of A/B/C is up, based on rotation (last completed → next in cycle). Big, tappable, shows title + duration + a one-line summary of the main lifts.
- Secondary row: the other two sessions, tappable to override the rotation.
- **Mobility status chip**: "Daily routine — not yet done" or "✓ Done today", tapping switches to Night mode.
- Week strip: last 7 days as dots, filled per completed session, with a small crescent marker for days the daily routine was done.

### 4.2 Home — Night mode

- Same structure, inverted priority. The daily routine is the hero card.
- Streak counter — current run of consecutive days with the routine completed. Understated, not gamified with confetti.
- Below: "Tomorrow's session" as a small preview card, non-tappable, just orientation.

### 4.3 Session view — the journey

**A session is not a checklist. It is a path with stages.** This is the central interaction of the app and deserves the most care.

The user sees **one exercise at a time**, full screen. They move forward through the session the way you move through a route: arrive at a stage, do the work, move on. Scrolling through a wall of cards is explicitly rejected — in a gym, with chalk on your hands, the app should tell you the single next thing.

#### Session structure

```
Trailhead  →  Stage 1  →  Stage 2  →  …  →  Stage n  →  Summit
(session     (one exercise each, blocks act as        (summary)
 preview)     terrain changes)
```

**Trailhead.** Before the first exercise. Shows the session title, total duration, the list of blocks as a route profile, and a single **Begin** button. This is where the elapsed-time clock starts.

**Stages.** One per exercise. Layout, top to bottom:
- Small block label ("Main work · stage 3 of 6")
- The animation, rendered large here — 140px, not a thumbnail
- Exercise name
- The `cue` line, prominent — the one thing to hold in your head
- **The tracker** (see §6) — the interactive core, sized for a thumb
- Set pips showing position within the exercise
- Collapsed "execution & why" disclosure, tap to open
- **Next stage** button, which becomes the primary CTA only once all sets are logged. Before that it's a muted secondary — passable, but visibly a skip.

**Block transitions.** Moving between blocks is a marked moment, not just the next card. A brief full-screen interstitial (~1.5s, dismissible by tap) announcing the terrain change: "Main work" / "Spine block · slow down here". The spine-block interstitial specifically carries a line about the load being deliberate and light. This is the app's chance to change the user's mental gear.

**Summit.** The summary screen (§4.4).

#### Movement and orientation

- **Progress arc** pinned to the top: a thin horizontal line segmented by block, filling as stages complete. Colour-coded by block so the spine block is visible ahead as a distinct segment. The user should always know how far in they are and what's coming.
- Forward via the Next button. **Back** via a small chevron — always allowed, never destructive, logged sets are preserved.
- Swipe left/right also navigates stages. Swipe must not conflict with the rep counter's tap zone.
- Stages animate in with a short directional slide (120ms, from the right going forward, from the left going back). In night mode this slows to 300ms with a cross-fade instead of a slide.
- The session is resumable: `activeSession` stores the current stage index. Reopening the app mid-session drops you back on the exact stage.

### 4.4 Session summary

On finish: total time, sets completed, any weight PRs versus history, a free-text note field, and the pain flag toggle (§6). Save writes a `CompletedSession` and clears `activeSession`.

### 4.5 History

Reverse-chronological list of completed sessions. Tapping one expands to show the logged sets. A simple per-exercise weight-over-time sparkline for the load-tracked lifts — no chart library, an inline SVG polyline is plenty.

### 4.6 Settings

Mode override, rest-timer default, export state as JSON, import state from JSON, reset all data (with a confirm step).

---

## 5. Trackers — the interactive core of a stage

Each stage renders exactly one tracker, chosen by `exercise.tracking`. These are the components the user actually touches mid-set, so they get the largest targets and the clearest state.

All four share a contract: they own the current set, they emit a `LoggedSet` on completion, and they auto-advance to the next set with the rest timer in between.

### 5.1 `RepCounter` — `tracking: 'reps'`

For everything with a rep target: pulldowns, rows, dips, Jefferson curls, deadlifts.

- A large circular tap target, **minimum 180px**, filling the width of the stage. The whole circle is the button.
- Centre shows `current / target` — "7 / 12" — with the current number in the largest type in the app.
- Each tap increments by one, with a short haptic (`navigator.vibrate(10)` where supported) and a ring pulse.
- **Tap-and-hold to decrement**, 400ms threshold. No small "−" button; misfires with chalky fingers are common and the fix must be forgiving.
- The ring fills proportionally to progress. At target it completes, changes to the accent colour, and the centre swaps to a check.
- Below the circle: weight input, only if `loadTracked` — a stepper pre-filled from `lastWeights[exerciseId]`, ±2.5kg per press, with direct numeric entry on tap.
- Overshooting past the target is allowed and recorded honestly. Do not cap the counter.
- If `tempo` is set (Jefferson curl), a slim metronome bar under the counter pulses down/up at the prescribed tempo while the set is active. Visual only — no sound.

### 5.2 `HoldTimer` — `tracking: 'hold'`

For the McGill Big 3, pinch blocks, cobra holds. These have both a rep count *and* a per-rep hold duration, which is why they can't reuse either of the other trackers.

- Large circular countdown, same footprint as the rep counter.
- Centre shows remaining seconds, counting down from `holdSeconds`.
- The ring depletes over the hold. On completion: haptic, the rep count increments, and it resets ready for the next rep.
- Reps within the set shown as pips beneath — for a McGill set of 6, six pips filling one at a time.
- Tap to start each rep. Tap again to abort a rep in progress without counting it.
- **Optional auto-chain**: a toggle that runs consecutive reps with a 3-second gap and a countdown beep, so the user never touches the phone mid-set. Off by default, remembered per exercise.
- Side-specific exercises (side plank, bird dog) show a **left / right** indicator and require both sides before the set is complete.

### 5.3 `DurationTimer` — `tracking: 'duration'`

For the 15-minute cardio warm-up and any single-block timed work.

- Large countdown, minutes and seconds.
- Start / pause / reset. Pausing is prominent — treadmills stop for all kinds of reasons.
- Runs correctly in the background: store the target end-timestamp, not a decrementing counter, so screen lock or app backgrounding doesn't drift it.
- At zero: haptic plus a gentle visual pulse. No audible alarm by default; make it a settings toggle.

### 5.4 `DistanceLogger` — `tracking: 'distance'`

For farmer's carries. A simple stepper in 5m increments with the target shown, plus weight input. Deliberately dumb — no GPS, no step counting.

### 5.5 `RestTimer` — shared

Appears automatically between sets, across all tracker types.

- Slides up as a **bottom sheet**, not a full-screen takeover, so the user can still read the next set's cue behind it.
- Counts down from `exercise.restSeconds`. Shows the upcoming set's target.
- "Skip rest" always available. "+30s" for when the rack is busy.
- Uses the same end-timestamp approach as the duration timer.
- Suppressed after the final set of an exercise — that flows straight into the Next Stage prompt instead.

### 5.6 Cross-cutting

- Every tracker holds the screen awake while active, via the Wake Lock API where available, released on stage exit.
- All tracker state persists to `activeSession` on each change, debounced. Closing the app mid-set loses nothing.
- Respect `prefers-reduced-motion`: rings still fill, but pulses and slides are dropped.

---

## 6. Animations

Every exercise gets a looping **SVG stick-figure animation** — a 64×64 viewBox, 2-3 stroke elements, animated with pure CSS keyframes. No animation libraries, no GIFs, no video.

Build an animation registry:

```ts
// animations/registry.tsx
export const ANIMATIONS: Record<string, React.FC> = {
  hinge, roll, pull, dip, press, plank, birddog, deadbug,
  cobra, wallslide, carry, wristRotate, hipThrust, bike, ...
};
```

Each is a small component returning an `<svg>` with a named animation class. Shared conventions:
- Stroke inherits `currentColor` so day/night theming is free
- `stroke-width: 3`, `stroke-linecap: round`
- Ground line in a muted colour where the movement is floor-based
- 1.8-3.2s loop durations, `ease-in-out` — slower for the night-mode movements

The motion should be legible at thumbnail size. Prefer one clear articulated joint over anatomical accuracy.

Respect `prefers-reduced-motion`: freeze all loops at their mid-point pose.

---

## 7. Domain rules — do not omit these

This app is for someone with an L5-S1 disc protrusion. The following are product requirements, not flavour text.

1. **The spine block always renders last** within a gym session, and the session view must not allow reordering. Loaded flexion on a cold spine is the thing being avoided.

2. **Spine-block cards are visually distinct** — a warmer border and background tint in day mode. They read as a different category of work.

3. **Pain flag.** The session summary has a toggle: "Anything radiating into the glute, calf or heel?" If flagged, the app stores it on the session and, on the next session that contains the same spine exercises, surfaces a persistent banner suggesting the load be held or reduced and the physio consulted. It never auto-adjusts weights — it surfaces the pattern and leaves the decision to the user.

4. **Progression prompt.** When an exercise hits its full prescribed sets and reps with clean form two sessions running, the card shows a subtle "ready to add load?" hint. On spine-block exercises this threshold is **four** sessions instead of two, and the hint copy is explicitly more conservative.

5. **Morning warning.** If the daily routine is opened before 08:00, show a dismissible note that discs are most pressurised after a night lying down and that waiting an hour is preferable.

6. Every seeded exercise carries its `why` text. The rationale is part of the product — it's what makes the user comply rather than improvise.

---

## 8. Seed content

Ship with this content pre-loaded in `data/sessions.ts`.

### Session A · Pull (day, ~60 min)
- **Warm-up** — Bike or treadmill, 15 min easy + arm circles, scapular retractions
- **Main (3×12)** — Lat pulldown wide grip · Seated cable row · Pull-ups (assisted or negatives) · Hammer curls + wrist flexion/extension
- **Spine** — Jefferson curl (3×12, very light, 5s down / 5s up) · Deadlift, light, trap bar preferred (3×12)

### Session B · Push (day, ~60 min)
- **Warm-up** — Bike or treadmill 15 min + band pull-aparts
- **Main (3×12)** — Bench press · Dips (assisted if needed) · Seated dumbbell shoulder press · Cable external rotation + face pulls
- **Spine** — Jefferson curl (3×12) · Romanian deadlift, light (3×12)

### Session C · Mixed (day, ~60 min)
- **Warm-up** — Bike or treadmill 15 min + wrist prep, finger extensions
- **Main (3×12)** — Chin-ups supinated · Chest-supported dumbbell row · Farmer's carry (3 × 30-40 m) · Pinch block holds + finger extensions
- **Spine** — Jefferson curl (3×12) · Hip thrust (3×12)

### Daily · Restore (night, ~13 min)
- Light cobra / McKenzie — `hold`, 1 set of 10 reps, 3s holds, forearms first
- Dead bug — `hold`, repScheme `[6,4,2]` per side, 8s holds, bilateral
- Side plank — `hold`, repScheme `[6,4,2]` per side, 8s holds, bilateral
- Bird dog — `hold`, repScheme `[6,4,2]` per side, 8s holds, bilateral
- Wall glides — `reps`, repScheme `[10,10]`, tempo `{ down: 3, up: 3 }`

The 6/4/2 descending format is McGill's own and must be represented faithfully — three sets of *different* rep counts, not `3 × 6`. The `repScheme` array exists precisely so this isn't flattened.

### Tracking mode assignment

- `duration` — the three 15-minute cardio warm-ups
- `hold` — all McGill Big 3, cobra, pinch block holds
- `distance` — farmer's carry
- `reps` — everything else

`loadTracked: true` on all main-block lifts and both spine lifts. False on bodyweight work, mobility, and cardio.

**Excluded by design** (note this in a code comment so it isn't "helpfully" added later): bent-over barbell rows, standing overhead press, crunches and sit-ups, any loaded rotation.

---

## 9. Visual direction

Avoid the default dark-dashboard look. Specific asks:

- **Day**: near-black base (`#1a1d23`), amber accent (`#f2a541`), cards a half-step lighter than the background with 1px borders. Sharp corners on structural elements, 10-11px radius on cards.
- **Night**: deep indigo base, violet/pale-blue accents, lower overall contrast, more generous spacing, cards with softer edges and no hard borders. It should feel like it emits less light.
- One typeface, used well. System stack is acceptable — differentiate through weight and tracking, not font count.
- The mode transition animates: background gradient, accent colour, card background, border opacity. Text colour should transition too, but faster, so it doesn't smear.
- Touch targets minimum 44px. Assume chalky hands and a phone propped against a water bottle.

---

## 10. Build phases

**Phase 1 — Skeleton.** Vite + React + TS + Tailwind. Type definitions. Seed data for all four sessions, fully populated with `tracking`, `repScheme`, `holdSeconds`, `restSeconds`. Static home screen, day mode only, no persistence.

**Phase 2 — The journey shell.** Trailhead → stages → summit navigation. One exercise per screen, forward/back, progress arc, block interstitials, stage transitions. Trackers stubbed as plain "mark done" buttons for now — this phase is purely about the path working.

**Phase 3 — State & persistence.** `AppState`, localStorage with versioned key and safe fallbacks, session lifecycle, resumable `activeSession` including stage index, history writes.

**Phase 4 — Trackers.** `RepCounter`, `HoldTimer`, `DurationTimer`, `DistanceLogger`, `RestTimer`. Wire each to `LoggedSet` emission and auto-advance. Weight input and `lastWeights` pre-fill. Wake lock. This is the highest-value phase — budget accordingly and test each tracker in isolation before wiring it into a stage.

**Phase 5 — Summit & history.** Session summary, PR detection, note field, history list with per-exercise sparklines.

**Phase 6 — Day/night.** Mode state, time-based default, override with daily expiry, full theme transition, night home screen, daily routine journey, streak logic. The night journey uses the slower stage transitions.

**Phase 7 — Animations.** The full SVG registry, wired to every exercise at both stage size and thumbnail size, `prefers-reduced-motion` handling.

**Phase 8 — Domain rules.** Pain flag and follow-up banner, progression prompts with the differentiated spine threshold, morning warning, spine-block interstitial copy.

**Phase 9 — Polish.** Haptics, auto-chain toggle for holds, JSON export/import, empty states, GitHub Pages build config.

Run the dev server and check the build compiles at the end of each phase. Don't move on from a broken phase.

---

## 11. Constraints

- No backend, no analytics, no external API calls.
- No `localStorage` writes on every keystroke — debounce to 500ms.
- The app must work fully offline after first load.
- Total bundle under 300KB gzipped.
- All copy in English.
- Do not add exercises to the seed data beyond those listed in §8. The selection is medically deliberate.
