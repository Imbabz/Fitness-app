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
import golemMontee from '../assets/adventures/golem/plaque-montee.webp';
import golemRepos from '../assets/adventures/golem/plaque-repos.webp';
import golemSommet from '../assets/adventures/golem/plaque-sommet.webp';
import golem from '../assets/adventures/golem/golem.webp';
import grueRepos from '../assets/adventures/grue/plaque-repos.webp';
import grueSommet from '../assets/adventures/grue/plaque-sommet.webp';
import grue from '../assets/adventures/grue/grue.webp';
import kiteMontee from '../assets/adventures/cerfvolant/plaque-montee.webp';
import kiteRepos from '../assets/adventures/cerfvolant/plaque-repos.webp';
import kiteSommet from '../assets/adventures/cerfvolant/plaque-sommet.webp';
import kite from '../assets/adventures/cerfvolant/cerfvolant.webp';
import feu from '../assets/hours/el-feu.webp';
import campRepos from '../assets/adventures/bivouac/plaque-repos.webp';
import campSommet from '../assets/adventures/bivouac/plaque-sommet.webp';
import tanukiDebout from '../assets/adventures/bivouac/tanuki-debout.webp';
import tanukiAssis from '../assets/adventures/bivouac/tanuki-assis.webp';
import tente from '../assets/adventures/bivouac/tente.webp';
import bois from '../assets/adventures/bivouac/bois.webp';
import skyDusk from '../assets/hours/doree.webp';
import skyNight from '../assets/hours/nuit.webp';
import arbreNuit from '../assets/hours/el-arbre.webp';
import champis from '../assets/hours/el-champis.webp';
// Les cartes de normales : le relief de chaque image peinte, pour que la lumière
// du feu et de la lune la modèle comme un volume (voir CampSceneGL).
import arbreN from '../assets/normals/el-arbre-n.webp';
import champisN from '../assets/normals/el-champis-n.webp';
import tenteN from '../assets/normals/tente-n.webp';
import boisN from '../assets/normals/bois-n.webp';
import mIdleC from '../assets/adventures/montagnard/idle-c.webp';
import mIdleN from '../assets/adventures/montagnard/idle-n.webp';
import mWalkC from '../assets/adventures/montagnard/walk-c.webp';
import mWalkN from '../assets/adventures/montagnard/walk-n.webp';
import mHammerC from '../assets/adventures/montagnard/hammer-c.webp';
import mHammerN from '../assets/adventures/montagnard/hammer-n.webp';
import mKneelC from '../assets/adventures/montagnard/kneel_blow-c.webp';
import mKneelN from '../assets/adventures/montagnard/kneel_blow-n.webp';


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
/**
 * Une scène en profondeur, plan par plan. Les positions sont en pourcentage de
 * la scène (`x` : le centre ; `bottom` : le pied), les hauteurs en pixels, la
 * profondeur de 0 (le lointain) à 1 (devant l'objectif). `at` et `until` sont
 * des fractions de l'histoire, pour que la même histoire tienne dans une
 * routine de 4 étapes comme de 10.
 */
export interface SceneSpec {
  /** Le ciel au début, puis à la fin : il passe de l'un à l'autre. */
  skies: [string, string];
  camera: { pan: number; zoom: number };
  layers: Array<{ src: string; normal?: string; x: number; bottom: number; h: number; depth: number; flip?: boolean; sway?: boolean; dim?: number }>;
  /** Les pièces de l'histoire : chacune se construit pendant son étape, une série après l'autre. */
  pieces: Array<{ src: string; normal?: string; x: number; bottom: number; h: number; depth: number; at: number; until?: number; glow?: boolean }>;
  /** Le personnage, une pose par étape. */
  poses?: Array<{ at: number; src: string; x: number; h: number }>;
  foreground: Array<{ src: string; normal?: string; x: number; bottom: number; h: number; flip?: boolean }>;
  /**
   * Le personnage, en planches de sprites rendues depuis son modèle 3D : pour
   * chaque geste, une planche de couleur et une de normales. `plan` donne le
   * geste de chaque moment de l'histoire, réparti sur les étapes de la séance.
   */
  character?: {
    actions: Record<string, { c: string; n: string }>;
    plan: string[];
    cols: number;
    rows: number;
    fps: number;
    frameAspect: number;
    x: number;
    h: number;
    depth: number;
  };
}

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
  /** Le personnage découpé, qui monte au milieu de la scène, d'étape en étape. */
  climber?: string;
  /** Sa hauteur dans la scène, en pixels. */
  climberHeight?: number;
  /**
   * L'autre façon d'avancer : au lieu de monter, la scène se construit. Chaque
   * pièce apparaît à partir d'un point de la séance (`from`, de 0 à 1) et peut
   * disparaître plus loin (`until`) — le voyageur debout laisse la place au
   * voyageur assis quand le feu prend.
   */
  build?: Array<{
    src: string;
    /** Le centre de la pièce, en pourcentage de la largeur de la scène. */
    x: number;
    /** Sa hauteur dans la scène, en pixels. */
    h: number;
    from: number;
    until?: number;
    glow?: boolean;
  }>;
  /**
   * Ce sur quoi il monte : une bande d'écorce prise dans l'illustration, ou
   * un fil pour le cerf-volant. Les autres s'élèvent dans le ciel de la
   * plaque — en grand, une bande de nuages ou de marches faisait une colonne.
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
  /** La scène en profondeur, quand l'histoire en a une. Elle remplace le grimpeur et les pièces. */
  scene?: SceneSpec;
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
  climberHeight: 132,
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
  climberHeight: 120,
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
  climberHeight: 118,
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
  climberHeight: 92,
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
  climberHeight: 136,
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

/*
 * Le bivouac.
 *
 * L'autre histoire du soir, qui alterne avec la grue : un voyageur arrive dans
 * une clairière, monte sa tente, allume un feu et s'assoit. Ici on ne monte
 * pas, on construit — chaque étape ajoute quelque chose au camp, et la
 * dernière allume le feu. Le jour où la séance se termine, le camp est fait.
 *
 * Les images du voyageur (un tanuki), de la tente et du bois arrivent avec la
 * prochaine recharge de génération ; en attendant, seul le feu, qui existait
 * déjà, est en place.
 */
const CAMP: Adventure = {
  id: 'bivouac',
  name: 'The Camp',
  plates: { rest: campRepos, summit: campSommet },
  // Le camp se monte au sol de la scène, une pièce après l'autre, avec
  // l'étape et jamais avec les reps. Le coin haut droit reste libre : c'est
  // celui de la vignette du mouvement.
  build: [
    { src: tente, x: 27, h: 118, from: 0.3 },
    { src: tanukiDebout, x: 56, h: 100, from: 0, until: 0.84 },
    { src: tanukiAssis, x: 56, h: 90, from: 0.84 },
    { src: bois, x: 81, h: 56, from: 0.6, until: 0.84 },
    { src: feu, x: 81, h: 108, from: 0.84, glow: true },
  ],
  passage: {
    mobility: 'A clearing at dusk.',
    spine: 'A small flame.',
  },
  beats: {
    'd-cat-cow': 'The tanuki unrolls the canvas and shakes it out.',
    'd-cobra': 'It lifts the ridge pole, and the tent rises.',
    'd-deadbug': 'One peg, then the opposite one.',
    'd-side-plank': 'A guy line pulled taut on one side, then the other.',
    'd-bird-dog': 'It reaches far for dry twigs, keeping its balance.',
    'd-wall-glides': 'It stacks the wood, slowly, a little higher.',
    'd-jefferson': 'It bends down, very slowly, and blows on the first flame.',
  },
  rest: 'It sits back on its heels and watches the light go.',
  figures: {},
  // Images provisoires, prises dans l'univers de l'app : le montagnard et ses
  // pièces peintes les remplaceront. Ce qui compte ici, c'est la mécanique —
  // la profondeur, la caméra, la lumière, la construction série par série.
  scene: {
    skies: [skyDusk, skyNight],
    camera: { pan: 28, zoom: 0.16 },
    layers: [
      { src: arbreNuit, normal: arbreN, x: 14, bottom: 24, h: 118, depth: 0.3, dim: 0.6, sway: true },
      { src: arbreNuit, normal: arbreN, x: 80, bottom: 23, h: 96, depth: 0.3, dim: 0.55, flip: true },
      { src: arbreNuit, normal: arbreN, x: 2, bottom: 9, h: 210, depth: 0.55, sway: true },
      { src: arbreNuit, normal: arbreN, x: 96, bottom: 10, h: 180, depth: 0.55, flip: true, sway: true },
    ],
    pieces: [
      { src: tente, normal: tenteN, x: 34, bottom: 12, h: 108, depth: 0.75, at: 1 / 6 },
      { src: bois, normal: boisN, x: 70, bottom: 10, h: 46, depth: 0.78, at: 4 / 6, until: 1 },
      { src: bois, normal: boisN, x: 60, bottom: 11, h: 38, depth: 0.78, at: 5 / 6, until: 1 },
      { src: feu, x: 66, bottom: 8, h: 96, depth: 0.8, at: 1, glow: true },
    ],
    poses: [],
    // Le montagnard, version de travail : un modèle 3D stylisé, rendu en
    // sprites. Il arrive, regarde la tente se dresser, plante les piquets,
    // se pose, puis s'agenouille et souffle sur le feu.
    character: {
      actions: {
        walk: { c: mWalkC, n: mWalkN },
        idle: { c: mIdleC, n: mIdleN },
        hammer: { c: mHammerC, n: mHammerN },
        kneel: { c: mKneelC, n: mKneelN },
      },
      plan: ['walk', 'idle', 'hammer', 'hammer', 'idle', 'kneel', 'kneel'],
      cols: 4,
      rows: 3,
      fps: 10,
      frameAspect: 151 / 311,
      x: 50,
      h: 120,
      depth: 0.77,
    },
    foreground: [
      { src: champis, normal: champisN, x: 6, bottom: -6, h: 84 },
      { src: champis, normal: champisN, x: 97, bottom: -8, h: 66, flip: true },
    ],
  },
};

const BY_SESSION: Record<string, Adventure> = { A: CAMPHRIER, B: YAK, C: GOLEM, daily: GRUE };

/**
 * Les deux histoires du soir alternent, un soir sur deux. Le soir est celui où
 * la séance a commencé, pas l'heure qu'il est : une routine lancée à 23 h 55
 * ne doit pas changer d'histoire à minuit au milieu d'un exercice.
 */
/**
 * Pendant la mise au point du camp, il passe tous les soirs : c'est l'histoire
 * qu'on finalise, et on la valide en la vivant. À `false`, la grue revient un
 * soir sur deux.
 */
const CAMP_EVERY_EVENING = true;

function eveningIndex(date: Date): number {
  const days = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  return days % 2;
}

export function adventureFor(sessionId: string, startedAt: Date = new Date()): Adventure | undefined {
  if (sessionId === 'daily') {
    return CAMP_EVERY_EVENING || eveningIndex(startedAt) === 1 ? CAMP : GRUE;
  }
  // Les circuits — composés (`w-…`) ou préréglés (`preset-…`) — prennent
  // tous le cerf-volant, qui fait des tours dans le vent comme eux.
  if (sessionId.startsWith('w-') || sessionId.startsWith('preset-')) return KITE;
  return BY_SESSION[sessionId];
}

/** L'écho d'un exercice : le sien, sinon celui de son bloc. */
export function beatFor(adventure: Adventure, exerciseId: string, block: Block): string | undefined {
  return adventure.beats[exerciseId] ?? adventure.blockBeats?.[block];
}
