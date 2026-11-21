/*
 * Le ciel réel.
 *
 * Le lieu de l'app suit le calendrier, pas le journal d'entraînement. C'est la
 * règle qui le garde hors de la gamification, et elle est médicale avant
 * d'être esthétique : un monde qui grandit avec le nombre de séances
 * récompense exactement ce qu'une protrusion L5-S1 punit — s'entraîner un jour
 * où il ne fallait pas. Ici rien ne se gagne. La lune est celle de ce soir et
 * l'arbre a la couleur de la saison, que la séance ait eu lieu ou non.
 *
 * Tout est calculé sur l'appareil. Pas de météo : elle demanderait un appel
 * réseau, et la règle 5 n'a pas d'exception.
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Saisons météorologiques de l'hémisphère nord — mars à mai, juin à août, et
 * ainsi de suite. Météorologiques plutôt qu'astronomiques parce qu'elles
 * suivent ce qu'on voit dehors : le 1er décembre il fait l'hiver, pas le 21.
 */
export function seasonOf(date: Date = new Date()): Season {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

/** Mois synodique moyen, en jours. */
const SYNODIC = 29.530588853;
/** Une nouvelle lune de référence : 6 janvier 2000, 18 h 14 UTC. */
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);

export interface Moon {
  /** Âge en jours depuis la dernière nouvelle lune, 0 à 29,5. */
  age: number;
  /** Part éclairée du disque, 0 à 1. */
  lit: number;
  /** Croissante : éclairée à droite, vue de l'hémisphère nord. */
  waxing: boolean;
}

/**
 * La phase de la lune, à quelques heures près — l'orbite n'est pas un cercle et
 * le mois synodique réel varie d'environ sept heures autour de sa moyenne. Une
 * lune dessinée à 91 % au lieu de 93 % ne se voit pas ; une lune pleine dans
 * l'app un soir où elle ne l'est pas dehors, si.
 */
export function moonOf(date: Date = new Date()): Moon {
  const days = (date.getTime() - NEW_MOON_REF) / 86_400_000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  const lit = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
  return { age, lit, waxing: age < SYNODIC / 2 };
}

/**
 * Le contour de la partie éclairée, en coordonnées SVG.
 *
 * Un demi-cercle du côté éclairé, refermé par le terminateur : une
 * demi-ellipse de même hauteur dont la largeur suit la phase — nulle au
 * premier et au dernier quartier, égale au rayon à la pleine et à la nouvelle
 * lune. Du côté sombre quand la lune est gibbeuse, du côté éclairé quand elle
 * est en croissant. Les drapeaux de balayage sont dans le repère de l'écran,
 * y vers le bas.
 */
export function moonLitPath(cx: number, cy: number, r: number, moon: Moon): string {
  const rx = r * Math.abs(2 * moon.lit - 1);
  const gibbous = moon.lit > 0.5;
  const top = `${cx} ${cy - r}`;
  const bottom = `${cx} ${cy + r}`;
  // Le limbe : à droite en croissante, à gauche en décroissante.
  const limbSweep = moon.waxing ? 1 : 0;
  // Le terminateur, du bas vers le haut. Croissante gibbeuse : il passe à
  // gauche du centre ; croissante en croissant : à droite. Décroissante :
  // l'inverse.
  const termSweep = moon.waxing === gibbous ? 1 : 0;
  return `M ${top} A ${r} ${r} 0 0 ${limbSweep} ${bottom} A ${rx} ${r} 0 0 ${termSweep} ${top} Z`;
}

/*
 * Une phrase du lieu.
 *
 * Ce que dirait quelqu'un qui habite là, en passant. Jamais une consigne —
 * les consignes ont leur place dans les cues, et elles sont médicales — et
 * jamais un mot sur toi ou sur tes séances. Le lieu ne te regarde pas
 * t'entraîner, il fait son temps.
 */
const LINES: Record<Season, { day: string[]; night: string[] }> = {
  spring: {
    day: [
      'The pine has new needles.',
      'Meltwater in every gully.',
      'The path is soft underfoot again.',
    ],
    night: [
      'Frogs down by the water.',
      'A warm wind off the valley.',
      'The nights are getting shorter.',
    ],
  },
  summer: {
    day: [
      'Long light on the ridge.',
      'The rock is warm by mid-morning.',
      'Hardly a cloud past the col.',
    ],
    night: [
      'Fireflies along the stream.',
      'Still warm long after dark.',
      'The fire is mostly for the light.',
    ],
  },
  autumn: {
    day: [
      'The maples have turned.',
      'First frost on the high meadow.',
      'Leaves on the path, mostly red.',
    ],
    night: [
      'The fire takes longer to catch.',
      'A cold, clear night on the ridge.',
      'Wood smoke and wet leaves.',
    ],
  },
  winter: {
    day: [
      'Snow on the far slope.',
      'The stream is quiet under the ice.',
      'Short light. The path is the same.',
    ],
    night: [
      'Snow muffles everything tonight.',
      'The fire is the warmest thing for miles.',
      'Stars as far down as the horizon.',
    ],
  },
};

/**
 * La phrase du jour. Choisie par la date et non au hasard : elle ne change pas
 * à chaque rendu, ce qui la rendrait nerveuse, et elle change d'un jour à
 * l'autre, ce qui la rend vivante. Les soirs de pleine lune, la lune parle.
 */
export function placeLine(mode: 'day' | 'night', date: Date = new Date()): string {
  if (mode === 'night') {
    const moon = moonOf(date);
    if (moon.lit > 0.97) return 'Full moon over the ridge.';
    if (moon.lit < 0.03) return 'No moon tonight. More stars for it.';
  }
  const pool = LINES[seasonOf(date)][mode];
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 0)) /
      86_400_000,
  );
  return pool[dayOfYear % pool.length] ?? pool[0] ?? '';
}
