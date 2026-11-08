import type { Block } from '../types';
import aube from '../assets/hours/aube.webp';
import plein from '../assets/hours/plein.webp';
import doree from '../assets/hours/doree.webp';
import elArbre from '../assets/hours/el-arbre.webp';
import elChampis from '../assets/hours/el-champis.webp';
import elFeu from '../assets/hours/el-feu.webp';

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
  /**
   * One thing standing at the bottom of the screen, on one side.
   *
   * Decoration and nothing else: it carries no information, it is never
   * tappable, and the block's copy says everything the screen has to say
   * without it. `sway`, `drift` and `flicker` are the three motions it can
   * have, each slow enough to be noticed only if you look for it.
   */
  element?: { src: string; side: 'left' | 'right'; motion: 'sway' | 'drift' | 'flicker'; h: number };
}

export const HOURS: Partial<Record<Block, Hour>> = {
  warmup: {
    src: aube, tint: '212 228 228', label: 'Première heure',
    element: { src: elArbre, side: 'left', motion: 'sway', h: 152 },
  },
  main: {
    src: plein, tint: '208 230 240', label: 'Plein jour',
    element: { src: elChampis, side: 'right', motion: 'drift', h: 86 },
  },
  spine: {
    src: doree, tint: '240 221 199', label: 'Heure dorée',
    // Le feu à l'heure dorée : c'est le seul bloc où l'on ralentit, et la
    // seule lumière chaude de la séance.
    element: { src: elFeu, side: 'right', motion: 'flicker', h: 104 },
  },
};

export function hourOf(block: Block): Hour | undefined {
  return HOURS[block];
}
