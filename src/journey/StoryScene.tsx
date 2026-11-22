import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2 } from 'lucide-react';
import type { Block } from '../types';
import type { Adventure } from '../data/adventures';
import { hourOf } from '../data/hours';
import { HourPlate } from '../components/HourPlate';
import { ExerciseAnimation } from '../animations/registry';
import { SceneParticles } from './StageScene';

/*
 * L'histoire, au premier plan.
 *
 * C'est ce qu'on voit d'abord en ouvrant une étape : le lieu de l'heure en
 * grand, et le personnage de la séance qui y avance — il grimpe son arbre,
 * s'élève dans le ciel, ou il monte son camp. La figure du mouvement ne
 * disparaît pas : elle passe en vignette, dans le coin haut droit, et
 * s'agrandit d'un toucher.
 *
 * Pourquoi en haut à droite. Le haut gauche, c'est là que l'œil entre dans la
 * scène — il doit tomber sur l'histoire, pas sur la consigne. Et le bouton
 * retour est déjà dans ce coin-là, juste au-dessus : deux cibles empilées au
 * même bord, c'est un retour en arrière par erreur, les mains pleines de
 * magnésie. À droite, la vignette est sous le pouce d'une main droite.
 *
 * Ce qui ne change pas : le personnage avance avec l'étape, jamais avec les
 * reps ni la charge. Il fait écho au mouvement, il ne le démontre pas — la
 * démonstration, c'est la vignette, et la phrase de consigne sous la scène.
 */

export function StoryScene({
  adventure,
  block,
  mode,
  progress,
  date = new Date(),
}: {
  adventure: Adventure;
  block: Block;
  mode: 'day' | 'night';
  /** Où en est la séance, de 0 à 1 — l'étape, jamais les reps ni la charge. */
  progress: number;
  date?: Date;
}) {
  const hour = hourOf(block, date);
  const night = mode === 'night' || block === 'mobility';
  const p = Math.max(0, Math.min(1, progress));
  const pieces = (adventure.build ?? []).filter((b) => p >= b.from && (b.until === undefined || p < b.until));
  const h = adventure.climberHeight ?? 120;
  // Du pied de la scène jusque sous son bord haut : au sommet de la séance, le
  // personnage touche presque le ciel. En calc, pour tenir sur toute hauteur
  // de scène sans mesurer quoi que ce soit.
  const bottom = `calc(10px + ${p.toFixed(3)} * (100% - ${h + 26}px))`;

  return (
    <div aria-hidden="true" className="ridge-story absolute inset-0 overflow-hidden">
      {hour && <HourPlate hour={hour} date={date} className="absolute inset-0 h-full w-full" />}
      {/* Le bas de la scène se fond dans la page : rien n'est coupé net. */}
      <div className="ridge-story-floor absolute inset-x-0 bottom-0 h-1/3" />

      <SceneParticles night={night} date={date} />

      {adventure.climber && (
        <div className="absolute inset-y-0 left-1/2 w-40 -translate-x-1/2">
          {adventure.surface === 'string' ? (
            <span
              className="ridge-string absolute bottom-0 left-1/2 w-px -translate-x-1/2"
              style={{ height: `calc(${bottom} + ${Math.round(h / 2)}px)` }}
            />
          ) : adventure.surface ? (
            <span
              className="ridge-trunk absolute inset-y-0 left-1/2 w-14 -translate-x-1/2"
              style={{ backgroundImage: `url(${adventure.surface})` }}
            />
          ) : null}
          <img
            src={adventure.climber}
            alt=""
            className="ridge-climber absolute left-1/2 -translate-x-1/2"
            style={{ bottom, height: h, width: 'auto', maxWidth: 150 }}
          />
        </div>
      )}

      {pieces.map((b) => (
        <span
          key={b.src + b.from}
          className={['ridge-build absolute bottom-2 -translate-x-1/2', b.glow ? 'ridge-el-glow' : ''].join(' ')}
          style={{ left: `${b.x}%` }}
        >
          <img
            src={b.src}
            alt=""
            className={['block w-auto max-w-none ridge-story-piece', b.glow ? 'ridge-el-flicker' : ''].join(' ')}
            style={{ height: b.h }}
          />
        </span>
      ))}
    </div>
  );
}

/**
 * Le mouvement, en vignette. Assez grand pour reconnaître l'exercice d'un coup
 * d'œil, assez petit pour laisser la scène à l'histoire. Un toucher l'agrandit.
 */
export function FigureThumb({
  animation,
  loopSeconds,
  spine,
  name,
  cue,
}: {
  animation: string;
  loopSeconds?: number | undefined;
  spine: boolean;
  name: string;
  cue?: string | undefined;
}) {
  const [zoom, setZoom] = useState(false);
  const tone = spine ? 'text-spine' : 'text-accent';
  const timing = loopSeconds ? { loopSeconds } : {};
  return (
    <>
      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label="Show the movement larger"
        className="ridge-thumb absolute right-2.5 top-2.5 z-10 grid h-[92px] w-[92px] place-items-center rounded-2xl border border-line/70 bg-surface/90 shadow-sm backdrop-blur-sm active:scale-[0.97]"
      >
        <span className={tone}>
          <ExerciseAnimation animation={animation} size={78} {...timing} />
        </span>
        <Maximize2 size={12} className="absolute bottom-1.5 right-1.5 text-faint" />
      </button>
      {zoom && (
        <FigureZoom
          animation={animation}
          timing={timing}
          tone={tone}
          name={name}
          cue={cue}
          onClose={() => setZoom(false)}
        />
      )}
    </>
  );
}

function FigureZoom({
  animation,
  timing,
  tone,
  name,
  cue,
  onClose,
}: {
  animation: string;
  timing: { loopSeconds?: number };
  tone: string;
  name: string;
  cue?: string | undefined;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Porté sur le body : un ancêtre transformé ferait d'un `fixed` un
  // `absolute` — le piège déjà connu du minuteur de repos.
  return createPortal(
    <button
      type="button"
      onClick={onClose}
      aria-label="Close the movement"
      className="ridge-zoom fixed inset-0 z-50 flex flex-col items-center justify-center bg-base/88 px-8 backdrop-blur-md"
    >
      <span className={tone}>
        <ExerciseAnimation animation={animation} size={Math.min(300, window.innerWidth - 64)} {...timing} />
      </span>
      <span className="mt-4 text-center text-2xl ridge-title text-ink">{name}</span>
      {cue && (
        <span className="mt-2 text-balance text-center text-lg font-medium leading-snug text-ink/90">
          “{cue}”
        </span>
      )}
      <span className="mt-6 text-xs text-faint">Tap anywhere to close</span>
    </button>,
    document.body,
  );
}
