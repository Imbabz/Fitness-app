/*
 * The session arc.
 *
 * One number — how far through the session you are — shaped into the two
 * parameters every soundtrack listens to. Driven by work completed rather than
 * by a clock, so the music lasts exactly the session by construction: linger on
 * a set and it stretches, move quickly and it tightens.
 *
 * Both the synthesised themes and the user's own music read from here, so they
 * breathe identically and only the material differs.
 */

export interface ArcShape {
  /** Level and, for themes, how much melodic material. 0.3 - 1. */
  presence: number;
  /** Lowpass cutoff in Hz. Distance, in effect. */
  brightness: number;
}

/**
 * Sparse at both edges, most alive in the middle.
 *
 * The warm-up does not need much, and the spine block at the end — face-down on
 * the floor at 22:00 — wants less still. A half sine is the simplest curve that
 * does that without a single discontinuity anywhere.
 */
export function shape(progress: number): ArcShape {
  const p = Math.max(0, Math.min(1, progress));
  const swell = Math.sin(Math.PI * p);
  return { presence: 0.3 + 0.7 * swell, brightness: 650 + 950 * swell };
}

/** Seconds for the eased value to cover most of the distance to a new target. */
const EASE_SECONDS = 20;
const TICK_MS = 250;

let target = 0;
let eased = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(shape: ArcShape, progress: number) => void>();

function emit() {
  const s = shape(eased);
  for (const fn of listeners) fn(s, eased);
}

function tick() {
  if (Math.abs(target - eased) < 0.0005) {
    eased = target;
    stopTicking();
    emit();
    return;
  }
  // Exponential smoothing: coarse input (one update per logged set) glides
  // instead of stepping, and the rate is independent of how often this fires.
  eased += (target - eased) * (1 - Math.exp(-TICK_MS / 1000 / EASE_SECONDS));
  emit();
}

function startTicking() {
  timer ??= setInterval(tick, TICK_MS);
}

function stopTicking() {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

/** Where the session actually is. Safe to call on every render. */
export function setProgress(progress: number) {
  const next = Math.max(0, Math.min(1, progress));
  if (next === target) return;
  target = next;
  startTicking();
}

/**
 * Jump straight there with no easing. Used when a soundtrack starts, so it
 * opens at the right point rather than climbing from zero — resuming a session
 * two thirds through should sound two thirds through.
 */
export function seek(progress: number) {
  target = eased = Math.max(0, Math.min(1, progress));
  stopTicking();
  emit();
}

export function currentShape(): ArcShape {
  return shape(eased);
}

export function progress(): number {
  return eased;
}

export function subscribe(fn: (shape: ArcShape, progress: number) => void): () => void {
  listeners.add(fn);
  fn(shape(eased), eased);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) stopTicking();
  };
}
