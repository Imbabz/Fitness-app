import type { Block } from '../types';
import aube from '../assets/hours/aube.webp';
import plein from '../assets/hours/plein.webp';
import doree from '../assets/hours/doree.webp';
import nuit from '../assets/hours/nuit.webp';
import elArbre from '../assets/hours/el-arbre.webp';
import elArbreNuit from '../assets/hours/el-arbre-nuit.webp';
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
 * The four plates are one painting at four hours. The night one is the midday
 * sky re-lit — same cloud, same grain, same horizon — rather than a fresh
 * generation, because a second generation would have been a second place. Here
 * the identity IS the repetition, and the only honest way to show the same sky
 * after dark is to take the light off it.
 *
 * They are skies and nothing else. The first generation gave each plate a
 * ground as well, and that ground was a flat grey band of pure noise that the
 * fade could only ever reveal — a hard edge halfway down the screen. Cropping
 * at the horizon took the dead half out and left the half that was good. It
 * also says the thing the app wants to say: aérien.
 */
export interface Element {
  src: string;
  side: 'left' | 'right';
  motion: 'sway' | 'drift' | 'flicker';
  h: number;
  /**
   * Au loin.
   *
   * Même image, plus petite, plus pâle, très légèrement floue : c'est de la
   * perspective atmosphérique, et c'est ce qui fait une scène plutôt qu'un
   * objet posé dans un coin. Aucun fichier de plus — le lieu est le même, on
   * en voit juste un bout plus loin.
   */
  far?: true;
}

export interface Hour {
  /** The plate. Fades into the page; it never carries information. */
  src: string;
  /** What the page takes from it, as an RGB triple. */
  tint: string;
  /** The hour's own name, shown small in the sky. One place, four hours. */
  label: string;
  /**
   * What stands at the bottom of the screen. One object, or two when the hour
   * needs a scene rather than a token — the night has a tree and a fire under
   * it, which is a camp, where either one alone is just an object.
   *
   * Decoration and nothing else: it carries no information, it is never
   * tappable, and the block's copy says everything the screen has to say
   * without it. `sway`, `drift` and `flicker` are the three motions it can
   * have, each slow enough to be noticed only if you look for it.
   */
  elements: Element[];
}

export const HOURS: Partial<Record<Block, Hour>> = {
  warmup: {
    src: aube, tint: '212 228 228', label: 'First light',
    elements: [
      { src: elArbre, side: 'left', motion: 'sway', h: 152 },
      { src: elArbre, side: 'right', motion: 'sway', h: 86, far: true },
    ],
  },
  main: {
    src: plein, tint: '208 230 240', label: 'Full day',
    elements: [
      { src: elArbre, side: 'left', motion: 'sway', h: 78, far: true },
      { src: elChampis, side: 'right', motion: 'drift', h: 86 },
    ],
  },
  mobility: {
    src: nuit, tint: '120 140 186', label: 'Night',
    // Un camp : l'arbre sous la lune, le feu dessous. L'arbre est le même
    // qu'à la première heure, la lumière du jour retirée — la nuit n'est pas
    // un autre lieu, c'est le même à une autre heure, et un pin qui a changé
    // d'espèce entre l'aube et le soir dirait le contraire.
    elements: [
      { src: elArbreNuit, side: 'left', motion: 'sway', h: 150 },
      // Le lointain reste à gauche : à droite il tomberait dans le feu, et
      // deux objets au même endroit ne font pas une profondeur.
      { src: elArbreNuit, side: 'left', motion: 'sway', h: 74, far: true },
      { src: elFeu, side: 'right', motion: 'flicker', h: 84 },
    ],
  },
  spine: {
    src: doree, tint: '240 221 199', label: 'Golden hour',
    // Le feu à l'heure dorée : c'est le seul bloc où l'on ralentit, et la
    // seule lumière chaude de la séance.
    elements: [
      { src: elArbre, side: 'left', motion: 'sway', h: 92, far: true },
      { src: elFeu, side: 'right', motion: 'flicker', h: 104 },
    ],
  },
};

export function hourOf(block: Block): Hour | undefined {
  return HOURS[block];
}

/**
 * L'heure qu'il est vraiment.
 *
 * Hors séance, l'app n'a pas de bloc courant — elle a une horloge. Les quatre
 * plaques sont le même lieu à quatre moments, donc le même barème sert : la
 * maison montre le ciel qu'il fait dehors. C'est le cycle jour/nuit de l'app,
 * rendu littéral.
 */
export function hourNow(mode: 'day' | 'night', date = new Date()): Hour {
  // Le mode l'emporte sur l'horloge. L'utilisateur qui bascule en jour demande
  // qu'il fasse jour : lui laisser un ciel de nuit derrière un thème clair
  // donne un lavis gris qui n'est ni l'un ni l'autre.
  if (mode === 'night') return HOURS.mobility!;
  const h = date.getHours();
  if (h < 10) return HOURS.warmup!;
  if (h < 17) return HOURS.main!;
  return HOURS.spine!;
}
