---
name: theme-tokens
description: Use when adding or changing a colour, spacing, radius or motion token — anything in src/theme/tokens.css, the colours block of tailwind.config.js, or the mode-transition rules in index.css. Also use when day and night look inconsistent, a colour is hardcoded rather than themed, a component looks wrong in one mode only, or the day/night cross-fade smears or flickers.
---

# Adding or changing a theme token

The day/night cycle is the organising metaphor of this app, so the theme is not
decoration — it is the thing the user is moving between. Two hard rules make it
work.

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

| Token | Day | Night |
|---|---|---|
| `--c-base` | near-black `#1a1d23` | deep indigo |
| `--c-surface` / `--c-raised` | half-steps lighter | half-steps lighter, softer |
| `--c-line` | visible 1px borders | low opacity; night has no hard borders |
| `--c-ink` / `--c-muted` / `--c-faint` | text ramp | lower contrast |
| `--c-accent` | amber `#f2a541` | violet |
| `--c-warmup` / `--c-main` / `--c-spine` / `--c-mobility` | block colours | block colours |
| `--c-danger` | pain flag, destructive actions | ditto |
| `--r-card` | 11px, sharp | 18px, softer |
| `--t-motion` | 150ms, snappy | 400ms, breathing |
| `--t-mode` | 600ms cross-fade | same |
| `--t-text` | 220ms | same |
| `--grad-top` / `--grad-bottom` | body gradient | body gradient |

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
- [ ] `npm run build` passes
