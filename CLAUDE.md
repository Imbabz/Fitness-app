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

   Three sets have been added since, each with the owner's explicit sign-off:
   seven mobility alternates (sphinx, standing extension, downward dog, side
   plank from knees, one-limb bird dog, glute bridge, sciatic nerve glide);
   seven gym alternates prefixed `alt-`; and nine items prefixed `p-`,
   transcribed from a physiotherapist's printed programme (UCL, Pré-EDD). The
   McGill curl-up was proposed and **declined**.

   That exceptions were granted does not make the rule softer — ask again. The
   `p-` items in particular are somebody else's prescription: do not edit their
   sets, reps or holds to match this app's conventions, and do not "correct"
   them. Sheet numbers are cited in each `why` so the two can be reconciled.

2. **The spine block renders last, always.** No "smart" reshuffling, and no
   ordering control that can move work between blocks. Loaded spinal flexion on
   a cold spine is the specific thing being avoided. `sessions.ts` enforces this
   structurally in `pick()`, and `resolveSession()` re-sorts by block *before*
   honouring any stored order — leave both in place.

   Users may add, remove, reorder and substitute — all four are edits to one
   field, `composition`, a per-session list of exercise ids. The block is the
   only boundary: `canSubstitute()` refuses a cross-block swap, `additionsFor()`
   offers only blocks the session already has, and `resolveSession()` sorts by
   block before honouring the stored list, so a composition that puts spine work
   first still renders it last. There are tests for exactly that; do not
   "simplify" that sort away. `resolveSession()` also falls back to the seed if a
   composition resolves to nothing, because an empty session is a blank screen.

   `alternates` is a **suggestion list, not a gate** — the movements that
   genuinely cover the same pattern, surfaced first in the picker. The library
   itself is the vetted set (dangerous movements are absent from it, not blocked
   by a list), so a second allow-list on top would be curation rather than
   safety. Do not reintroduce one.

3. **`repScheme` is an array, never a count.** McGill's 6/4/2 descending format
   must survive. Any code that assumes uniform sets across an exercise is a bug.

4. **The app never auto-adjusts load.** It can surface patterns — pain flags,
   progression readiness — and it stops there. Every weight decision belongs to
   the user and their physio.

5. **No network calls.** No analytics, no telemetry, no font CDNs, no error
   reporting. Offline-first is a hard requirement, not an optimisation.

   This is why **the app ships no audio**. The ambient beds
   (`src/lib/ambient.ts`) are noise buffers and oscillators shaped at runtime.
   Streaming ambience from YouTube was asked for twice and declined both times:
   on this rule, and because that content is copyrighted and extracting it
   breaks YouTube's terms.

   The user may import their own files (`src/lib/tracks.ts`), which arrive
   through the phone's file picker and are stored in IndexedDB. That is not a
   network call and it puts the licensing question where it belongs — with
   whoever is entitled to play the file. Do not commit audio to the repository
   and do not fetch any, however permissive the licence looks.

   Two audio rules that are load-bearing and easy to "tidy" away:

   - **Never `decodeAudioData` at playback.** A five-minute stereo track decoded
     to PCM is ~50MB resident. Decoding happens once, at import, mono at 8kHz
     (`src/lib/analyse.ts`); playback streams from the blob through `<audio>`.
   - **Only a texture may be layered under music.** Rain, surf, wind and fire
     have no key and no pulse, so they cannot disagree with a recording. A pad
     or a second track can, and there is no way to know in advance that it will
     not. `settings.ambientLayer` is typed to textures for this reason, and the
     coercion in `store.ts` refuses anything else.

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
- The service worker is **generated** by an inline plugin in `vite.config.ts`;
  there is no `sw.js` in the tree to edit. Navigations are network-first so a
  deploy is never stale, hashed assets are cache-first, and the cache name is
  derived from the built filenames so the old one is dropped on activate.
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
