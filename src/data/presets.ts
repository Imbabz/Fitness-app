import type { Workout } from '../types';

/*
 * Ready-made circuits.
 *
 * Each one alternates movement patterns rather than stacking them: three
 * presses in a row is a shoulder session, not a circuit, and the point of
 * alternating is that the station you are on rests the one you just did. The
 * `pattern` field on each exercise is what makes that checkable, and a test
 * asserts no preset repeats a pattern back to back.
 *
 * They are built-in and not stored in state, so they cannot be edited or
 * deleted — duplicating one into a workout of your own is the way to change it.
 * The warm-up is not listed because `workoutSession()` prepends it to every
 * circuit; see the note in circuit.ts.
 */
export const PRESETS: Workout[] = [
  {
    id: 'preset-floor',
    name: 'Floor only',
    note: 'Nothing but a mat',
    builtIn: true,
    exerciseIds: ['x-squat', 'x-pushup', 'x-glute-bridge', 'x-plank', 'x-reverse-lunge'],
    config: { format: 'intervals', level: 'beginner', rounds: 4 },
  },
  {
    id: 'preset-bands',
    name: 'Band work',
    note: 'A door anchor and one band',
    builtIn: true,
    exerciseIds: ['x-band-row', 'x-split-squat', 'x-band-pulldown', 'x-band-rdl', 'x-pallof'],
    config: { format: 'intervals', level: 'intermediate', rounds: 4 },
  },
  {
    id: 'preset-bars',
    name: 'Bars and bodyweight',
    note: 'Dip bars, upper body led',
    builtIn: true,
    exerciseIds: ['x-dips', 'x-reverse-lunge', 'x-inverted-row', 'x-bear-hold', 'x-pike-pushup'],
    config: { format: 'intervals', level: 'intermediate', rounds: 5 },
  },
  {
    id: 'preset-tabata',
    name: 'Short and sharp',
    note: 'Tabata, four minutes of work',
    builtIn: true,
    exerciseIds: ['x-squat', 'x-pushup', 'x-march', 'x-band-row'],
    config: { format: 'tabata', level: 'intermediate', rounds: 8 },
  },
  {
    id: 'preset-climber',
    name: 'Climber maintenance',
    note: 'Pulling, shoulders, hips',
    builtIn: true,
    exerciseIds: [
      'x-inverted-row',
      'x-single-leg-bridge',
      'x-band-face-pull',
      'x-step-up',
      'x-support-hold',
      'x-monster-walk',
    ],
    config: { format: 'sequential', level: 'intermediate', rounds: 3 },
  },
  {
    id: 'preset-gentle',
    name: 'Gentle day',
    note: 'Low load, nothing on the clock',
    builtIn: true,
    exerciseIds: ['x-glute-bridge', 'x-band-pull-apart', 'x-wall-sit', 'x-bear-hold', 'x-calf-raise'],
    config: { format: 'sequential', level: 'beginner', rounds: 3 },
  },
];

export const PRESET_BY_ID: Record<string, Workout> = Object.fromEntries(
  PRESETS.map((w) => [w.id, w]),
);
