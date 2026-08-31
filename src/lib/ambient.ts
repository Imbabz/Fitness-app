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

import {
  context,
  emptySink,
  existingContext,
  releaseSink,
  texture,
  type Sink,
  type SynthKind,
} from './audio';
import {
  duckTheme,
  isThemeId,
  resolveTheme,
  startTheme,
  stopTheme,
  THEMES,
  type ThemeId,
} from './soundtrack';
import {
  duckCollection,
  prepareCollection,
  resolveCollection,
  setMusicAppMode,
  startCollection,
  stopCollection,
} from './player';
import { highlightOf } from './analyse';
import { getTrack } from './tracks';

export type { SynthKind, ThemeId };

/**
 * A bed, a soundtrack, silence, one of the user's own files, or a whole
 * category of them played through as a session-length sequence.
 */
export type AmbientKind = 'off' | SynthKind | ThemeId | `track:${string}` | `cat:${string}`;

export function isCollection(kind: AmbientKind): kind is `cat:${string}` {
  return kind.startsWith('cat:');
}

export function categoryOfKind(kind: AmbientKind): string | null {
  return isCollection(kind) ? kind.slice('cat:'.length) : null;
}

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
export { setMusicAppMode };

const SYNTH_IDS: SynthKind[] = ['rain', 'waves', 'wind', 'fire', 'drone'];
const isBed = (k: AmbientKind): k is SynthKind => (SYNTH_IDS as string[]).includes(k);

let master: GainNode | null = null;
let sink: Sink = emptySink();
let current: AmbientKind = 'off';

/*
 * A texture laid under your own music.
 *
 * Only ever a texture. Rain, surf and wind have no key and no pulse, so they
 * cannot disagree with whatever the music is doing; a pad or a second track
 * would, and there is no way to know in advance that it will not. That single
 * restriction is what makes this safe to offer at all.
 */
let layerSink: Sink = emptySink();
let layerGain: GainNode | null = null;

function startLayer(kind: 'off' | SynthKind) {
  stopLayer();
  if (kind === 'off') return;
  const ac = context();
  if (!ac) return;
  try {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    // Well under the music: this is a room the music sits in, not a second part.
    g.gain.linearRampToValueAtTime(0.16, ac.currentTime + 2.5);
    g.connect(ac.destination);
    layerGain = g;
    texture(ac, kind, g, layerSink);
  } catch {
    stopLayer();
  }
}

function stopLayer() {
  const dying = layerSink;
  layerSink = emptySink();
  const g = layerGain;
  layerGain = null;
  const ac = existingContext();
  if (g && ac) {
    try {
      g.gain.cancelScheduledValues(ac.currentTime);
      g.gain.setValueAtTime(g.gain.value, ac.currentTime);
      g.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.4);
    } catch {
      /* no-op */
    }
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
  releaseSink(dying);
}

/**
 * Dip everything briefly so a cue carries over it.
 *
 * A countdown beep is information and the bed is not; without this the beep has
 * to be loud enough to beat the music, which makes it exactly the startle the
 * whole soundtrack is built to avoid.
 */
export function duck(seconds = 1.2) {
  const ac = existingContext();
  if (!ac) return;
  for (const g of [master, layerGain]) {
    if (!g) continue;
    try {
      const now = ac.currentTime;
      const level = g.gain.value;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(level, now);
      g.gain.linearRampToValueAtTime(level * 0.35, now + 0.12);
      g.gain.linearRampToValueAtTime(level, now + seconds);
    } catch {
      /* no-op */
    }
  }
  duckTheme(seconds);
  duckCollection(seconds);
}

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
let elLoop: { start: number; end: number } | null = null;
let elWatch: ReturnType<typeof setInterval> | null = null;
let fade: number | null = null;

function element(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
  }
  // The element's own loop restarts at sample zero, which is neither the
  // trimmed start nor the seam-matched point. This watches for the highlight's
  // end and wraps to its start instead.
  elWatch ??= setInterval(() => {
    const node = el;
    if (!node || !elLoop || node.paused) return;
    if (node.currentTime >= elLoop.end || node.currentTime < elLoop.start - 1) {
      try {
        node.currentTime = elLoop.start;
      } catch {
        /* no-op */
      }
    }
  }, 400);
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
  const category = categoryOfKind(kind);
  if (category) {
    await prepareCollection(category);
    return;
  }
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
  // Same as a collection: a long file opens on its calmest stretch, and loops
  // that stretch rather than the whole thing.
  if (track.analysis) {
    const h = highlightOf(track.analysis);
    elLoop = h.end > h.start ? h : null;
    const seek = () => {
      try {
        node.currentTime = h.start;
      } catch {
        /* metadata not ready; the loop watcher will correct it */
      }
    };
    node.addEventListener('loadedmetadata', seek, { once: true });
    seek();
  } else {
    elLoop = null;
  }
}

/** Drops the loaded file. Called when that track is deleted. */
export function forgetTrack(id: string) {
  if (elTrackId !== id) return;
  element().pause();
  element().removeAttribute('src');
  if (elUrl) URL.revokeObjectURL(elUrl);
  elUrl = null;
  elTrackId = null;
  elLoop = null;
  if (current === `track:${id}`) current = 'off';
}

export function playing(): AmbientKind {
  return current;
}

export function stopAmbient() {
  current = 'off';
  stopTheme();
  stopCollection();
  stopLayer();
  if (el && !el.paused) rampTo(0, 400, true);

  const dying = sink;
  sink = emptySink();
  const ac = existingContext();

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

/** The session ended. Soundtracks land on the tonic; a collection settles. */
export function resolveAmbient() {
  resolveTheme();
  resolveCollection();
}

/**
 * Start whatever was chosen, replacing what was playing. Must be called from a
 * user gesture the first time — iOS will not start audio otherwise.
 */
export function startAmbient(kind: AmbientKind, level = 0.35, layer: 'off' | SynthKind = 'off') {
  if (kind === current) return;
  stopAmbient();
  if (kind === 'off') return;

  // Only under your own music. A soundtrack already aggregates its own
  // textures, and a bed is one — layering either would just be mud.
  if (layer !== 'off' && (isTrack(kind) || isCollection(kind))) startLayer(layer);

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

  const category = categoryOfKind(kind);
  if (category) {
    current = kind;
    void startCollection(category, level * 0.85);
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
