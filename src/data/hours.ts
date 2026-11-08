import type { Block } from '../types';
import aube from '../assets/hours/aube.webp';
import plein from '../assets/hours/plein.webp';
import doree from '../assets/hours/doree.webp';

/*
 * Les heures.
 *
 * One place, seen at a different hour per block. The identity comes from the
 * repetition, not from four different subjects — and it rides the day/night
 * cycle the app already has rather than inventing a second system.
 *
 * The plates are generated once and committed, never fetched: Vite emits them
 * under assets/ with a content hash, which the service worker already
 * precaches, so they work offline exactly like the rest. See CLAUDE.md rule 5.
 *
 * They were harmonised before being committed, and that step is the point:
 * the three came out of the model at 40, 70 and 42 percent saturation — one
 * of them visibly louder than the others — and were pulled to a common 30.
 * A series is made by the treatment, not by the prompt.
 *
 * `mobility` has no plate yet. The night routine needs its own hour and the
 * dawn one would be wrong there, so it shows nothing rather than something
 * borrowed.
 */
export interface Hour {
  /** The plate. Fades into the page; it never carries information. */
  src: string;
  /** What the page takes from it, as an RGB triple. */
  tint: string;
  label: string;
}

export const HOURS: Partial<Record<Block, Hour>> = {
  warmup: { src: aube, tint: '212 228 228', label: 'Première heure' },
  main: { src: plein, tint: '208 230 240', label: 'Plein jour' },
  spine: { src: doree, tint: '240 221 199', label: 'Heure dorée' },
};

export function hourOf(block: Block): Hour | undefined {
  return HOURS[block];
}
