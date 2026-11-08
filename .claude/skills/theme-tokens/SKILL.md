---
name: theme-tokens
description: Use when adding or changing a colour, spacing, radius or motion token — anything in src/theme/tokens.css, the colours block of tailwind.config.js, or the mode-transition rules in index.css. Also use when day and night look inconsistent, a colour is hardcoded rather than themed, a component looks wrong in one mode only, or the day/night cross-fade smears or flickers.
---

# Adding or changing a theme token

The day/night cycle is the organising metaphor of this app, so the theme is not
decoration — it is the thing the user is moving between. Two hard rules make it
work.

## Rule 0: a token nobody reads is a lie

Four tokens sat in this file for months defining a softer night mode —
`--card-border-opacity`, `--weight-title`, `--tracking-title`, `--stage-gap` —
and nothing read any of them. The design system said night was calmer; the app
rendered it identically to day.

Before adding a token, know which rule or class will read it. After adding one,
grep for `var(--your-token)` and confirm it appears. A token is a promise the
CSS has to keep.

Text tiers carry a second obligation. `--c-ink`, `--c-muted` and `--c-faint`
are used at 10-12px, so each must clear **4.5:1** against both `--c-surface`
and `--c-base` — the 3:1 large-text allowance does not apply at those sizes.
Check any change to them before shipping it.

## Rule 1: every token needs both values

A token defined in only one mode silently inherits the other's value. This is
the most common regression in this codebase, and it is invisible until someone
opens the app at the wrong time of day.

`src/theme/tokens.css` has two blocks, `.mode-day` and `.mode-night`. Anything
you add to one goes in the other, in the same order, in the same commit.

```css
.mode-day   { --c-thing: 242 165 65; }
.mode-night { --c-thing: 165 154 232; }
```

Colours are **space-separated RGB triples**, not hex and not `rgb(...)`, so
Tailwind's `/ <alpha-value>` opacity modifier works:

```js
// tailwind.config.js
thing: 'rgb(var(--c-thing) / <alpha-value>)',
```

That then gives you `bg-thing`, `text-thing`, `border-thing/40` and so on.

## Rule 2: mode is a class on `<html>`, never a prop

`AppStateContext` toggles `.mode-day` / `.mode-night` on
`document.documentElement`. That is the only place mode touches the DOM. No
component takes a `mode` prop, no component branches on `state.mode` for
styling. If you find yourself writing `state.mode === 'night' ? ... : ...` in a
className, you want a token instead.

Mode-specific *structure* (as opposed to colour) is expressed with a descendant
selector in `index.css`:

```css
.mode-night .ridge-hero { box-shadow: var(--shadow-card); }
```

## The current token set

Day is **paper and ink**, night is **indigo and moonlight**. That asymmetry is
the point: two dark themes made the day/night cycle a change of hue, which is
the weakest version of the app's organising idea. A light ground in daylight
and a dark one after dark is the difference the metaphor was always claiming.

Colours are named from the traditional Japanese set, because the look is meant
to be graphic and sober rather than decorative — a near-monochrome ground
carrying one saturated accent, the way a seal sits on a print.

| Token | Day | Night |
|---|---|---|
| `--c-base` | unbleached paper | deep indigo |
| `--c-surface` / `--c-raised` | a near-white sheet, then a warmer step **below** the page | half-steps lighter |
| `--c-line` | visible hairlines | low opacity; night has no hard borders |
| `--c-ink` / `--c-muted` / `--c-faint` | sumi text ramp | 月白 moon-white ramp |
| `--c-accent` | 藍 indigo | moonlight blue |
| `--c-warmup` | 浅葱 asagi | paler asagi |
| `--c-main` | 藍, same as the accent | moonlight blue |
| `--c-spine` | 朱 vermillion | softened vermillion |
| `--c-mobility` | 藤 wisteria | paler wisteria |
| `--c-danger` | 蘇芳 maroon, kept duller than the vermillion | muted red |
| `--c-horizon` / `--c-mist` | the sky layer; see below | ditto |
| `--r-card` | 5px, print | 10px, softer |
| `--t-motion` | 150ms, snappy | 400ms, breathing |
| `--t-mode` | 600ms cross-fade | same |
| `--t-text` | 220ms | same |
| `--gap-screen` / `--pad-card` | the screen rhythm; day sits tighter | night keeps more air |
| `--tracking-title` / `--weight-title` / `--tracking-label` | type, by mode | ditto |
| `--stage-gap` | vertical rhythm inside a stage | wider |
| `--grad-top` / `--grad-bottom` | body gradient | body gradient |

### `raised` is below the page in day, above it at night

On a dark theme an elevated surface is lighter than the page, and `raised` was
written that way. On paper it has to go the other way: a filled button a few
points lighter than a near-white page is invisible, and the Start button
briefly shipped reading as bare text. In day, `surface` is the sheet laid on
top and `raised` is the darker fill; at night both step up. Check a filled
button against the page, not just text against a card.

### The sky

`.ridge-sky` in `index.css` draws a horizon hairline and three banks of mist
from `--c-horizon` and `--c-mist`, entirely with gradients — no images, so it
costs no network call and no precache, which rule 5 requires.

Two things about it are load-bearing. It is `position: fixed` and must stay out
of any transformed ancestor, or it anchors to that element instead of the
viewport — the same trap that re-anchored the rest-timer sheet. And the mist is
gradients rather than `filter: blur()`, because a blurred full-screen layer
repaints every frame on a phone.

In day the mist is **darker** than the page, not lighter. A white mist on white
paper is nothing; it has to behave like thinned ink.

### Measure contrast, do not eyeball it

A light ground breaks contrast in places a dark one never did. The tier that
goes first is `--c-faint`, which carries 10–12px text and on paper sits on the
page itself as often as on a card — it needs 4.5:1 against **`--c-base`**, not
only against `--c-surface`. Compute the ratios in the browser across both
modes before shipping a palette change.

## Motion timing conventions

- **`--t-mode` (600ms, `ease-in-out`)** — background gradient, accent, card
  background, border opacity. This is the "light changing" transition and it
  should never feel like a theme toggle.
- **`--t-text` (220ms)** — text colour only. It is deliberately faster than
  `--t-mode`; matching them makes text smear against the moving background.
- **`--t-motion`** — component motion, and it differs by mode on purpose:
  150ms in day, 400ms at night. Stage transitions read this, which is why the
  night journey cross-fades where the day journey slides.

Do not introduce a fourth timing constant. If something needs its own duration,
it probably wants one of these three.

## Block colours

`warmup`, `main`, `spine` and `mobility` each have a colour, used by the
progress arc, the trailhead route profile and the block interstitials. The
**spine** colour is deliberately warmer than `main` in day mode — spine work
must read as a different category of work, not as more main work. Keep that
separation if you retune the palette.

## Gotchas

- **Animation fill-mode.** Stage transitions use `backwards`, never
  `forwards`/`both`. A retained transform makes the element a containing block
  for `position: fixed` descendants, which re-anchors the rest-timer sheet to
  the stage instead of the viewport.
- **`text-base` is a colour here, not a font size.** `--c-base` is the page
  background, so `text-base` renders dark text on an accent button. That is
  intended; it also means you cannot use Tailwind's `text-base` size utility.
  Use `text-[1rem]` if you need that size.
- **`prefers-reduced-motion`** drops slides, pulses and sheet animations but
  keeps ring fills. Anything new that moves should follow the same split.

## Checklist

- [ ] Token defined in **both** `.mode-day` and `.mode-night`
- [ ] Colour is a space-separated RGB triple
- [ ] Exposed through `tailwind.config.js` if components need it
- [ ] No `state.mode` branching added to a className
- [ ] Checked in both modes at phone width, including the cross-fade itself
- [ ] Contrast measured, not eyeballed: every text tier ≥ 4.5:1 on **both**
      `--c-surface` and `--c-base`, and a filled button distinguishable from
      the page
- [ ] `npm run build` passes
