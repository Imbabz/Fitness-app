import type { Block } from '../types';
import montee from '../assets/adventures/camphrier/plaque-montee.webp';
import repos from '../assets/adventures/camphrier/plaque-repos.webp';
import sommet from '../assets/adventures/camphrier/plaque-sommet.webp';
import momonga from '../assets/adventures/camphrier/momonga.webp';

/*
 * Les aventures.
 *
 * Une séance raconte une petite histoire, et elle la recommence à chaque fois.
 * Rien ne se gagne, rien ne s'accumule d'un jour à l'autre, rien ne réagit aux
 * reps ou aux charges : l'histoire avance avec l'étape où l'on est, point. C'est
 * la règle qui la garde hors de la gamification, et elle est médicale — un
 * monde qui récompense le volume pousse à s'entraîner les mauvais jours.
 *
 * Le personnage fait en écho ce que tu fais, sans jamais le montrer. La figure
 * de l'exercice reste la consigne ; lui cueille un fruit pendant les curls. Et
 * aucune image générée ne montre une position d'exercice : c'est la règle dure
 * de la skill visual-language, et c'est pour ça que le grimpeur est un animal.
 *
 * Prototype : une seule aventure, celle de la séance A.
 */
export interface Adventure {
  id: string;
  name: string;
  plates: {
    /** Pendant la montée : les passages d'un bloc à l'autre. */
    climb: string;
    /** La feuille de repos. */
    rest: string;
    /** Le sommet. */
    summit: string;
  };
  /** Le personnage découpé, qui grimpe dans la marge de chaque étape. */
  climber: string;
  /**
   * Le titre du passage, par bloc. Seul le titre change : la phrase de
   * consigne dessous reste celle du bloc, et celle du rachis est médicale.
   */
  passage: Partial<Record<Block, string>>;
  /** Une phrase par exercice — l'écho. */
  beats: Record<string, string>;
  /** L'écho du repos. */
  rest: string;
  /**
   * Les figures redessinées en personnage de l'histoire, par clé d'animation.
   * Même squelette, mêmes articulations : seul le dessin change.
   */
  figures: Record<string, string>;
}

const CAMPHRIER: Adventure = {
  id: 'camphrier',
  name: 'Le Grand Camphrier',
  plates: { climb: montee, rest: repos, summit: sommet },
  climber: momonga,
  passage: {
    warmup: 'At the foot of the camphor tree.',
    main: 'The trunk straightens.',
    spine: 'A thin branch.',
  },
  beats: {
    'a-cardio': 'The momonga trots from root to root.',
    'a-shoulder-prep': 'It airs its wings out in the breeze.',
    'a-lat-pulldown': 'It hauls itself onto the first branch.',
    'a-cable-row': 'Along a branch, one hold after another.',
    'a-pullups': 'The steep part. Bare trunk, straight up.',
    'a-hammer-wrist': 'It picks a camphor fruit.',
    'a-jefferson': 'On the thin branch it leans down, very slowly, to look at a nest.',
    'a-deadlift': 'It lifts its satchel. Only the fruit inside.',
  },
  rest: 'Legs dangling off the branch. A sip from the gourd.',
  figures: { pullup: 'momongaPullup' },
};

const BY_SESSION: Record<string, Adventure> = { A: CAMPHRIER };

export function adventureFor(sessionId: string): Adventure | undefined {
  return BY_SESSION[sessionId];
}
