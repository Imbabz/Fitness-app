import type { Block } from '../types';
import { hourNow, hourOf } from '../data/hours';
import { useApp } from '../state/AppStateContext';

/**
 * Le ciel de l'heure, derrière tout le reste.
 *
 * La plaque de l'interstitiel est un moment : plein écran, une seconde et
 * demie, puis elle s'en va. Celle-ci est un lieu : elle reste, très basse,
 * derrière la page, et elle change quand l'heure change — bloc par bloc
 * pendant une séance, horloge en main partout ailleurs. C'est ce qui fait que
 * la séance se tient quelque part au lieu de flotter sur du blanc.
 *
 * Décor pur : aria-hidden, aucun événement, et rien de ce qu'elle montre n'est
 * une information que le texte ne donne pas déjà. Elle est assez pâle pour ne
 * jamais disputer le contraste au texte — c'est la contrainte qui fixe son
 * opacité, pas le goût.
 */
export function HourSky({ block }: { block?: Block }) {
  const { state } = useApp();
  const hour = (block && hourOf(block)) ?? hourNow(state.mode);
  return (
    <div
      className="ridge-sky"
      aria-hidden="true"
      style={{ '--hour-tint': hour.tint } as React.CSSProperties}
    >
      <img src={hour.src} alt="" className="ridge-hour-wash" />
    </div>
  );
}
