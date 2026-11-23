# Outils de production des images

Rien ici n'entre dans l'app : ce sont les scripts qui fabriquent ses images.

- `montagnard.py` — le personnage du camp : modèle stylisé, squelette, gestes,
  rendu en sprites (couleur + normales) avec Blender sans écran.
  `pip install bpy==5.0.1` dans un environnement à part, puis
  `FRAMES=12 python montagnard.py -- <sortie> idle walk hammer kneel_blow sit`.
  Les images sont ensuite recadrées sur une boîte commune et assemblées en
  planches 4×3 (`src/assets/adventures/montagnard/`).
- `make_normal.py` — la carte de normales d'une image peinte, pour que la
  scène WebGL l'éclaire : `python make_normal.py <image> <sortie> [force]`
  (numpy + Pillow).
