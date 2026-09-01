/*
 * The musical decisions, kept apart from the sound-making.
 *
 * Thickening the timbre did not fix the soundtracks, because the fault was
 * never timbre. There was no music: one chord held for forty-five minutes, and
 * notes chosen at random from a scale. A random walk over safe intervals is
 * inoffensive and completely inert — nothing arrives, nothing answers anything,
 * and after two minutes you have heard everything it will ever do.
 *
 * Four things separate ambient music from a drone with sprinkles, and all four
 * live here rather than in the audio graph, so they can be tested without ears:
 *
 *   1. Harmony that moves. A progression, changing slowly.
 *   2. Voice leading. When the chord changes, each voice steps to the nearest
 *      tone of the next one instead of jumping. This is the single thing that
 *      makes a change sound like music rather than a cut.
 *   3. Motifs, not randomness. A short shape stated and then varied —
 *      transposed, inverted, stretched. Recognisable return is what makes a
 *      listener feel something was composed.
 *   4. Rests. Ambient breathes; the silence between phrases is load-bearing,
 *      and continuous noodling is the most common way to ruin it.
 *
 * Nothing here touches Web Audio. It emits note events; soundtrack.ts plays
 * them.
 */

/** Semitone offsets from the tonic. No mode here contains a leading tone. */
export const MODES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
} as const;

export type ModeName = keyof typeof MODES;

/**
 * A degree of the mode, allowed to run past an octave in either direction.
 * Index 7 is the tonic an octave up, -1 the seventh below.
 */
export function scaleTone(mode: readonly number[], index: number): number {
  const n = mode.length;
  const octave = Math.floor(index / n);
  const step = ((index % n) + n) % n;
  return (mode[step] ?? 0) + octave * 12;
}

/**
 * Move each voice to the nearest tone of the next chord.
 *
 * The nearest one in any octave, not the nearest written note — which is what
 * lets a voice stay put when it is already a member of the new chord, and is
 * why a progression glides rather than lurching. Voices that would land on the
 * same pitch are pushed to their next-best option, since a chord voiced as a
 * unison is a chord that vanished.
 */
export function voiceLead(current: readonly number[], chord: readonly number[]): number[] {
  const taken = new Set<number>();
  return current.map((voice) => {
    const options: Array<{ pitch: number; distance: number }> = [];
    for (const tone of chord) {
      for (let octave = -24; octave <= 24; octave += 12) {
        const pitch = tone + octave;
        options.push({ pitch, distance: Math.abs(pitch - voice) });
      }
    }
    options.sort((a, b) => a.distance - b.distance);
    const free = options.find((o) => !taken.has(o.pitch)) ?? options[0];
    const pitch = free?.pitch ?? voice;
    taken.add(pitch);
    return pitch;
  });
}

/** A short shape, in scale steps relative to where the phrase starts. */
export type Motif = readonly number[];

export const MOTIFS: Motif[] = [
  [0, 2, 1],
  [0, 1, 3, 2],
  [0, -1, 2],
  [0, 3, 2, 4],
  [0, 2, -1, 1],
];

export interface Note {
  /** Scale-degree index, to be turned into a pitch by the caller. */
  degree: number;
  /** Seconds from the start of the phrase. */
  at: number;
  seconds: number;
  /** 0-1, before the arc's own shaping. */
  level: number;
}

export interface Phrase {
  notes: Note[];
  /** Total length including the silence that follows it. */
  seconds: number;
}

/**
 * One phrase: a variation on the motif, then a rest.
 *
 * `variation` selects the transformation, so successive phrases are related
 * rather than independent — the same shape coming back a third higher, or
 * upside down, is the whole reason this sounds intentional.
 */
export function phrase(
  motif: Motif,
  options: {
    /** Degrees of the current chord, as scale indices. Phrases start here. */
    chordDegrees: readonly number[];
    variation: number;
    /** 0-1 from the session arc. Raises note count and shortens rests. */
    presence: number;
    random?: () => number;
  },
): Phrase {
  const rand = options.random ?? Math.random;
  const { chordDegrees, variation, presence } = options;

  // Start on a chord tone: the phrase then belongs to the harmony under it
  // rather than merely avoiding a clash with it.
  const root = chordDegrees[Math.floor(rand() * chordDegrees.length)] ?? 0;

  let shape = [...motif];
  switch (variation % 4) {
    case 1:
      // Inversion. The same contour upside down — recognisably the same idea.
      shape = shape.map((s) => -s);
      break;
    case 2:
      // Transposed up a third within the mode.
      shape = shape.map((s) => s + 2);
      break;
    case 3:
      // Retrograde, and shortened: an answer rather than a restatement.
      shape = [...shape].reverse().slice(0, Math.max(2, shape.length - 1));
      break;
    default:
      break;
  }

  // Sparse at the edges of a session, fuller through the middle.
  const wanted = Math.max(2, Math.round(shape.length * (0.6 + 0.4 * presence)));
  shape = shape.slice(0, wanted);

  const notes: Note[] = [];
  let at = 0;
  for (const [i, step] of shape.entries()) {
    const seconds = 1.8 + rand() * 1.6;
    notes.push({
      degree: root + step,
      at,
      seconds,
      // The first note of a phrase carries; the rest sit under it.
      level: i === 0 ? 1 : 0.62 + rand() * 0.2,
    });
    at += seconds * (0.55 + rand() * 0.35);
  }

  // The rest is not padding. Without it this is continuous noodling, which is
  // the most reliable way to make ambient music tiring.
  const rest = (7 + rand() * 12) * (1.35 - 0.5 * presence);
  return { notes, seconds: at + rest };
}
