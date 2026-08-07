# Ridge

A personal training companion with a **day/night cycle**. Gym sessions live in
daylight, the daily mobility routine lives at night.

Built for one climber rehabbing an **L5-S1 disc protrusion**. Not a general
fitness app, and deliberately not one — the exercise selection, the ordering,
and several of the interactions are clinical decisions rather than features.

```
npm install
npm run dev        # http://localhost:5173/Fitness-app/
npm run build      # type-check + production bundle
npm run preview
```

No backend, no accounts, no network calls after first load. Everything lives in
`localStorage` under one versioned key.

---

## What it does

**Three questions, answered in under two seconds:** what am I doing today,
what is the next exercise, have I done my daily mobility yet.

- **Day — Gym.** Sessions A (Pull) / B (Push) / C (Mixed), ~60 min, 3×/week, on
  an automatic A→B→C rotation. Warm amber, high contrast, snappy.
- **Night — Restore.** The 13-minute daily routine: McGill's Big 3, cobra, wall
  glides. Cool indigo, low luminance, slow. Every day.

Mode defaults by time of day (night after 18:00) and a header toggle overrides
it for the rest of that calendar day.

**A session is a journey, not a checklist.** Trailhead → one exercise per
screen → summit. Full-screen interstitials mark each change of terrain. A
progress arc across the top is colour-coded by block, so the spine work is
visible ahead as its own stretch. Forward via the button, back via a chevron,
or swipe either way. Close the app mid-set and it reopens on the exact stage
with every logged set intact.

**Four trackers**, one per stage, sized for a thumb:

| | For |
|---|---|
| `RepCounter` | A 180px+ dial — the whole circle is the button. Tap to add a rep, press-and-hold to remove one. Overshoot is recorded honestly. A metronome bar appears when the exercise prescribes a tempo. |
| `HoldTimer` | Rep count *and* per-rep hold duration, which is why it can't reuse the others. Left/right indicator for bilateral work, and an optional auto-chain so you never touch the phone mid-set. |
| `DurationTimer` | The 15-minute cardio warm-up. Prominent pause — treadmills stop for all kinds of reasons. |
| `DistanceLogger` | Farmer's carries. A 5m stepper. Deliberately dumb: no GPS, no step counting. |

All timers store a target end-timestamp rather than decrementing a counter, so
screen lock and backgrounding don't make them drift. Each holds the screen awake
while active.

---

## The medical constraints

These are product requirements, not flavour text. `CLAUDE.md` states them as
non-negotiables and `.claude/skills/session-content/` explains the reasoning to
anyone — or anything — editing the seed data later.

1. **The spine block always renders last** and cannot be reordered. Loaded
   flexion on a cold spine is the specific thing being avoided. Enforced
   structurally in `data/sessions.ts`, not by convention.
2. **Spine-block stages are visually distinct** — warmer border and tint. They
   read as a different category of work.
3. **Pain flag.** The summit asks whether anything radiated into the glute, calf
   or heel. If flagged, the next session sharing that spine work opens with a
   persistent banner suggesting the load be held or reduced. It never adjusts a
   weight.
4. **Progression prompts** appear after two clean sessions for main work and
   **four** for the spine block, with more conservative copy.
5. **Morning warning** before 08:00 — discs are most pressurised after a night
   lying down.
6. **Every exercise carries its `why`.** The rationale is what makes the
   constraints stick instead of getting improvised around.

Four movements are excluded by design — bent-over barbell rows, standing
overhead press, crunches/sit-ups, and any loaded rotation. The reasons are
written into `data/exercises.ts` so they survive contact with a future edit.

---

## Stack

Vite · React 18 · TypeScript · Tailwind · lucide-react. That's the whole
dependency list, and it's meant to still build in three years.

- Day/night is a class swap on `<html>` driving CSS custom properties. No
  component takes a `mode` prop.
- Animations are 21 hand-written SVG stick figures with CSS keyframes. No
  animation library, no Lottie, no GIFs. They freeze at their mid-pose under
  `prefers-reduced-motion`.
- No router. A `view` state machine covers four screens.
- ~79 KB gzipped, against a 300 KB budget.

## Deploying

Pushes to `main` build and publish to GitHub Pages via
`.github/workflows/deploy.yml` — enable Pages with **Source: GitHub Actions**
first.

`vite.config.ts` sets `base` to `/Fitness-app/`. Serving from a custom domain or
a user-page root instead? Build with `BASE_PATH=/`.

---

## Documents

- `BUILD_SPEC.md` — the full brief: data model, screens, trackers, visual
  direction, build phases
- `EXTENSIONS.md` — what deliberately comes after the core, in value order
- `CLAUDE.md` — the working agreement, non-negotiables, and known traps
- `.claude/skills/` — four procedures encoded so they don't need re-explaining:
  seed content, trackers, animations, theme tokens

---

Ridge is a training log, not medical advice. It surfaces patterns and stops
there — every load decision belongs to you and your physio.
