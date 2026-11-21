import type { Block } from '../types';
import montee from '../assets/adventures/camphrier/plaque-montee.webp';
import repos from '../assets/adventures/camphrier/plaque-repos.webp';
import sommet from '../assets/adventures/camphrier/plaque-sommet.webp';
import momonga from '../assets/adventures/camphrier/momonga.webp';
import ecorce from '../assets/adventures/camphrier/ecorce.webp';
import yakMontee from '../assets/adventures/yak/plaque-montee.webp';
import yakRepos from '../assets/adventures/yak/plaque-repos.webp';
import yakSommet from '../assets/adventures/yak/plaque-sommet.webp';
import yak from '../assets/adventures/yak/yak.webp';
import nuages from '../assets/adventures/yak/nuages.webp';
import golemMontee from '../assets/adventures/golem/plaque-montee.webp';
import golemRepos from '../assets/adventures/golem/plaque-repos.webp';
import golemSommet from '../assets/adventures/golem/plaque-sommet.webp';
import golem from '../assets/adventures/golem/golem.webp';
import marches from '../assets/adventures/golem/marches.webp';
import grueRepos from '../assets/adventures/grue/plaque-repos.webp';
import grueSommet from '../assets/adventures/grue/plaque-sommet.webp';
import grue from '../assets/adventures/grue/grue.webp';
import kiteMontee from '../assets/adventures/cerfvolant/plaque-montee.webp';
import kiteRepos from '../assets/adventures/cerfvolant/plaque-repos.webp';
import kiteSommet from '../assets/adventures/cerfvolant/plaque-sommet.webp';
import kite from '../assets/adventures/cerfvolant/cerfvolant.webp';


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
 * Une aventure par séance, et les séances alternent : A le camphrier, B le yak
 * des nuées, C le golem de mousse, le soir la grue de papier, les circuits le
 * cerf-volant.
 */
export interface Adventure {
  id: string;
  name: string;
  plates: {
    /**
     * Pendant la montée : les passages d'un bloc à l'autre. Absente, le
     * passage garde la plaque de l'heure — c'est le cas du soir, où la vraie
     * lune de la nuit vaut mieux qu'une lune peinte.
     */
    climb?: string;
    /** La feuille de repos. */
    rest: string;
    /** Le sommet. */
    summit: string;
  };
  /** Le personnage découpé, qui grimpe dans la marge de chaque étape. */
  climber: string;
  /** Sa taille dans la marge, en pixels. */
  climberHeight: number;
  /**
   * Ce sur quoi il monte : une bande prise dans l'illustration elle-même, ou
   * un fil pour le cerf-volant. Rien pour la grue, qui monte dans le ciel.
   */
  surface?: string | 'string';
  /**
   * Le titre du passage, par bloc. Seul le titre change : la phrase de
   * consigne dessous reste celle du bloc, et celle du rachis est médicale.
   */
  passage: Partial<Record<Block, string>>;
  /** Une phrase par exercice — l'écho. */
  beats: Record<string, string>;
  /**
   * L'écho par bloc, quand l'exercice n'a pas le sien. Les circuits sont
   * composés à la main : on ne connaît pas leurs exercices d'avance.
   */
  blockBeats?: Partial<Record<Block, string>>;
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
  climberHeight: 76,
  surface: ecorce,
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


const YAK: Adventure = {
  id: 'yak',
  name: 'The Cloud Yak',
  plates: { climb: yakMontee, rest: yakRepos, summit: yakSommet },
  climber: yak,
  climberHeight: 70,
  surface: nuages,
  passage: {
    warmup: 'On the low island.',
    main: 'Into the open sky.',
    spine: 'Low and slow.',
  },
  beats: {
    'b-cardio': 'The yak grazes at the edge of the low island.',
    'b-band-pull-aparts': 'It shakes the dew out of its wool.',
    'b-bench': 'A first short flight, low over the clouds.',
    'b-dips': 'It drops into a gust, and rises out of it.',
    'b-shoulder-press': 'Up through the cloud ceiling.',
    'b-external-rotation': 'It turns its head to watch a lark go by.',
    'b-jefferson': 'It flies low and slowly, as if carrying something fragile.',
    'b-rdl': 'It sets down on the high island, one hoof at a time.',
  },
  rest: 'It lands and grazes. It will be standing again before the time is out.',
  figures: {},
};

const GOLEM: Adventure = {
  id: 'golem',
  name: 'The Moss Golem',
  plates: { climb: golemMontee, rest: golemRepos, summit: golemSommet },
  climber: golem,
  climberHeight: 68,
  surface: marches,
  passage: {
    warmup: 'The golem wakes.',
    main: 'Up the stone steps.',
    spine: 'Balance, like the golem.',
  },
  beats: {
    'c-cardio': 'Moss slides off its shoulders as it wakes.',
    'c-wrist-prep': 'It flexes its stone fingers, one by one.',
    'c-chinups': 'It hauls itself up the first tall step.',
    'c-chest-supported-row': 'It pulls the bucket up on its rope.',
    'c-farmers-carry': 'Two buckets up the path. Steady.',
    'c-pinch-block': 'It picks up a flat stone for the cairn.',
    'c-jefferson': 'It bends very slowly to set the stone down.',
    'c-hip-thrust': 'It pushes up from the step and stands.',
  },
  rest: 'It sits on a step. A bird lands on its shoulder.',
  figures: {},
};

const GRUE: Adventure = {
  id: 'grue',
  name: 'The Paper Crane',
  plates: { rest: grueRepos, summit: grueSommet },
  climber: grue,
  climberHeight: 52,
  passage: {
    mobility: 'A square of paper by the fire.',
    spine: 'The last fold.',
  },
  beats: {
    'd-cat-cow': 'The first diagonal folds, made and unmade with your breath.',
    'd-cobra': 'The front edge lifts: the square base.',
    'd-deadbug': 'Kite folds, one side, then the other.',
    'd-side-plank': 'The petal fold, on one side, then the other.',
    'd-bird-dog': 'Two opposite points drawn out: the neck and the tail.',
    'd-wall-glides': 'The wings open, slowly, upwards.',
    'd-jefferson': 'The last fold. The head bends down, very slowly.',
  },
  rest: 'The paper waits by the fire, the last crease pressed flat.',
  figures: {},
};

const KITE: Adventure = {
  id: 'cerfvolant',
  name: 'The Kite',
  plates: { climb: kiteMontee, rest: kiteRepos, summit: kiteSommet },
  climber: kite,
  climberHeight: 78,
  surface: 'string',
  passage: {
    warmup: 'On the windy ridge.',
    main: 'The wind picks up.',
    spine: 'Hold the line.',
  },
  beats: {},
  blockBeats: {
    warmup: 'The kite lifts off the grass.',
    main: 'More string. The wind takes it higher.',
    spine: "The wind drops. Hold the line, don't pull.",
    mobility: 'It hangs still in the evening air.',
  },
  rest: 'The kite rests on the grass beside its reel.',
  figures: {},
};

const BY_SESSION: Record<string, Adventure> = { A: CAMPHRIER, B: YAK, C: GOLEM, daily: GRUE };

export function adventureFor(sessionId: string): Adventure | undefined {
  // Les circuits — composés (`w-…`) ou préréglés (`preset-…`) — prennent
  // tous le cerf-volant, qui fait des tours dans le vent comme eux.
  if (sessionId.startsWith('w-') || sessionId.startsWith('preset-')) return KITE;
  return BY_SESSION[sessionId];
}

/** L'écho d'un exercice : le sien, sinon celui de son bloc. */
export function beatFor(adventure: Adventure, exerciseId: string, block: Block): string | undefined {
  return adventure.beats[exerciseId] ?? adventure.blockBeats?.[block];
}
