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
  echo,
  emptySink,
  existingContext,
  releaseSink,
  reverb,
  texture,
  type Sink,
  type SynthKind,
} from './audio';
import { currentShape, subscribe } from './arc';
import { SCENE_BY_ID, SCENES, isSceneId } from './scenes';
import {
  MODES,
  MOTIFS,
  phrase,
  scaleTone,
  voiceLead,
  type Motif,
} from './compose';

export type ThemeId = 'rainfall' | 'shore' | 'hearth' | 'cloister';

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
  mode: readonly number[];
  /**
   * The progression, each chord a set of semitone offsets from the tonic.
   *
   * Deliberately short and deliberately unresolved — modal pairs and stepwise
   * motion, never a dominant. A cadence would keep announcing an arrival every
   * two minutes, which is the opposite of what this is for.
   */
  progression: number[][];
  /** Seconds a chord is held before the next. */
  chordSeconds: number;
  scale: number[];
  accent: 'pluck' | 'bell' | 'none';
  /** Multiplier on how often a phrase lands. */
  accentRate: number;
}

export const THEMES: Theme[] = [
  {
    id: 'rainfall',
    label: 'Averse',
    note: 'Rain, low wind, a slow four-chord turn',
    textures: [
      ['rain', 0.5],
      ['wind', 0.18],
    ],
    root: 110,
    mode: MODES.aeolian,
    // i – VI – iv – VII. The commonest resting progression in modal music, and
    // it never resolves: VII falls back to i without ever pulling there.
    progression: [
      [0, 3, 7],
      [8, 12, 15],
      [5, 8, 12],
      [10, 14, 17],
    ],
    chordSeconds: 34,
    scale: PENT_MINOR,
    accent: 'pluck',
    accentRate: 1,
  },
  {
    id: 'shore',
    label: 'Rivage',
    note: 'Swell, open air, a major turn without a leading tone',
    textures: [
      ['waves', 0.55],
      ['wind', 0.2],
    ],
    root: 98,
    mode: MODES.mixolydian,
    // I – VII – IV – I. Major-flavoured and still weightless, because the flat
    // seventh removes the only note that would demand a resolution.
    progression: [
      [0, 4, 7],
      [10, 14, 17],
      [5, 9, 12],
      [0, 4, 7],
    ],
    chordSeconds: 40,
    scale: PENT_MAJOR,
    accent: 'bell',
    accentRate: 0.85,
  },
  {
    id: 'hearth',
    label: 'Âtre',
    note: 'Fire, close and warm, two chords rocking',
    textures: [['fire', 0.45]],
    root: 87.31,
    mode: MODES.aeolian,
    // i – iv, and nothing else. Two chords is enough when they are held this
    // long; more would ask for attention the room does not want.
    progression: [
      [0, 3, 7],
      [5, 8, 12],
    ],
    chordSeconds: 48,
    scale: PENT_MINOR,
    accent: 'bell',
    accentRate: 0.55,
  },
  {
    id: 'cloister',
    label: 'Cloître',
    note: 'Bourdon, dorian, a distant bell',
    textures: [],
    root: 73.42,
    mode: MODES.dorian,
    // i – VII – i – IV. The dorian fourth is the mode's whole character, so it
    // arrives last and is what the ear remembers.
    progression: [
      [0, 3, 7],
      [10, 14, 17],
      [0, 3, 7],
      [5, 9, 12],
    ],
    chordSeconds: 44,
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
let sceneId: string | null = null;
let master: GainNode | null = null;
let padFilter: BiquadFilterNode | null = null;
let accentGain: GainNode | null = null;
let unsubscribe: (() => void) | null = null;
let level = 0.28;
let closing = false;

/**
 * One note of the pad, built to be heard rather than merely to be in tune.
 *
 * - **Unison.** Three oscillators a few cents apart. Their beating gives a
 *   synthesised note width; one oscillator is unavoidably a test tone.
 * - **A sawtooth underneath, filtered hard.** Sine waves have no harmonics at
 *   all, so a stack of them stays hollow however many you add.
 * - **Its own slow tremolo**, at a rate that lines up with nothing else.
 *
 * Returns handles so a chord change can glide this voice to a new pitch rather
 * than stopping it and starting another — which is the difference between a
 * progression and a slideshow.
 */
interface PadVoice {
  setPitch(hz: number, seconds: number): void;
}

function padVoice(ac: AudioContext, hz: number, level: number, out: AudioNode): PadVoice {
  const bus = ac.createGain();
  bus.gain.value = level;
  drift(ac, sink, bus.gain, level, level * 0.22, 0.021 + Math.random() * 0.035);
  bus.connect(out);
  sink.nodes.push(bus);

  const tuned: OscillatorNode[] = [];

  for (const cents of [-7, 0, 7]) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz;
    drift(ac, sink, osc.detune, cents, 4, 0.02 + Math.random() * 0.04);
    const g = ac.createGain();
    g.gain.value = 0.33;
    osc.connect(g).connect(bus);
    osc.start();
    sink.nodes.push(osc);
    tuned.push(osc);
  }

  const saw = ac.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.value = hz;
  drift(ac, sink, saw.detune, 0, 5, 0.017);
  const tame = ac.createBiquadFilter();
  tame.type = 'lowpass';
  tame.frequency.value = Math.min(1400, hz * 4.5);
  tame.Q.value = 0.5;
  const sawGain = ac.createGain();
  sawGain.gain.value = 0.16;
  saw.connect(tame).connect(sawGain).connect(bus);
  saw.start();
  sink.nodes.push(saw);
  tuned.push(saw);

  return {
    setPitch(next, seconds) {
      const now = ac.currentTime;
      for (const osc of tuned) {
        try {
          osc.frequency.cancelScheduledValues(now);
          osc.frequency.setValueAtTime(osc.frequency.value, now);
          // A glide, not a jump. Over several seconds this reads as one voice
          // moving rather than as a note being replaced.
          osc.frequency.linearRampToValueAtTime(next, now + seconds);
        } catch {
          /* no-op */
        }
      }
      try {
        tame.frequency.linearRampToValueAtTime(Math.min(1400, next * 4.5), now + seconds);
      } catch {
        /* no-op */
      }
    },
  };
}

/** The bass. A plain sine: harmonics down here only muddy things. */
function bass(ac: AudioContext, hz: number, out: AudioNode): PadVoice {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = hz;
  const g = ac.createGain();
  g.gain.value = 0.22;
  osc.connect(g).connect(out);
  osc.start();
  sink.nodes.push(osc);
  return {
    setPitch(next, seconds) {
      try {
        const now = ac.currentTime;
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setValueAtTime(osc.frequency.value, now);
        osc.frequency.linearRampToValueAtTime(next, now + seconds);
      } catch {
        /* no-op */
      }
    },
  };
}

/**
 * A melodic note. Long attack so it emerges rather than starts, long release so
 * it overlaps whatever comes next — which is what lets three notes sound like a
 * line instead of three notes.
 */
function sing(
  ac: AudioContext,
  out: AudioNode,
  hz: number,
  peak: number,
  seconds: number,
  kind: 'bell' | 'pluck',
) {
  const partials: Array<[number, number]> =
    kind === 'bell'
      ? [
          [1, 1],
          [2, 0.24],
          [2.76, 0.08],
        ]
      : [
          [1, 1],
          [2, 0.14],
        ];

  for (const [ratio, share] of partials) {
    const osc = ac.createOscillator();
    osc.type = kind === 'bell' ? 'sine' : 'triangle';
    osc.frequency.value = hz * ratio;
    const env = ac.createGain();
    const now = ac.currentTime;
    const attack = kind === 'bell' ? 0.06 : 0.5;
    const release = seconds + (kind === 'bell' ? 3.5 : 2.5);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * share), now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
    osc.connect(env).connect(out);
    osc.start();
    osc.stop(now + attack + release + 0.2);
  }
}

/*
 * ── The conductor ──────────────────────────────────────────────────────────
 *
 * Two clocks, deliberately unrelated. Harmony turns slowly on its own; phrases
 * arrive on theirs. Because the periods do not divide into each other, a given
 * phrase lands over a different chord each time round, and the same handful of
 * material keeps producing combinations it has not produced before. That is
 * where the sense of it going somewhere comes from, and it costs nothing.
 */
let chordIndex = 0;
let voices: PadVoice[] = [];
let bassVoice: PadVoice | null = null;
let pitches: number[] = [];
let variation = 0;
let motif: Motif = MOTIFS[0] as Motif;

/** Scale indices of the current chord, for phrases to start from. */
function chordDegrees(t: Theme): number[] {
  const chord = t.progression[chordIndex % t.progression.length] ?? [0];
  const out: number[] = [];
  for (const semi of chord) {
    // Nearest scale index to this chord tone, so a phrase starting "on the
    // chord" is expressible in the same degree terms the motif uses.
    let best = 0;
    let bestDistance = Infinity;
    for (let i = -7; i <= 14; i++) {
      const d = Math.abs(scaleTone(t.mode, i) - semi);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    out.push(best);
  }
  return out;
}

function moveHarmony(t: Theme) {
  chordIndex += 1;
  const chord = t.progression[chordIndex % t.progression.length] ?? [0, 3, 7];
  const next = voiceLead(pitches, chord);
  pitches = next;

  // A quarter of the chord's life spent moving: slow enough to be a glide
  // rather than a slide, fast enough to have arrived before the next change.
  const glide = Math.min(9, t.chordSeconds * 0.25);
  for (const [i, v] of voices.entries()) {
    const semi = next[i];
    if (semi !== undefined) v.setPitch(semitone(t.root, semi), glide);
  }
  const root = chord[0] ?? 0;
  bassVoice?.setPitch(semitone(t.root, root - 12), glide);
}

function scheduleHarmony(t: Theme) {
  const tick = () => {
    if (closing) return;
    moveHarmony(t);
    sink.timers.push(window.setTimeout(tick, t.chordSeconds * 1000));
  };
  sink.timers.push(window.setTimeout(tick, t.chordSeconds * 1000));
}

function schedulePhrases(ac: AudioContext, t: Theme, out: AudioNode) {
  if (t.accent === 'none') return;

  const next = () => {
    if (closing) return;
    const shape = currentShape();
    const p = phrase(motif, {
      chordDegrees: chordDegrees(t),
      variation,
      presence: shape.presence,
    });
    variation += 1;
    // A new motif every few phrases: enough return to feel deliberate, enough
    // change that it is not a loop.
    if (variation % 5 === 0) {
      motif = (MOTIFS[Math.floor(Math.random() * MOTIFS.length)] ?? MOTIFS[0]) as Motif;
    }

    for (const note of p.notes) {
      sink.timers.push(
        window.setTimeout(() => {
          if (closing) return;
          // Two octaves above the pad: clear of the fundamental rather than
          // muddying it.
          const hz = semitone(t.root, scaleTone(t.mode, note.degree) + 24);
          sing(ac, out, hz, 0.13 * note.level, note.seconds, t.accent === 'bell' ? 'bell' : 'pluck');
        }, note.at * 1000),
      );
    }

    const wait = (p.seconds * 1000) / Math.max(0.4, t.accentRate);
    sink.timers.push(window.setTimeout(next, wait));
  };

  sink.timers.push(window.setTimeout(next, 4000 + Math.random() * 6000));
}

/**
 * Start a place rather than a piece. Shares the sink, the master gain and the
 * arc with the composed themes, so everything above this layer is unchanged.
 */
export function startScene(id: string, atLevel = 0.3) {
  const scene = SCENE_BY_ID[id];
  const ac = context();
  if (!scene || !ac) return;

  stopTheme();
  theme = null;
  sceneId = id;
  level = atLevel;
  closing = false;

  try {
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, ac.currentTime);
    out.connect(ac.destination);
    master = out;

    scene.build(ac, sink, out);

    unsubscribe = subscribe((s) => {
      try {
        // A place has no melody to thin out, so the arc works on level and
        // nothing else. Shutting a filter over a whole environment would just
        // sound like a blanket over it.
        if (!closing) master?.gain.setTargetAtTime(level * (0.6 + 0.4 * s.presence), ac.currentTime, 4);
      } catch {
        /* being torn down */
      }
    });

    out.gain.linearRampToValueAtTime(level * 1.5, ac.currentTime + 4);
  } catch {
    stopTheme();
  }
}

export function startTheme(id: ThemeId, atLevel = 0.28) {
  const t = THEME_BY_ID[id];
  const ac = context();
  if (!t || !ac) return;

  stopTheme();
  theme = t;
  level = atLevel;
  closing = false;
  chordIndex = 0;
  variation = 0;
  motif = (MOTIFS[Math.floor(Math.random() * MOTIFS.length)] ?? MOTIFS[0]) as Motif;

  try {
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, ac.currentTime);
    out.connect(ac.destination);
    master = out;

    // Textures bypass the pad filter and the reverb: reverberating rain only
    // makes it sound like rain in a bathroom.
    for (const [kind, gain] of t.textures) {
      const g = ac.createGain();
      g.gain.value = gain;
      g.connect(out);
      sink.nodes.push(g);
      texture(ac, kind, g, sink);
    }

    const space = reverb(ac, 3.2, 2);
    const wet = ac.createGain();
    wet.gain.value = 0.34;
    if (space) {
      space.connect(wet).connect(out);
      sink.nodes.push(space, wet);
    }

    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.connect(out);
    if (space) filter.connect(space);
    padFilter = filter;

    const chord = t.progression[0] ?? [0, 3, 7];
    pitches = [...chord];
    voices = pitches.map((semi, i) =>
      padVoice(ac, semitone(t.root, semi), [0.4, 0.24, 0.13][i] ?? 0.13, filter),
    );
    bassVoice = bass(ac, semitone(t.root, (chord[0] ?? 0) - 12), out);

    const accents = ac.createGain();
    const tail = echo(ac, sink, out, 1.4 + Math.random() * 0.8, 0.34);
    if (tail) {
      accents.connect(tail);
      if (space) accents.connect(space);
    } else {
      accents.connect(out);
      if (space) accents.connect(space);
    }
    accentGain = accents;

    scheduleHarmony(t);
    schedulePhrases(ac, t, accents);

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
 * The session is over. Land on the tonic, so finishing sounds like an ending
 * rather than someone pulling the plug.
 */
export function resolveTheme() {
  const ac = existingContext();
  if (!ac || !theme || !master || closing) return;
  closing = true;

  for (const t of sink.timers) window.clearTimeout(t);
  sink.timers = [];

  // Every voice home to the tonic chord, over six seconds. This is the one
  // moment the music is allowed to resolve, and it is why it never does
  // earlier.
  const home = theme.progression[0] ?? [0, 3, 7];
  const landed = voiceLead(pitches, home);
  for (const [i, v] of voices.entries()) {
    const semi = landed[i];
    if (semi !== undefined) v.setPitch(semitone(theme.root, semi), 6);
  }
  bassVoice?.setPitch(semitone(theme.root, (home[0] ?? 0) - 12), 6);

  if (accentGain) {
    sing(ac, accentGain, semitone(theme.root, (home[0] ?? 0) + 24), 0.1, 2, 'bell');
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
  sceneId = null;
  padFilter = null;
  accentGain = null;
  voices = [];
  bassVoice = null;
  pitches = [];

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

export function playingScene(): string | null {
  return sceneId;
}

export { SCENES, isSceneId };
