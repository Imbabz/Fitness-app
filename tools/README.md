# Outils de production des images

Rien ici n'entre dans l'app : ce sont les scripts qui fabriquent ses images.

- `firmin.py`, `jack.py` — Firmin et son chien Jack : modèle, squelette, gestes,
  rendu en sprites (couleur + normales, sans contour) avec Blender sans écran.
  `pip install bpy==5.0.1` dans un environnement à part, puis
  `FRAMES=12 RES=320 python firmin.py -- <sortie> idle walk hammer kneel_blow flute`
  et `FRAMES=12 RES=320 python jack.py -- <sortie> trot sit lie`.
  `PREVIEW=1` rend une seule image en grand ; `SIDE=1` la vue de profil, pour
  régler une pose. Les images sont ensuite recadrées sur une boîte commune par
  personnage et assemblées en planches 4×3 (`src/assets/adventures/firmin/`,
  `.../jack/`), et leurs proportions reportées dans `src/data/characters.ts`.
- `make_normal.py` — la carte de normales d'une image peinte, pour que la
  scène WebGL l'éclaire : `python make_normal.py <image> <sortie> [force]`
  (numpy + Pillow).

Le décor de la clairière n'a pas d'outil : il est peint en code, au chargement,
dans `src/journey/campArt.ts`.
