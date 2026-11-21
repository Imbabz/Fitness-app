import type { Block } from '../types';
import { hourOf, MOTION_CLASS } from '../data/hours';
import { moonLitPath, moonOf, seasonOf, type Season } from '../lib/sky';

/*
 * Le lieu, autour de la figure.
 *
 * La figure faisait son exercice dans le vide : un trait d'encre sur une ligne
 * de sol, et rien autour. Ici elle le fait quelque part — dans la bande où
 * elle se tient, il y a l'objet de l'heure au bord, la saison qui passe
 * devant, et la nuit la lune de ce soir.
 *
 * Trois règles tiennent tout le reste :
 *
 *  - La figure est une consigne. Rien ne passe dessus, rien ne la recouvre,
 *    rien ne lui dispute le contraste : les objets restent dans les marges
 *    latérales, hors de la colonne centrale de 140 px, et les particules sont
 *    petites, pâles et derrière elle.
 *  - Le lieu suit le calendrier, pas la séance. Les feuilles tombent parce
 *    que c'est l'automne, pas parce qu'une série vient d'être validée — rien
 *    ici ne réagit à ce que tu fais.
 *  - En mouvement réduit, les particules disparaissent : elles ne disent rien
 *    que le reste ne dise déjà. Les objets restent, immobiles.
 */

type Kind = 'leaf' | 'petal' | 'snow' | 'seed' | 'firefly';

function particleKind(season: Season, night: boolean): Kind {
  if (season === 'autumn') return 'leaf';
  if (season === 'winter') return 'snow';
  if (season === 'spring') return 'petal';
  return night ? 'firefly' : 'seed';
}

/*
 * Six particules, paramètres fixés une fois pour toutes. Pas de hasard au
 * rendu : un rendu de plus ne doit pas redistribuer les feuilles. Les
 * positions évitent le centre exact — c'est là que se tient la figure — et
 * les délais sont négatifs pour qu'à l'ouverture d'une étape la scène soit
 * déjà en cours, pas en train de démarrer.
 */
const PARTICLES = [
  { x: 6, s: 1, d: 13, delay: -2, drift: 26, spin: 220 },
  { x: 19, s: 0.8, d: 16, delay: -9, drift: -14, spin: -160 },
  { x: 31, s: 1.1, d: 11, delay: -5, drift: 18, spin: 300 },
  { x: 68, s: 0.9, d: 14, delay: -11, drift: -22, spin: -240 },
  { x: 81, s: 1.2, d: 12, delay: -4, drift: 12, spin: 180 },
  { x: 93, s: 0.85, d: 17, delay: -14, drift: -18, spin: -200 },
] as const;

/* Les noms de classes en toutes lettres : Tailwind purge ce qu'il ne lit pas
   littéralement, et une classe construite par gabarit disparaît du bundle sans
   un mot. C'est déjà arrivé une fois avec les mouvements des objets. */
const KIND_CLASS: Record<Kind, string> = {
  leaf: 'ridge-p-leaf',
  petal: 'ridge-p-petal',
  snow: 'ridge-p-snow',
  seed: 'ridge-p-seed',
  firefly: 'ridge-p-firefly',
};

export function StageScene({
  block,
  mode,
  date = new Date(),
}: {
  block: Block;
  mode: 'day' | 'night';
  date?: Date;
}) {
  const hour = hourOf(block, date);
  const night = mode === 'night' || block === 'mobility';
  const kind = particleKind(seasonOf(date), night);
  const moon = night ? moonOf(date) : null;

  // L'objet de premier plan de l'heure, en petit. Pas le lointain : celui-ci
  // est déjà pâle et flou, et à cette taille il ne resterait qu'une tache.
  const objects = (hour?.elements ?? []).filter((el) => !el.far).slice(0, 2);

  return (
    <div aria-hidden="true" className="ridge-scene pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {moon && (
        <svg
          viewBox="0 0 40 40"
          className="absolute right-[7%] top-0 h-9 w-9"
        >
          <circle cx="20" cy="20" r="18" fill="url(#ridge-scene-halo)" opacity={0.3 + 0.7 * moon.lit} />
          <defs>
            <radialGradient id="ridge-scene-halo">
              <stop offset="0%" stopColor="rgb(226 232 246)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(226 232 246)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="20" cy="20" r="7" className="ridge-moon-dark" />
          {moon.lit > 0.01 && <path d={moonLitPath(20, 20, 7, moon)} className="ridge-moon-lit" />}
        </svg>
      )}

      {objects.map((el, i) => (
        <span
          key={el.src + i}
          className={[
            'ridge-scene-obj absolute bottom-1',
            el.motion === 'flicker' ? 'ridge-el-glow' : '',
            // Toujours dans la marge, jamais dans la colonne de la figure.
            el.side === 'left' ? 'left-0' : 'right-0',
          ].join(' ')}
        >
          <img
            src={el.src}
            alt=""
            style={{ height: Math.round(el.h * 0.42) }}
            className={['block w-auto ridge-el', MOTION_CLASS[el.motion]].join(' ')}
          />
        </span>
      ))}

      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={`ridge-p ${KIND_CLASS[kind]}`}
          style={
            {
              left: `${p.x}%`,
              '--p-s': p.s,
              '--p-d': `${p.d}s`,
              '--p-delay': `${p.delay}s`,
              '--p-drift': `${p.drift}px`,
              '--p-spin': `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
