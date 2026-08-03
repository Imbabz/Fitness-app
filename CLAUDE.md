# CLAUDE.md — Ridge

Working agreement for anyone, human or agent, touching this repo.

Read this before writing code. `BUILD_SPEC.md` is what was built and why;
`EXTENSIONS.md` is what deliberately comes later.

---

## What this is

A single-user training app for a climber rehabbing an **L5-S1 disc protrusion**.
Static React SPA, localStorage only, no backend, no accounts, no network calls
after first load.

The organising metaphor is a **day/night cycle**: gym sessions in daylight,
mobility routine at night. Sessions are **journeys** — one exercise per screen,
not a scrollable checklist.

---

## Non-negotiables

These are not preferences. Breaking them breaks the product.

1. **Never add exercises to the seed data.** The selection in `BUILD_SPEC.md §8`
   is medically deliberate. Bent-over barbell rows, standing overhead press,
   crunches, sit-ups and loaded rotation are excluded on purpose. If a change
   seems to call for a new exercise, stop and ask.

2. **The spine block renders last, always.** No reordering, no user-configurable
   ordering, no "smart" reshuffling. Loaded spinal flexion on a cold spine is
   the specific thing being avoided. `sessions.ts` enforces this structurally in
   `pick()` — leave that sort in place.

3. **`repScheme` is an array, never a count.** McGill's 6/4/2 descending format
   must survive. Any code that assumes uniform sets across an exercise is a bug.

4. **The app never auto-adjusts load.** It can surface patterns — pain flags,
   progression readiness — and it stops there. Every weight decision belongs to
   the user and their physio.

5. **No network calls.** No analytics, no telemetry, no font CDNs, no error
   reporting. Offline-first is a hard requirement, not an optimisation.

6. **Progression thresholds differ by block.** Two clean sessions for main work,
   four for the spine block. Do not unify these.

---

## Stack and conventions

- Vite + React 18 + TypeScript, Tailwind, lucide-react. **That is the whole
  dependency list.** Adding one requires justification in the PR description.
- Theme colours are CSS custom properties on `<html>`. Day/night is a class
  swap, never props drilled through the tree.
- State lives in one `AppState` object, one localStorage key (`ridge:state:v1`),
  versioned. Every read is wrapped in try/catch with a seed-data fallback. A
  corrupt store must degrade, never white-screen.
- Writes to localStorage are debounced to 500ms and flushed on `pagehide`.
- No router library. A `view` state machine covers it.
- Animations are hand-written CSS keyframes on inline SVG. No animation
  libraries, no Lottie, no GIFs.
- Touch targets ≥ 44px. Assume chalky hands and a phone propped against a
  water bottle.

---

## Directory shape

```
src/
  data/
    exercises.ts       # the library — near-frozen, see rule 1
    sessions.ts        # composition + the spine-last guard
  state/
    store.ts           # persistence, coercion, migrations
    selectors.ts       # rotation, streak, PRs, domain rules
    AppStateContext.tsx
  journey/
    Journey.tsx        Trailhead.tsx   Stage.tsx
    Interstitial.tsx   Summit.tsx      ProgressArc.tsx
    PainFlagBanner.tsx MorningWarning.tsx
  trackers/
    RepCounter.tsx     HoldTimer.tsx   DurationTimer.tsx
    DistanceLogger.tsx RestTimer.tsx
    shared.tsx         hooks.ts
  animations/
    registry.tsx       # exercise key → SVG component
    primitives.tsx     # shared stroke conventions
    animations.css     # keyframes
  screens/
    Home.tsx  History.tsx  Settings.tsx
  theme/
    tokens.css         # day/night custom properties
  lib/
    time.ts  haptics.ts  sound.ts
```

---

## Project skills

This repo uses **Agent Skills** to encode recurring procedures so they do not
have to be re-explained every session. They live in `.claude/skills/`, each a
directory with a `SKILL.md`, and load only when the task calls for them.

| Skill | Loads when you are… |
|---|---|
| `session-content` | editing seed data — exercises, sessions, prescriptions, blocks |
| `tracker-component` | building or debugging a tracker, timer, or set-logging path |
| `exercise-animation` | authoring or fixing a stick-figure animation |
| `theme-tokens` | adding or changing a colour, radius, spacing or motion token |

`session-content` is the one that matters most — its real job is to make the
medical constraints legible to an agent with no memory of the conversation that
produced them. `tracker-component` is the second, because trackers are where the
subtle bugs live.

Descriptions are written around the **trigger**, not the content — the
description field is what determines whether the skill gets loaded at all.

Everything in `.claude/skills/` is written in-house. Treat third-party skills
like installing software: they can invoke file operations, bash and code
execution.

**References**
- Agent Skills overview: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Skills in Claude Code: https://docs.claude.com/en/docs/claude-code/overview

---

## Working style

- Work in the phases defined in `BUILD_SPEC.md §10`. Each phase ends runnable.
  Do not start a phase on top of a broken one.
- Run `npm run build` at the end of each phase, not just the dev server. Type
  errors hide behind HMR.
- Prefer deleting to abstracting. This is a one-user app; premature generality
  is the main risk.
- When a spec detail is ambiguous, ask rather than infer. The medical
  constraints in particular have no obvious defaults.
- Commit messages: what changed and why, one line, no ceremony.

---

## Definition of done, per phase

- `npm run build` passes clean
- Tested at phone width, not just desktop responsive mode
- Day *and* night mode both checked — theme regressions are the most common miss
- `localStorage` cleared and the app reopened, to verify seed fallbacks
- No new dependencies unless flagged

---

## Known traps

Things that have already gone wrong once here:

- **`position: fixed` under a transformed ancestor.** A retained transform, even
  `translateX(0)` left by an animation with `fill-mode: forwards`/`both`, becomes
  the containing block. The rest-timer sheet anchored to the bottom of the
  scrollable stage instead of the viewport. Stage transitions now use
  `fill-mode: backwards` and `RestTimer` portals to `document.body`. Keep both.
- **Counter-rotating SVG groups with different keyframe timings.** The Jefferson
  curl's arms cancel the spine rotation only if all three groups share identical
  percentages and easing.
- **`toISOString()` for a date key.** It is UTC, and it silently shifts the date
  for an evening session west of GMT. Use `todayKey()` from `lib/time.ts`.
- **`text-base` is a colour, not a size.** `--c-base` is the page background.
