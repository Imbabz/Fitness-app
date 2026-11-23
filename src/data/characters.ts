/*
 * Les proportions des planches de sprites de Firmin et Jack, telles que les
 * outils les ont recadrées (tools/firmin.py, tools/jack.py). Les deux sortent
 * de la même caméra : le rapport de leurs hauteurs est leur vrai rapport de
 * taille, et Jack garde sa taille de chien à côté de Firmin.
 */
export const FIRMIN_ASPECT = 160 / 272;
export const JACK_ASPECT = 121 / 115;
/** La hauteur de Jack dans la scène, à l'échelle de Firmin (124 px). */
export const JACK_H = Math.round((115 / 272) * 124);
