---
name: visual-language
description: Arbitrer quel outil employer pour produire un visuel dans Ridge — SVG écrit à la main, SVG généré par code, générateur procédural, modèle d'images, ou texture. À lire avant de produire toute image, icône, ornement, fond, atmosphère ou figure, et avant d'appeler un modèle de génération d'images.
---

# Choisir un visuel

Cinq outils, cinq besoins. La question n'est jamais « quel outil sais-je
utiliser » mais **« de quelle nature est l'objet à produire »**.

Cette skill est adaptée de celle du projet DnD des Confins, où l'arbitrage a été
payé en soirées perdues. Les pièges d'outil au bas du fichier viennent de là et
sont vrais indépendamment du projet. Ce qui est propre à Ridge est la règle
dure ci-dessous, qui n'a pas d'équivalent là-bas.

## La règle dure, avant tout arbitrage

**Aucune image générée ne représente un corps humain, une articulation, ni une
position d'exercice.** Ridge est une app de rééducation d'une protrusion
discale L5-S1. Un modèle d'images place mal les angles articulaires, et une
position lombaire fausse dans une image de référence est activement nocive —
pire que l'absence d'image. Les figures d'exercice sont des SVG écrits à la
main parce qu'elles sont **justes par construction**, et c'est la seule raison
qui compte.

Le corollaire tient aussi dans l'autre sens : si un visuel ne porte aucune
information médicale — une crête au loin, de la brume, un ciel — il est libre.

## L'arbitrage

| Ce qu'on produit | L'outil | Pourquoi lui |
|---|---|---|
| Une figure d'exercice | **SVG écrit à la main** (`animations/registry.tsx`) | Géométrie juste par construction. Voir la skill `exercise-animation`, qui tient les règles d'articulation |
| Une marque d'identité : favicon, sceau, icône PWA | **SVG écrit à la main** | Suit les jetons de thème, bascule jour/nuit, net à toute taille, quelques centaines d'octets |
| Un schéma qui explique un état : arc de progression, profil de séance, graphe d'historique | **SVG généré par code** | Se régénère quand les données changent |
| Une atmosphère qui obéit à une loi : crête, brume, forêt lointaine, vagues | **Procédural ou dégradés CSS** | Ça *pousse* ou ça *se construit*, donc la formule sait le faire. Et ça suit `currentColor`, donc un seul tracé sert les deux thèmes |
| Une illustration figurative : couverture de séance, carte d'un lieu | **Modèle d'images** (Cloudflare Workers AI) | Aucune formule ne produit une image qui doit être *belle* |
| Une texture de surface : fibre de papier, grain | **Motif SVG cuit une fois**, jamais un filtre en direct | Un `feTurbulence` qui tourne à chaque image coûte le GPU du téléphone |

## Le test qui tranche

**Si l'objet doit être *beau* et pas seulement *juste*, c'est du figuratif,
donc un modèle d'images.** S'il doit être *juste* et pas seulement beau, c'est
du code.

Dans Ridge, presque tout tombe du côté *juste*. Le modèle d'images a un rôle
étroit ici, et ce n'est pas une privation : c'est la règle dure qui s'applique.

## Les erreurs à ne pas refaire

**Un contour d'épaisseur constante n'est pas une gravure, c'est un
pictogramme.** Un trait dessiné enfle et s'amincit le long de sa course. Si une
figure ressemble à une icône d'interface, l'outil ou le réglage était le
mauvais. C'est le seul écart qui reste entre les figures de Ridge et un dessin.

**La procédure ne fait pas de figuratif.** Elle excelle sur ce qui pousse
(arbres récursifs) ou se construit (crêtes, vagues, brume en couches). Un
visage, une créature, une scène composée : modèle d'images, sans hésiter. Le
dire plutôt que de livrer un raté.

**Ne pas générer une image là où vingt lignes de SVG suffisent.** Un chronomètre,
une flamme de série, une icône de bloc : ce sont des formes géométriques.
Générer coûte du quota, du poids et de la cohérence.

**En SVG il n'y a pas de `z-index`** : le dernier tracé passe devant et avale le
clic. Tout ce qui est décor prend `pointer-events: none` — la couche `.ridge-sky`
le fait — et tout ce qui est cliquable se trace en dernier. Se vérifier avec
`elementFromPoint`, jamais à l'œil.

**Surveiller le poids, et plus durement qu'ailleurs.** Ridge est hors-ligne : le
service worker précache tout ce qui sort dans `assets/`, donc chaque octet est
téléchargé une fois et gardé sur le téléphone pour toujours. Règles : une
décimale suffit dans un viewBox de 64 unités ; l'échantillonnage d'une courbe
se calcule sur sa longueur, pas en constante ; au-delà de 100 Ko un visuel sort
en fichier séparé ; et une image embarquée doit gagner sa place contre un
dégradé qui ne pèse rien. La couche de ciel actuelle coûte zéro octet, ce qui
est le bon étalon.

## Les pièges d'outil

**Modèles d'images — pas de négation.** FLUX n'a pas d'invite négative : écrire
« no text, no watermark » injecte *texte* et *filigrane* dans le conditionnement
et le modèle les dessine. On décrit uniquement ce qui **est** là.

**« matte painting » + vocabulaire de matière = photo.** Pour tenir un registre
illustré, employer le vocabulaire d'**atmosphère** — *melancholic, remote,
atmospheric haze* — jamais celui des matériaux.

**Cloudflare Workers AI :** 10 000 Neurons gratuits par jour, remis à zéro à
minuit UTC. `flux-1-schnell` prend du JSON et **refuse width/height** ; FLUX.2
et les modèles Leonardo prennent du multipart et les acceptent. Les modèles
partenaires Google sont facturés au jeton et exigent un solde AI Gateway ou une
clé BYOK. Les identifiants passent par le formulaire sécurisé de la session, qui
les stocke côté infrastructure — jamais dans le dépôt, qui est public, et jamais
collés dans la conversation.

**Canva garde l'image dans le compte** : en sortir un fichier pleine résolution
demande de la placer dans un design puis de l'exporter. Ne pas s'y engager pour
une poignée de vignettes. Pour Ridge, c'est Cloudflare ou rien.

## Avant de produire

Trois questions, dans cet ordre.

1. **Est-ce que ce visuel est nécessaire ?** Sur un écran lu entre deux séries,
   la clarté prime ; un visuel qui n'identifie rien est du bruit. Un fond par
   bloc vaut mieux qu'une vignette par exercice.
2. **Est-ce que quelque chose d'existant fait l'affaire ?** Les 30 figures de
   `animations/registry.tsx`, la couche `.ridge-sky`, les couleurs de bloc.
   Réutiliser une clé d'animation dont la forme du mouvement correspond
   vraiment est presque toujours meilleur que d'en dessiner une.
3. **Quelle est la nature de l'objet ?** Le tableau ci-dessus tranche.

## Après avoir produit

Regarder le résultat **à la taille où il sera vu**, pas en grand. Une figure se
juge à 28 px dans la liste du trailhead, pas à 140 px sur une étape — c'est la
taille qui décide si elle est lisible. Et mesurer plutôt que juger à l'œil :
contraste calculé, poids en octets, cibles tactiles. Sur ce projet, chaque
régression visuelle trouvée l'a été par une mesure, jamais par une capture.
