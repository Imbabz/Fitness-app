---
name: session-content
description: Use when editing, adding, removing, reordering or reviewing anything in src/data/exercises.ts or src/data/sessions.ts — exercise prescriptions, sets, repScheme, rest times, cues, why text, block assignment, tracking mode, or session composition. Also use when a request would introduce a new movement, substitute one exercise for another, or change how much work a session contains. Load this BEFORE touching seed data, because the constraints are medical and have no obvious defaults.
---

# Editing seed content safely

This app is for one person rehabbing an **L5-S1 disc protrusion** while training
for climbing. The exercise selection is a clinical decision, not a preference.
An agent with no memory of that conversation will otherwise "improve" it.

Read this fully before changing `src/data/exercises.ts` or `src/data/sessions.ts`.

## The rule that matters most

**Never add an exercise.** Not a warm-up, not an accessory, not "one more
mobility drill for balance". If a change appears to call for a movement that
does not already exist in `EXERCISES`, stop and ask the user. There is no
version of this where quietly adding one is correct.

Note what this rule now protects. The user can substitute any movement in this
library into any session in the same block, so adding one here adds it to every
picker for that block. The library *is* the safety boundary — there is no
allow-list behind it.

Removing is safer than adding, but still ask.

## Excluded by design

These are absent on purpose. The code comment at the top of `exercises.ts` says
so, and this list is the reasoning behind it:

| Excluded | Why |
|---|---|
| Bent-over barbell rows | Sustained loaded lumbar flexion under fatigue. Chest-supported rows give the same mid-back stimulus with the bench carrying the load. |
| Standing overhead press | Axial compression combined with a lumbar extension moment. The seated dumbbell press is the substitute and it is already in session B. |
| Crunches, sit-ups | Repeated end-range flexion — the specific mechanism implicated in posterior disc protrusion. McGill's position, and the reason the Big 3 exist. |
| Any loaded rotation | Flexion plus rotation under load is the highest-risk combination for an annular tear. |

If asked to add one of these, say which one it is and why it is out, then offer
the substitute already in the programme.

## The one deliberate exception

The **Jefferson curl** is loaded spinal flexion, which looks like it
contradicts everything above. It stays because it is very light, very slow
(5s down / 5s up), segmental, and performed last on a warm spine. All four of
those properties are load-bearing:

- Change the tempo and it is no longer a controlled tolerance exercise.
- Move it earlier in the session and it becomes flexion on a cold spine.
- Make the weight meaningful and the risk stops being worth the adaptation.

Treat its `tempo`, `block` and the "very light" wording in its `prescription`
as frozen.

## Structural rules

### The spine block renders last, always

`sessions.ts` enforces this in `pick()` via `BLOCK_ORDER`, so array order in the
session definition does not matter — but do not remove that sort thinking it is
redundant. It is the guard that makes a careless edit safe.

Never add "smart" reshuffling, and never let ordering cross a block boundary.

Reordering *within* a block is user-facing and supported (`order` in AppState,
applied by `resolveSession`). It is safe precisely because the block sort runs
first: a stored order listing spine work first still renders it last.

### `repScheme` is an array, never a count

```ts
sets: 3,
repScheme: [6, 4, 2],   // McGill's descending format — three DIFFERENT sets
```

Any code that computes `sets × reps`, or assumes `repScheme[0]` applies to every
set, is a bug. `sets` must always equal `repScheme.length`. The trackers,
`SetPips`, `RestTimer` and `wasClean()` all read the array per index.

Straight sets are `[12, 12, 12]`, not `12`.

### Progression thresholds differ by block

Two clean sessions for main work, four for the spine block
(`PROGRESSION_THRESHOLD` in `state/selectors.ts`). Do not unify them, and keep
the spine copy more conservative than the main copy.

## Field-by-field

| Field | Notes |
|---|---|
| `id` | Session-prefixed and stable (`a-lat-pulldown`). It is the key for `lastWeights` and all history — **renaming an id silently orphans that exercise's entire logged history.** Don't. |
| `name` | What it is called in the gym. |
| `block` | `warmup` \| `main` \| `spine` \| `mobility`. Drives ordering, colour, interstitial copy and progression threshold. |
| `prescription` | Human summary shown under the exercise name. Keep it consistent with `sets`/`repScheme`/`restSeconds` — nothing validates this. |
| `tracking` | Picks the tracker. `duration` for the 15-min cardio, `hold` for the Big 3 / cobra / pinch blocks, `distance` for carries, `reps` for everything else. |
| `sets` | Must equal `repScheme.length`. |
| `repScheme` | One entry per set. See above. |
| `holdSeconds` | Per rep, `tracking: 'hold'` only. |
| `durationSeconds` | Whole set, `tracking: 'duration'` only. |
| `distanceM` | Target metres per set, `tracking: 'distance'` only. |
| `tempo` | `{ down, up }` in seconds. Renders the metronome bar. Only the Jefferson curl and wall glides have one. |
| `restSeconds` | 90 for main and spine, 60 for the light accessory work, 30 for warm-ups and mobility, 0 for cardio. |
| `execution` | How to perform it. Include the safety constraint in the instruction itself ("stop before the back rounds"), not as a separate warning. |
| `cue` | **One** thing, imperative, short enough to hold mid-set. This is the most-read line in the app. |
| `why` | Required. See below. |
| `animation` | Key into `ANIMATIONS`. A missing key renders a neutral figure rather than crashing, but check it. |
| `loadTracked` | `true` for main lifts and both spine lifts. `false` for bodyweight, mobility and cardio. |
| `bilateral` | `true` for side-specific holds (dead bug, side plank, bird dog). Requires both sides before a rep banks. |
| `alternates` | **Suggested** stand-ins, by id — shown first in the swap picker. Same block only. A suggestion, not a restriction: `canSubstitute()` allows any movement in the same block, because membership of this library is itself the vetting. Curate these for usefulness, not for safety. |

## `why` is not optional

Every exercise carries its rationale, and the rationale is a product feature —
it is what makes the user comply with the constraints instead of improvising
around them. A `why` that says "builds strength" is worthless. A good one
explains what the movement does *for this specific back*, and where relevant,
what it is being chosen **instead of**.

Match the existing voice: plain, specific, no hedging, no exclamation marks.

## Before you finish

- `sets === repScheme.length` for every exercise you touched
- `prescription` still matches the numbers
- `npm run build` passes
- If you changed an `id`, you did not — go back and put it back
