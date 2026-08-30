/*
 * What plays while a session is open.
 *
 * The one public entry point for sound: constant beds (a single synthesised
 * texture, unchanging), session soundtracks (layered and driven by the arc —
 * see soundtrack.ts), and the user's own imported files. Callers pick a kind
 * and never learn which of the three they got.
 *
 * Nothing here fetches audio. The beds and soundtracks are generated as they
 * play; imported files come from the phone's own file picker. See CLAUDE.md
 * rule 5.
 */

import { context, emptySink, releaseSink, texture, type Sink, type SynthKind } from './audio';
import { isThemeId, resolveTheme, startTheme, stopTheme, THEMES, type ThemeId } from './soundtrack';
import { getTrack } from './tracks';

export type { SynthKind, ThemeId };

/** A bed, a soundtrack, silence, or one of the user's own files. */
export type AmbientKind = 'off' | SynthKind | ThemeId | `track:${string}`;

export function isTrack(kind: AmbientKind): kind is `track:${string}` {
  return kind.startsWith('track:');
}

export function trackIdOf(kind: AmbientKind): string | null {
  return isTrack(kind) ? kind.slice('track:'.length) : null;
}

/** The constant beds. Kept alongside the soundtracks: they cost nothing, and
 *  sometimes an unchanging texture is exactly what is wanted. */
export const AMBIENT_KINDS: Array<{ id: 'off' | SynthKind; label: string; note: string }> = [
  { id: 'off', label: 'Off', note: 'Silence' },
  { id: 'rain', label: 'Rain', note: 'Steady, close' },
  { id: 'waves', label: 'Waves', note: 'Slow swell' },
  { id: 'wind', label: 'Wind', note: 'Open and high' },
  { id: 'fire', label: 'Fire', note: 'Crackle and hiss' },
  { id: 'drone', label: 'Drone', note: 'Low fifth, a bell' },
];

export { THEMES };

const SYNTH_IDS: SynthKind[] = ['rain', 'waves', 'wind', 'fire', 'drone'];
const isBed = (k: AmbientKind): k is SynthKind => (SYNTH_IDS as string[]).includes(k);

let master: GainNode | null = null;
let sink: Sink = emptySink();
let current: AmbientKind = 'off';

/*
 * ── The user's own files ───────────────────────────────────────────────────
 *
 * An <audio> element rather than a decoded Web Audio buffer: an hour-long file
 * decoded to PCM would be hundreds of megabytes in memory, while the element
 * streams it from the blob and loops natively.
 *
 * It is kept alive across selections and prepared ahead of time, because iOS
 * only honours play() inside a user gesture — awaiting the blob first would
 * break that chain, so by the time Begin is pressed the source is already set.
 */
let el: HTMLAudioElement | null = null;
let elUrl: string | null = null;
let elTrackId: string | null = null;
let fade: number | null = null;

function element(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
  }
  return el;
}

function rampTo(target: number, ms: number, thenPause = false) {
  const node = element();
  if (fade !== null) window.clearInterval(fade);
  const from = node.volume;
  const started = Date.now();
  fade = window.setInterval(() => {
    const t = Math.min(1, (Date.now() - started) / ms);
    node.volume = Math.max(0, Math.min(1, from + (target - from) * t));
    if (t >= 1) {
      if (fade !== null) window.clearInterval(fade);
      fade = null;
      if (thenPause) node.pause();
    }
  }, 40);
}

/**
 * Load a track's blob into the element without playing it. Safe to call from
 * an effect — it is the play() that needs a gesture, not the loading.
 */
export async function prepareAmbient(kind: AmbientKind) {
  const id = trackIdOf(kind);
  if (!id || id === elTrackId) return;
  const track = await getTrack(id);
  if (!track) return;
  if (elUrl) URL.revokeObjectURL(elUrl);
  elUrl = URL.createObjectURL(track.blob);
  elTrackId = id;
  const node = element();
  node.src = elUrl;
  node.load();
}

/** Drops the loaded file. Called when that track is deleted. */
export function forgetTrack(id: string) {
  if (elTrackId !== id) return;
  element().pause();
  element().removeAttribute('src');
  if (elUrl) URL.revokeObjectURL(elUrl);
  elUrl = null;
  elTrackId = null;
  if (current === `track:${id}`) current = 'off';
}

export function playing(): AmbientKind {
  return current;
}

export function stopAmbient() {
  current = 'off';
  stopTheme();
  if (el && !el.paused) rampTo(0, 400, true);

  const dying = sink;
  sink = emptySink();
  const ac = context();

  if (master && ac) {
    // Fade rather than cut: an abrupt stop on a noise bed is a click.
    const g = master;
    master = null;
    try {
      const at = ac.currentTime;
      g.gain.cancelScheduledValues(at);
      g.gain.setValueAtTime(g.gain.value, at);
      g.gain.linearRampToValueAtTime(0.0001, at + 0.4);
    } catch {
      /* no-op */
    }
    // Sources are released only once the fade has run.
    window.setTimeout(() => {
      releaseSink(dying);
      try {
        g.disconnect();
      } catch {
        /* no-op */
      }
    }, 500);
    return;
  }
  master = null;
  releaseSink(dying);
}

/** The session ended. Soundtracks land on the tonic; beds and files just stop. */
export function resolveAmbient() {
  resolveTheme();
}

/**
 * Start whatever was chosen, replacing what was playing. Must be called from a
 * user gesture the first time — iOS will not start audio otherwise.
 */
export function startAmbient(kind: AmbientKind, level = 0.35) {
  if (kind === current) return;
  stopAmbient();
  if (kind === 'off') return;

  const id = trackIdOf(kind);
  if (id) {
    current = kind;
    const run = () => {
      const node = element();
      node.volume = 0;
      void node.play().catch(() => undefined);
      rampTo(level, 1200);
    };
    // Already loaded: play synchronously, so the call stays inside the gesture
    // that triggered it and iOS allows it. Otherwise load first and start when
    // it lands — checking that the choice still stands, since a slow load can
    // outlive the user changing their mind.
    if (id === elTrackId) run();
    else void prepareAmbient(kind).then(() => current === kind && run());
    return;
  }

  if (isThemeId(kind)) {
    current = kind;
    // Soundtracks sit a little below the beds: there are more layers, and the
    // arc raises the level again through the middle of the session.
    startTheme(kind, level * 0.8);
    return;
  }

  if (!isBed(kind)) return;

  const ac = context();
  if (!ac) return;

  try {
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, ac.currentTime);
    out.gain.linearRampToValueAtTime(level, ac.currentTime + 1.2);
    out.connect(ac.destination);
    master = out;
    current = kind;
    texture(ac, kind, out, sink);
  } catch {
    stopAmbient();
  }
}
