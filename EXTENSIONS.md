# EXTENSIONS.md — Ridge

What comes **after** the core build. Everything here is deliberately out of `BUILD_SPEC.md` so the first nine phases stay shippable.

Rule of thumb: the core is done when you can complete a full session without touching anything else. Nothing below should be started before that's true.

Tiers reflect value per unit of effort, not sequence within a tier.

---

## Tier 1 — Makes the app feel finished

### 1.1 Asset layer

The core ships with zero binary assets. That's correct for phase 1 and wrong by month two.

- **App icon and splash** — a single mark that reads at 48px. The day/night duality is the obvious source: a horizon line, sun above / moon below. Ship as SVG plus generated PNG set via `vite-plugin-pwa`.
- **PWA manifest + service worker.** This is what turns the app from a bookmark into something on the home screen that opens instantly and works in a basement gym with no signal. Cache-first for the shell, since there's nothing dynamic to fetch. Highest value item on this entire list.
- **Icon set audit.** lucide-react covers most needs but not exercise-specific ones. Anything missing gets hand-drawn into the SVG registry rather than pulling a second icon library.
- **Sound set, optional and off by default.** Three sounds total: rep tick, hold complete, rest over. Short, soft, low-frequency — a gym is loud and a bedroom at night is quiet, so both need to work. Web Audio API oscillators rather than audio files keeps the bundle at zero cost.
- **Font decision.** System stack is the right call for phase 1. If it starts feeling generic, one variable font, self-hosted, subset to Latin — never a CDN, that breaks the offline guarantee.

### 1.2 Animation depth

The core's stick figures are functional. The upgrade path, in order:

- **Multi-phase animations.** Right now each exercise is a single looping motion. Real movements have phases — the Jefferson curl's segmental roll-down is genuinely different from its roll-up. Split into keyframe sequences with a visible pause at the bottom position.
- **Tempo-synced playback.** When an exercise has a `tempo`, the animation should run at that tempo rather than its default loop speed. A 5-second descent shown at 5 real seconds is instruction; shown at 2 is decoration.
- **Form-cue highlighting.** During specific animation phases, highlight the relevant body segment — the lumbar spine glowing during the neutral-back phase of a deadlift, the shoulder blade during a scapular pull. This is where a stick figure starts teaching rather than just illustrating.
- **Stage-entry animation.** The figure draws itself in with an SVG stroke-dasharray reveal on stage arrival, ~400ms. Cheap, and it makes each stage feel like an arrival.
- **Day/night motion character.** Day animations snap; night animations should breathe, with a subtle scale oscillation synced to a 4-second cycle that matches a slow exhale. Reinforces the mode metaphor at the level of movement, not just colour.

### 1.3 Rest-day and recovery awareness

- Rest days shown explicitly on the home screen rather than as an absence.
- A "how does the back feel today?" single-tap check-in, three states, logged. Correlate against sessions over time — this is the data that's actually useful to bring to a physio appointment.
- Soft warning when three gym sessions land in four days.

---

## Tier 2 — Session customization

The core ships four fixed sessions. Customization is where a personal app either becomes genuinely yours or becomes a worse version of every generic tracker. Constrain it hard.

### 2.1 Substitution, not construction

Do **not** build a free-form session builder. Build **substitution**: each exercise carries a small list of pre-approved alternates, and the user swaps within that list when a machine is occupied or something aggravates.

```ts
interface Exercise {
  // ...
  alternates?: string[];   // exercise ids, pre-vetted
}
```

Lat pulldown ↔ assisted pull-up. Bench ↔ dumbbell press. Trap-bar deadlift ↔ straight-bar, with a warning attached. The alternates list is authored, not user-editable, which preserves the medical logic while removing the single biggest friction point in a real gym.

Swaps are logged, so history shows what was actually done.

### 2.2 Volume adjustment

- Per-session **"short version"** toggle at the trailhead: drops the last main-block exercise and keeps the spine block intact. For the 40-minute days. The spine block is never what gets cut — encode that.
- Per-exercise set adjustment, ±1, from the stage. Persists as a preference, not just for today.

### 2.3 Rotation control

- Reorder A/B/C, or pin one to repeat.
- A fourth user-defined session slot, built only from exercises already in the library. This is the one place where genuine construction is safe, because the exercise pool stays curated.

### 2.4 Progressive-overload assistant

Not auto-adjustment — a suggestion surface. When an exercise hits its full prescription cleanly across the threshold number of sessions, the summit screen offers a specific next load ("+2.5kg on the pulldown?") with accept/dismiss. Dismissals are remembered so it doesn't nag.

Spine block gets the conservative threshold and softer copy, per the core rules.

---

## Tier 3 — Longer horizon

### 3.1 Data and insight

- **Weight-over-time charts** beyond the core's sparklines. Inline SVG still — no chart library.
- **Volume-load per block per week.** The single most useful number for spotting whether you're actually progressing or just showing up.
- **Session heatmap**, GitHub-contributions style, split day/night. Satisfying and diagnostically useful.
- **Physio export.** A one-page PDF or printable HTML view: last 8 weeks of spine-block loads, pain flags, session frequency. This is the killer feature for anyone in rehab and nobody builds it.

### 3.2 Climbing integration

- Log climbing sessions as a distinct third mode — grade, volume, session type. It's the actual sport; the gym work exists to serve it.
- Surface load interaction: a hard bouldering session and a heavy deadlift day 24 hours apart is worth flagging.

### 3.3 Programme phases

Mesocycle awareness — a 6-week block with a deload week, then a re-test. Changes prescriptions rather than requiring a rebuild. Meaningful only once several months of history exist.

### 3.4 Offline-first sync

If it ever needs to run on two devices: export/import already covers it manually. Anything automatic means a backend, which means auth, which contradicts the core premise. Resist unless there's a real second device.

---

## Explicitly out of scope, permanently

Listed so an agent doesn't propose them helpfully:

- Accounts, social features, sharing, leaderboards
- AI form checking from camera input
- Wearable or heart-rate integration
- Nutrition tracking of any kind
- Any recommendation engine that adjusts load without user confirmation
- Notifications more aggressive than a single optional daily mobility nudge

---

## Sequencing

If picking one thing: **PWA + service worker** (1.1). It changes the app's category.

If picking three: PWA, alternates/substitution (2.1), physio export (3.1).

Everything else is genuine polish, and polish before the core is solid is how personal projects die half-built.
