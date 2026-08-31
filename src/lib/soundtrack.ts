/*
 * Session soundtracks, synthesised.
 *
 * A bed is one texture, unchanged from start to finish. A soundtrack aggregates
 * one or two of those textures under a harmonic pad, adds sparse melodic
 * accents, and derives all of it from the session arc — so it thins out over
 * the spine block and resolves when you finish.
 *
 * ── What makes this calm, and must not be "simplified" away ────────────────
 *
 * Modal, never functional. No leading tone anywhere: a major seventh pulls
 * toward its tonic, and anything that creates expectation creates tension.
 *
 * Accents come from a pentatonic subset of each mode. Any two notes of a
 * pentatonic scale are consonant in any order, so the accent picker can choose
 * at random and still never produce a sour interval. That is why there is no
 * note-choice logic here worth the name — the scale does the work.
 *
 * Attack of at least 0.3s and release of several seconds, on everything. This
 * is the single most important rule in the file. A short attack is a startle,
 * and a startle in the middle of a McGill hold is the opposite of the point.
 *
 * No percussion and no rhythm grid. Accents land at irregular intervals.
 */

import {
  context,
  drift,
  emptySink,
  existingContext,
  releaseSink,
  texture,
  type Sink,
  type SynthKind,
} from './audio';
import { currentShape, subscribe } from './arc';

export type ThemeId = 'rainfall' | 'shore' | 'hearth' | 'cloister';

/*
 * Semitone offsets. Aeolian and Dorian differ by one degree — the sixth.
 * Mixolydian is the one major-flavoured mode here, and it is major-flavoured
 * without a leading tone, which is exactly why it is the one used.
 *
 * A theme's accent scale must be a subset of its own mode. Pairing the major
 * pentatonic with Dorian puts a major third against the pad's minor third,
 * which is sour — the logic tests assert the subset relation for that reason.
 */
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
/** The safe subsets: no semitone anywhere, so random order cannot go wrong. */
const PENT_MINOR = [0, 3, 5, 7, 10];
const PENT_MAJOR = [0, 2, 4, 7, 9];

interface Theme {
  id: ThemeId;
  label: string;
  note: string;
  /** Aggregated under the pad, at reduced gain. */
  textures: Array<[SynthKind, number]>;
  /** Pad fundamental, Hz. */
  root: number;
  mode: number[];
  scale: number[];
  accent: 'pluck' | 'bell' | 'none';
  /** Multiplier on how often an accent lands. */
  accentRate: number;
}

export const THEMES: Theme[] = [
  {
    id: 'rainfall',
    label: 'Averse',
    note: 'Rain, low wind, soft accents',
    textures: [
      ['rain', 0.5],
      ['wind', 0.18],
    ],
    root: 110,
    mode: AEOLIAN,
    scale: PENT_MINOR,
    accent: 'pluck',
    accentRate: 1,
  },
  {
    id: 'shore',
    label: 'Rivage',
    note: 'Swell and open air',
    textures: [
      ['waves', 0.55],
      ['wind', 0.2],
    ],
    root: 98,
    mode: MIXOLYDIAN,
    scale: PENT_MAJOR,
    accent: 'bell',
    accentRate: 0.8,
  },
  {
    id: 'hearth',
    label: 'Âtre',
    note: 'Fire, close and warm',
    textures: [['fire', 0.45]],
    root: 87.31,
    mode: AEOLIAN,
    scale: PENT_MINOR,
    accent: 'bell',
    accentRate: 0.5,
  },
  {
    id: 'cloister',
    label: 'Cloître',
    note: 'Bourdon, dorian, a distant bell',
    textures: [],
    root: 73.42,
    mode: DORIAN,
    scale: PENT_MINOR,
    accent: 'bell',
    accentRate: 0.7,
  },
];

export const THEME_BY_ID: Record<string, Theme> = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
);

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && v in THEME_BY_ID;
}

const semitone = (root: number, steps: number) => root * Math.pow(2, steps / 12);

let sink: Sink = emptySink();
let theme: Theme | null = null;
let master: GainNode | null = null;
let padFilter: BiquadFilterNode | null = null;
let accentGain: GainNode | null = null;
let unsubscribe: (() => void) | null = null;
let level = 0.28;
let closing = false;

/** Long attack, long release. Everything audible in this file goes through here. */
function voice(
  ac: AudioContext,
  out: AudioNode,
  hz: number,
  peak: number,
  attack: number,
  release: number,
  type: OscillatorType = 'sine',
) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = hz;
  const env = ac.createGain();
  const now = ac.currentTime;
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(peak, now + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
  osc.connect(env).connect(out);
  osc.start();
  osc.stop(now + attack + release + 0.2);
}

/** Root, fifth, octave. Sustained, detuned slightly so it is not a test tone. */
function pad(ac: AudioContext, t: Theme, out: AudioNode) {
  for (const [steps, gain] of [
    [0, 0.5],
    [7, 0.3],
    [12, 0.16],
  ] as const) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = semitone(t.root, steps);
    drift(ac, sink, osc.detune, 0, 5, 0.03 + Math.random() * 0.03);
    const g = ac.createGain();
    g.gain.value = gain;
    osc.connect(g).connect(out);
    osc.start();
    sink.nodes.push(osc);
  }

  // A third voice moving through the mode, very slowly, so the harmony is not
  // completely static over a 45-minute session.
  const wander = ac.createOscillator();
  wander.type = 'sine';
  const wanderGain = ac.createGain();
  wanderGain.gain.value = 0.1;
  wander.frequency.value = semitone(t.root, (t.mode[2] ?? 3) + 12);
  drift(ac, sink, wander.detune, 0, 14, 0.012);
  wander.connect(wanderGain).connect(out);
  wander.start();
  sink.nodes.push(wander);
}

function accent(ac: AudioContext, t: Theme, out: AudioNode) {
  const degree = t.scale[Math.floor(Math.random() * t.scale.length)] ?? 0;
  // Two or three octaves above the pad: the accent should sit clear of the
  // fundamental rather than muddy it.
  const octave = 24 + 12 * Math.floor(Math.random() * 2);
  const hz = semitone(t.root, degree + octave);

  if (t.accent === 'bell') {
    voice(ac, out, hz, 0.16, 0.02, 5.5);
    // A fifth above, quieter and later — a bell is never one frequency.
    window.setTimeout(() => {
      const ctx2 = context();
      if (ctx2 && !closing) voice(ctx2, out, semitone(hz, 7), 0.05, 0.02, 3.5);
    }, 90);
    return;
  }
  // Pluck: still a 0.3s attack. "Pluck" here means shape, not a transient.
  voice(ac, out, hz, 0.13, 0.35, 4.5, 'triangle');
}

/** Interval to the next accent. Irregular on purpose; a grid reads as a machine. */
function nextGap(t: Theme, presence: number): number {
  const base = 8000 + Math.random() * 16000;
  return base / Math.max(0.35, presence * t.accentRate);
}

function scheduleAccents(ac: AudioContext, t: Theme, out: AudioNode) {
  let due = Date.now() + nextGap(t, currentShape().presence);

  const fire = () => {
    const late = Date.now() - due;
    // A backgrounded tab throttles setTimeout, so on waking, a naive scheduler
    // would fire every accent it owes at once. Overshooting badly means the
    // phone was asleep: skip that accent rather than emit a burst.
    if (late < 4000 && !closing) accent(ac, t, out);
    due = Date.now() + nextGap(t, currentShape().presence);
    sink.timers.push(window.setTimeout(fire, due - Date.now()));
  };

  sink.timers.push(window.setTimeout(fire, due - Date.now()));
}

export function startTheme(id: ThemeId, atLevel = 0.28) {
  const t = THEME_BY_ID[id];
  const ac = context();
  if (!t || !ac) return;

  stopTheme();
  theme = t;
  level = atLevel;
  closing = false;

  try {
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, ac.currentTime);
    out.connect(ac.destination);
    master = out;

    // Textures bypass the pad filter: filtering rain along with the harmony
    // makes the whole thing sound muffled rather than distant.
    for (const [kind, gain] of t.textures) {
      const g = ac.createGain();
      g.gain.value = gain;
      g.connect(out);
      sink.nodes.push(g);
      texture(ac, kind, g, sink);
    }

    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.connect(out);
    padFilter = filter;
    pad(ac, t, filter);

    const accents = ac.createGain();
    accents.connect(out);
    accentGain = accents;
    scheduleAccents(ac, t, accents);

    // The arc drives distance and level; the fade-in below is separate, so
    // starting mid-session opens at the right point rather than climbing.
    unsubscribe = subscribe((s) => {
      const now = ac.currentTime;
      try {
        padFilter?.frequency.setTargetAtTime(s.brightness, now, 3);
        accentGain?.gain.setTargetAtTime(0.35 + 0.65 * s.presence, now, 3);
        if (!closing) master?.gain.setTargetAtTime(level * (0.55 + 0.45 * s.presence), now, 3);
      } catch {
        /* the graph is being torn down */
      }
    });

    out.gain.linearRampToValueAtTime(level * 0.7, ac.currentTime + 3);
  } catch {
    stopTheme();
  }
}

/**
 * The session is over. Stop adding material and land on the tonic, so finishing
 * sounds like an ending rather than someone pulling the plug.
 */
export function resolveTheme() {
  const ac = existingContext();
  if (!ac || !theme || !master || closing) return;
  closing = true;

  for (const t of sink.timers) window.clearTimeout(t);
  sink.timers = [];

  const chord = master;
  for (const [steps, gain] of [
    [12, 0.13],
    [19, 0.08],
    [24, 0.05],
  ] as const) {
    voice(ac, chord, semitone(theme.root, steps), gain, 0.6, 6);
  }
  try {
    master.gain.setTargetAtTime(level * 0.85, ac.currentTime, 1.5);
  } catch {
    /* no-op */
  }
}

/** Dip for a cue. See duck() in ambient.ts for why this exists. */
export function duckTheme(seconds = 1.2) {
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

export function stopTheme() {
  unsubscribe?.();
  unsubscribe = null;
  closing = false;
  theme = null;
  padFilter = null;
  accentGain = null;

  const dying = sink;
  sink = emptySink();
  const ac = existingContext();

  if (master && ac) {
    const g = master;
    master = null;
    try {
      const at = ac.currentTime;
      g.gain.cancelScheduledValues(at);
      g.gain.setValueAtTime(g.gain.value, at);
      g.gain.linearRampToValueAtTime(0.0001, at + 0.6);
    } catch {
      /* no-op */
    }
    // Released only after the fade: cutting the sources first is an audible click.
    window.setTimeout(() => {
      releaseSink(dying);
      try {
        g.disconnect();
      } catch {
        /* no-op */
      }
    }, 700);
    return;
  }
  master = null;
  releaseSink(dying);
}

export function playingTheme(): ThemeId | null {
  return theme?.id ?? null;
}
