/*
 * Playing your own music as a session soundtrack.
 *
 * A single file on repeat is what this replaces: it restarts audibly every few
 * minutes and sits at one level from Begin to Summit. A collection instead
 * plays through its tracks — busiest first, calmest last, so the quietest music
 * lands on the spine block — crossfading between them, looping at seam-matched
 * points, and passing everything through the same session arc the synthesised
 * soundtracks use.
 *
 * Streams from the blob through <audio>; nothing is ever decoded at playback.
 * A five-minute stereo track decoded to PCM is ~50MB resident, and a phone will
 * not survive several. The one decode happens at import, in analyse.ts.
 */

import { context, existingContext, reverb } from './audio';
import { subscribe } from './arc';
import { highlightOf } from './analyse';
import { categoryOf, getTrack, listTracks, tracksIn, type TrackMeta } from './tracks';

/** Seconds of overlap between one track and the next. */
const CROSSFADE = 8;

interface Deck {
  el: HTMLAudioElement;
  /** Absent until a gesture has let the context exist. */
  gain: GainNode | null;
  url: string | null;
  /** Set once; a MediaElementSource may not be created twice for one element. */
  wired: boolean;
}

let decks: Deck[] = [];
let filter: BiquadFilterNode | null = null;
let master: GainNode | null = null;
let unsubscribe: (() => void) | null = null;
let queue: TrackMeta[] = [];
let position = 0;
let active = 0;
let watchdog: ReturnType<typeof setInterval> | null = null;
let currentCategory: string | null = null;
let prepared: string | null = null;
let level = 0.3;
let closing = false;

/**
 * The element half of a deck, which needs no AudioContext. Split out so that
 * preparing a collection touches no audio graph at all — see prepareCollection.
 */
function element(index: number): Deck | null {
  const existing = decks[index];
  if (existing) return existing;
  try {
    const el = new Audio();
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    const made: Deck = { el, gain: null, url: null, wired: false };
    decks[index] = made;
    return made;
  } catch {
    return null;
  }
}

/** The element plus its gain node. Only called once a gesture has run. */
function deck(ac: AudioContext, index: number): Deck | null {
  const d = element(index);
  if (!d) return null;
  d.gain ??= ac.createGain();
  d.gain.gain.value = d.gain.gain.value || 0;
  return d;
}

/*
 * ── Why there are two ways to play the same file ───────────────────────────
 *
 * Spotify and YouTube are native apps. They set an AVAudioSession category that
 * explicitly ignores the ring/silent switch and permits background audio. A web
 * page cannot call that API at all — Safari picks the category for it, and it
 * picks based on *how* the sound is produced:
 *
 *   - An <audio> element playing on its own is media playback. On iOS that
 *     sounds through the silent switch, survives the screen locking, and can
 *     own the lock-screen controls.
 *   - Anything routed through an AudioContext is Web Audio. That respects the
 *     silent switch and stops when the app is backgrounded.
 *
 * createMediaElementSource moves a file from the first category into the
 * second. So the filter and the reverb are not free: they cost exactly the
 * behaviour that makes a music app feel like one.
 *
 * musicAppMode therefore chooses. On, the element plays untouched and the arc
 * drives el.volume instead of a gain node — less shaping, but you can hear it
 * with the phone on silent and it keeps going in your pocket. Off, the full
 * chain applies and it behaves like the rest of Ridge's audio.
 */
let direct = true;

export function setMusicAppMode(on: boolean) {
  direct = on;
}

function wire(ac: AudioContext, d: Deck) {
  if (direct || d.wired || !filter || !d.gain) return;
  try {
    ac.createMediaElementSource(d.el).connect(d.gain).connect(filter);
    d.wired = true;
  } catch {
    /* already wired, or the element is not eligible */
  }
}

/** Level for a deck, applied wherever this mode puts it. */
function applyLevel(d: Deck, value: number, ac: AudioContext, seconds: number) {
  if (direct) {
    // No Web Audio in the path, so the element's own volume is the only lever.
    const from = d.el.volume;
    const started = Date.now();
    const step = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / (seconds * 1000));
      try {
        d.el.volume = Math.max(0, Math.min(1, from + (value - from) * t));
      } catch {
        /* no-op */
      }
      if (t >= 1) window.clearInterval(step);
    }, 60);
    return;
  }
  if (d.gain) ramp(d.gain.gain, value, seconds, ac);
}

function ramp(param: AudioParam, to: number, seconds: number, ac: AudioContext) {
  try {
    const now = ac.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(to, now + seconds);
  } catch {
    /* no-op */
  }
}

async function load(d: Deck, meta: TrackMeta): Promise<boolean> {
  const track = await getTrack(meta.id);
  if (!track) return false;
  if (d.url) URL.revokeObjectURL(d.url);
  d.url = URL.createObjectURL(track.blob);
  d.el.src = d.url;
  // Long tracks open on their calmest sustained stretch rather than always on
  // their first second, which you would otherwise hear every single session and
  // never get past. Short ones are unaffected — the highlight is the whole loop.
  d.el.currentTime = meta.analysis ? highlightOf(meta.analysis).start : 0;
  // Looping is handled by the watchdog against the seam-matched points, so the
  // element's own loop is left off — it would restart at sample zero.
  d.el.loop = false;
  d.el.load();
  return true;
}

/** Where this track should hand over: its loop end, or the end of the file. */
function handoverAt(meta: TrackMeta, el: HTMLAudioElement): number {
  const a = meta.analysis;
  if (a) {
    const h = highlightOf(a);
    if (h.end > h.start) return h.end;
  }
  const duration = Number.isFinite(el.duration) ? el.duration : 0;
  return duration > 0 ? duration - (a?.trimEnd ?? 0) : 0;
}

async function advance(ac: AudioContext) {
  if (closing || queue.length === 0) return;
  const next = (active + 1) % 2;
  const nextDeck = deck(ac, next);
  const meta = queue[position % queue.length];
  if (!nextDeck || !meta) return;

  position = (position + 1) % queue.length;
  if (!(await load(nextDeck, meta))) return;
  wire(ac, nextDeck);

  if (!direct && !nextDeck.gain) return;
  if (nextDeck.gain) nextDeck.gain.gain.value = 0;
  nextDeck.el.volume = 0;
  void nextDeck.el.play().catch(() => undefined);
  applyLevel(nextDeck, Math.min(1, meta.analysis?.gain ?? 1) * level, ac, CROSSFADE);

  const outgoing = decks[active];
  if (outgoing) {
    applyLevel(outgoing, 0, ac, CROSSFADE);
    const stale = outgoing;
    window.setTimeout(() => {
      // Only pause if it is still the one that faded out — a fast switch could
      // have made it current again.
      if (decks[active] !== stale) stale.el.pause();
    }, CROSSFADE * 1000 + 200);
  }
  active = next;
}

/**
 * Polls rather than using the `ended` event, because the handover has to start
 * CROSSFADE seconds *before* the end, and because a seam-matched loop point is
 * usually well short of the file's actual end.
 */
function startWatchdog(ac: AudioContext) {
  if (watchdog !== null) return;
  watchdog = setInterval(() => {
    if (closing) return;
    const d = decks[active];
    const meta = queue[(position - 1 + queue.length) % queue.length];
    if (!d || !meta || d.el.paused) return;
    const end = handoverAt(meta, d.el);
    if (end > 0 && d.el.currentTime >= end - CROSSFADE) void advance(ac);
  }, 500);
}

/**
 * Queue a collection and load its first track, without playing.
 *
 * Split from starting it for the same reason single tracks are: iOS only
 * honours play() inside a user gesture, and awaiting IndexedDB first breaks
 * that chain. Called while the trailhead is on screen, so pressing Begin has
 * nothing left to wait for.
 */
export async function prepareCollection(category: string): Promise<boolean> {
  if (prepared === category && queue.length > 0) return true;

  const chosen = tracksIn(await listTracks(), category);
  if (chosen.length === 0) return false;

  /*
   * Deliberately no AudioContext here, and no graph.
   *
   * This runs from an effect at the trailhead, not from a tap. Creating the
   * context outside a user gesture makes iOS hand back a suspended one — and an
   * <audio> element routed into a suspended context is completely silent while
   * play() still resolves successfully, so nothing appears to be wrong. All
   * this does is fetch the blob and queue the order; the graph is built in
   * startCollection, which is reached from the Begin press.
   */
  const first = chosen[0];
  const d = element(0);
  if (!first || !d) return false;
  if (!(await load(d, first))) return false;

  queue = chosen;
  position = 1 % chosen.length;
  active = 0;
  prepared = category;
  return true;
}

function buildGraph(ac: AudioContext) {
  if (master && filter) return;
  const out = ac.createGain();
  out.gain.value = level;
  master = out;

  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.6;
  lp.frequency.value = 3000;
  filter = lp;

  const space = reverb(ac);
  if (space) {
    const wet = ac.createGain();
    wet.gain.value = 0.25;
    lp.connect(space).connect(wet).connect(out);
  }
  lp.connect(out);
  out.connect(ac.destination);
}

/** Lock-screen title and controls. The visible half of "like a music app". */
function announce(meta: TrackMeta) {
  try {
    const ms = navigator.mediaSession;
    if (!ms) return;
    ms.metadata = new MediaMetadata({
      title: meta.name,
      artist: currentCategory ?? 'Ridge',
      album: 'Ridge',
    });
    ms.playbackState = 'playing';
    ms.setActionHandler('pause', () => {
      for (const d of decks) d?.el.pause();
      ms.playbackState = 'paused';
    });
    ms.setActionHandler('play', () => {
      const d = decks[active];
      if (d) void d.el.play().catch(() => undefined);
      ms.playbackState = 'playing';
    });
  } catch {
    /* no MediaSession here */
  }
}

export async function startCollection(category: string, atLevel = 0.3): Promise<boolean> {
  const ac = context();
  if (!ac) return false;

  const ready = prepared === category && queue.length > 0 && decks[0]?.url;
  if (!ready) {
    stopCollection();
    if (!(await prepareCollection(category))) return false;
  }

  closing = false;
  level = atLevel;
  currentCategory = category;

  try {
    buildGraph(ac);
    // Now that a gesture has run, the deck can have its gain node and be wired.
    const d = deck(ac, active);
    const meta = queue[(position - 1 + queue.length) % queue.length];
    if (d && meta) {
      wire(ac, d);
      if (d.gain) d.gain.gain.value = 0;
      d.el.volume = 0;
      void d.el.play().catch(() => undefined);
      applyLevel(d, Math.min(1, meta.analysis?.gain ?? 1) * level, ac, 3);
      announce(meta);
    }
    unsubscribe?.();
    unsubscribe = subscribe((s) => {
      try {
        if (direct) {
          // The arc still shapes the level; only the tone shaping is lost.
          const d = decks[active];
          const meta = queue[(position - 1 + queue.length) % queue.length];
          if (d && !closing) {
            const base = Math.min(1, meta?.analysis?.gain ?? 1) * level;
            d.el.volume = Math.max(0, Math.min(1, base * (0.6 + 0.4 * s.presence)));
          }
          return;
        }
        // Music carries its own detail, so the filter opens wider than it does
        // for a synthesised pad — closing it as far would just sound muffled.
        filter?.frequency.setTargetAtTime(s.brightness * 2.6, ac.currentTime, 4);
        if (!closing) {
          master?.gain.setTargetAtTime(level * (0.6 + 0.4 * s.presence), ac.currentTime, 4);
        }
      } catch {
        /* being torn down */
      }
    });

    startWatchdog(ac);
    return true;
  } catch {
    stopCollection();
    return false;
  }
}

/** The session ended: settle, then let stopCollection fade it out. */
export function resolveCollection() {
  const ac = existingContext();
  if (!ac || !master || closing) return;
  closing = true;
  try {
    master.gain.setTargetAtTime(level * 0.5, ac.currentTime, 2);
  } catch {
    /* no-op */
  }
}

/** Dip for a cue. See duck() in ambient.ts for why this exists. */
export function duckCollection(seconds = 1.2) {
  const ac = existingContext();
  if (!ac || !master) return;
  try {
    const now = ac.currentTime;
    const level = master.gain.value;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(level, now);
    master.gain.linearRampToValueAtTime(level * 0.35, now + 0.12);
    master.gain.linearRampToValueAtTime(level, now + seconds);
  } catch {
    /* no-op */
  }
}

export function stopCollection() {
  unsubscribe?.();
  unsubscribe = null;
  closing = false;
  currentCategory = null;
  prepared = null;
  queue = [];
  position = 0;

  if (watchdog !== null) {
    clearInterval(watchdog);
    watchdog = null;
  }

  try {
    if (navigator.mediaSession) navigator.mediaSession.playbackState = 'none';
  } catch {
    /* no-op */
  }

  const ac = existingContext();
  const dying = decks;
  decks = [];
  const g = master;
  master = null;
  filter = null;

  if (g && ac) ramp(g.gain, 0.0001, 0.6, ac);

  window.setTimeout(() => {
    for (const d of dying) {
      try {
        d.el.pause();
        d.el.removeAttribute('src');
        d.el.load();
      } catch {
        /* no-op */
      }
      if (d.url) URL.revokeObjectURL(d.url);
      try {
        d.gain?.disconnect();
      } catch {
        /* no-op */
      }
    }
    try {
      g?.disconnect();
    } catch {
      /* no-op */
    }
  }, 700);
}

export function playingCollection(): string | null {
  return currentCategory;
}

export { categoryOf };
