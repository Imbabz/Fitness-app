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

import { context, existingContext } from './audio';
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
 * A synthesised impulse response — noise under an exponential decay. Two
 * seconds of it puts everything in a room, which is most of the difference
 * between "a track playing" and "something restful in the background".
 */
function reverb(ac: AudioContext): ConvolverNode | null {
  try {
    const length = Math.floor(ac.sampleRate * 2);
    const buf = ac.createBuffer(2, length, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    const node = ac.createConvolver();
    node.buffer = buf;
    return node;
  } catch {
    return null;
  }
}

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

function wire(ac: AudioContext, d: Deck) {
  if (d.wired || !filter || !d.gain) return;
  try {
    ac.createMediaElementSource(d.el).connect(d.gain).connect(filter);
    d.wired = true;
  } catch {
    /* already wired, or the element is not eligible */
  }
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

  if (!nextDeck.gain) return;
  nextDeck.gain.gain.value = 0;
  void nextDeck.el.play().catch(() => undefined);
  ramp(nextDeck.gain.gain, meta.analysis?.gain ?? 1, CROSSFADE, ac);

  const outgoing = decks[active];
  if (outgoing?.gain) {
    ramp(outgoing.gain.gain, 0, CROSSFADE, ac);
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
    if (d?.gain && meta) {
      wire(ac, d);
      d.gain.gain.value = 0;
      void d.el.play().catch(() => undefined);
      ramp(d.gain.gain, meta.analysis?.gain ?? 1, 3, ac);
    }
    unsubscribe?.();
    unsubscribe = subscribe((s) => {
      try {
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
