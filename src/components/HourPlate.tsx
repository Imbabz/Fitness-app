import type { Hour } from '../data/hours';
import { moonLitPath, moonOf } from '../lib/sky';

/*
 * La plaque de l'heure, et la lune de ce soir par-dessus.
 *
 * La plaque est une image en `object-fit: cover`, calée en haut et centrée.
 * La lune est un SVG posé exactement par-dessus, avec le viewBox de l'image
 * (600 × 284) et `xMidYMin slice` — c'est la même règle que `cover` +
 * `object-position: top center`, écrite pour un SVG. Les deux se recadrent
 * donc à l'identique sur n'importe quelle largeur d'écran, sans une ligne de
 * JavaScript pour mesurer quoi que ce soit.
 *
 * La lune est le seul objet de l'app qu'il est légitime de dessiner plutôt que
 * de peindre : c'est un disque, et sa phase est une donnée.
 */

/** Où la lune se tenait dans la plaque peinte, en coordonnées de l'image. */
const MOON = { cx: 205, cy: 74, r: 18 };

export function HourPlate({
  hour,
  className,
  date = new Date(),
}: {
  hour: Hour;
  /** Taille et position : les mêmes pour l'image et pour la lune. */
  className: string;
  date?: Date;
}) {
  const moon = hour.moon ? moonOf(date) : null;
  return (
    <>
      <img
        src={hour.src}
        alt=""
        aria-hidden="true"
        className={`ridge-hour pointer-events-none object-cover object-top ${className}`}
      />
      {moon && (
        <svg
          viewBox="0 0 600 284"
          preserveAspectRatio="xMidYMin slice"
          aria-hidden="true"
          className={`ridge-hour pointer-events-none ${className}`}
        >
          <defs>
            <radialGradient id="ridge-moon-halo">
              <stop offset="0%" stopColor="rgb(226 232 246)" stopOpacity="0.32" />
              <stop offset="45%" stopColor="rgb(200 212 240)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="rgb(200 212 240)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Le halo suit la lumière : une lune presque nouvelle n'éclaire
              presque rien autour d'elle. */}
          <circle
            cx={MOON.cx}
            cy={MOON.cy}
            r={MOON.r * 2.6}
            fill="url(#ridge-moon-halo)"
            opacity={0.25 + 0.75 * moon.lit}
          />
          {/* La part sombre n'est pas noire : c'est la lumière cendrée, le
              reflet de la Terre. On devine le disque entier, comme dehors. */}
          <circle cx={MOON.cx} cy={MOON.cy} r={MOON.r} fill="rgb(58 66 92)" opacity="0.55" />
          {moon.lit > 0.01 && (
            <path d={moonLitPath(MOON.cx, MOON.cy, MOON.r, moon)} fill="rgb(232 236 244)" />
          )}
        </svg>
      )}
    </>
  );
}
