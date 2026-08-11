import type { Block, Exercise, Session } from '../types';
import { EXERCISE_BY_ID } from './exercises';

/*
 * Session composition. The exercise content itself lives in exercises.ts —
 * this file only decides which movements belong to which session, and in what
 * order.
 *
 * NON-NEGOTIABLE: the spine block renders last within every gym session.
 * `orderBlocks` below enforces it structurally so a future edit to these arrays
 * cannot break it by accident. Loaded flexion on a cold spine is the specific
 * thing this programme exists to avoid.
 */

export const BLOCK_ORDER: Record<Block, number> = {
  warmup: 0,
  main: 1,
  mobility: 2,
  spine: 3, // always last — see CLAUDE.md rule 2
};

export const BLOCK_LABEL: Record<Block, string> = {
  warmup: 'Warm-up',
  main: 'Main work',
  spine: 'Spine block',
  mobility: 'Restore',
};

function pick(ids: string[]): Exercise[] {
  const found = ids.map((id) => {
    const ex = EXERCISE_BY_ID[id];
    if (!ex) throw new Error(`Unknown exercise id: ${id}`);
    return ex;
  });
  // Stable sort by block, so spine work lands last regardless of array order.
  return found
    .map((ex, i) => ({ ex, i }))
    .sort((a, b) => BLOCK_ORDER[a.ex.block] - BLOCK_ORDER[b.ex.block] || a.i - b.i)
    .map(({ ex }) => ex);
}

export const SESSIONS: Session[] = [
  {
    id: 'A',
    mode: 'day',
    title: 'Pull',
    subtitle: 'Lats, mid-back, elbows',
    durationMin: 60,
    exercises: pick([
      'a-cardio',
      'a-shoulder-prep',
      'a-lat-pulldown',
      'a-cable-row',
      'a-pullups',
      'a-hammer-wrist',
      'a-jefferson',
      'a-deadlift',
    ]),
  },
  {
    id: 'B',
    mode: 'day',
    title: 'Push',
    subtitle: 'Chest, shoulders, cuff',
    durationMin: 60,
    exercises: pick([
      'b-cardio',
      'b-band-pull-aparts',
      'b-bench',
      'b-dips',
      'b-shoulder-press',
      'b-external-rotation',
      'b-jefferson',
      'b-rdl',
    ]),
  },
  {
    id: 'C',
    mode: 'day',
    title: 'Mixed',
    subtitle: 'Grip, carries, hips',
    durationMin: 60,
    exercises: pick([
      'c-cardio',
      'c-wrist-prep',
      'c-chinups',
      'c-chest-supported-row',
      'c-farmers-carry',
      'c-pinch-block',
      'c-jefferson',
      'c-hip-thrust',
    ]),
  },
  {
    id: 'daily',
    mode: 'night',
    title: 'Restore',
    subtitle: 'McGill Big 3 · every day',
    durationMin: 13,
    exercises: pick([
      'd-cobra',
      'd-deadbug',
      'd-side-plank',
      'd-bird-dog',
      'd-wall-glides',
    ]),
  },
];

export const SESSION_BY_ID: Record<string, Session> = Object.fromEntries(
  SESSIONS.map((s) => [s.id, s]),
);

export const GYM_SESSIONS = SESSIONS.filter((s) => s.mode === 'day');
export const DAILY_SESSION = SESSION_BY_ID['daily'] as Session;

/** The A → B → C rotation, in order. */
export const ROTATION: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];

/** Distinct blocks in a session, in render order. Drives the progress arc. */
export function blocksOf(session: Session): Block[] {
  const seen: Block[] = [];
  for (const ex of session.exercises) {
    if (!seen.includes(ex.block)) seen.push(ex.block);
  }
  return seen;
}
