import type { SceneSpec } from '../data/adventures';
import { SceneParticles } from './StageScene';

/*
 * Une scène en profondeur : une clairière, du crépuscule à la nuit.
 *
 * Le relief vient des plans, pas de la 3D. Chaque plan a une profondeur, de 0
 * (le ciel, l'infini) à 1 (les herbes devant l'objectif). Quand la séance
 * avance, la caméra glisse et se rapproche du camp, et chaque plan suit à sa
 * mesure : le lointain à peine, le premier plan beaucoup. C'est ce décalage
 * qui donne la profondeur — le principe des films d'animation 2D en plans.
 *
 * Deux horloges, et seulement deux :
 *  - l'étape fait avancer la caméra, la lumière et l'histoire ;
 *  - la série validée fait avancer la pièce de l'étape (la tente se dresse,
 *    le bois s'empile, le feu prend), un cran par série.
 * Jamais les reps, jamais la charge.
 */

/**
 * Une image posée au sol de la scène. La position est sur l'enveloppe, le
 * mouvement sur l'image : une animation de balancement réécrit `transform`,
 * et elle effacerait le centrage si les deux étaient au même endroit.
 */
function Placed({
  src,
  x,
  bottom,
  h,
  className = '',
  style,
  flip,
}: {
  src: string;
  x: number;
  bottom: number;
  h: number;
  className?: string;
  style?: React.CSSProperties;
  flip?: boolean | undefined;
}) {
  return (
    <span className="absolute" style={{ left: `${x}%`, bottom: `${bottom}%`, transform: `translateX(-50%)${flip ? ' scaleX(-1)' : ''}` }}>
      <img src={src} alt="" className={`block w-auto max-w-none ${className}`} style={{ height: h, ...style }} />
    </span>
  );
}

/** Une fraction de l'histoire devient une étape de cette séance. */
export function storyStage(at: number, stageCount: number): number {
  return Math.round(at * Math.max(1, stageCount - 1));
}

/** La pièce d'une étape : visible en entier après, construite série par série pendant. */
export function reveal(pieceStage: number, stageIndex: number, setsDone: number, setsTotal: number): number {
  if (stageIndex > pieceStage) return 1;
  if (stageIndex < pieceStage) return 0;
  return Math.max(0, Math.min(1, setsDone / Math.max(1, setsTotal)));
}

export function CampScene({
  scene,
  stageIndex,
  stageCount,
  setsDone,
  setsTotal,
  mode,
  date = new Date(),
}: {
  scene: SceneSpec;
  stageIndex: number;
  stageCount: number;
  setsDone: number;
  setsTotal: number;
  mode: 'day' | 'night';
  date?: Date;
}) {
  const last = Math.max(1, stageCount - 1);
  const p = Math.max(0, Math.min(1, stageIndex / last));
  // Une fraction de l'histoire devient une étape de cette séance : une routine
  // plus courte ou plus longue garde le même ordre et les mêmes jalons.
  const stageOf = (at: number) => storyStage(at, stageCount);

  // La caméra : elle avance vers le camp et descend un peu. Le plan proche
  // bouge le plus ; le ciel, pas du tout.
  const cam = (depth: number) =>
    `translate3d(${(-p * scene.camera.pan * depth).toFixed(1)}px, ${(p * 10 * depth).toFixed(1)}px, 0) scale(${(1 + p * scene.camera.zoom * depth).toFixed(3)})`;

  const fireLit = scene.pieces
    .filter((pc) => pc.glow)
    .reduce((m, pc) => Math.max(m, reveal(stageOf(pc.at), stageIndex, setsDone, setsTotal)), 0);

  return (
    <div aria-hidden="true" className="ridge-story ridge-camp absolute inset-0 overflow-hidden">
      {/* Le ciel passe du crépuscule à la nuit au fil des étapes. */}
      <img src={scene.skies[0]} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
      <img
        src={scene.skies[1]}
        alt=""
        className="ridge-camp-fade absolute inset-0 h-full w-full object-cover object-top"
        style={{ opacity: p }}
      />

      {/* Les montagnes : le plan le plus lointain après le ciel. */}
      <div className="ridge-camp-layer absolute inset-0" style={{ transform: cam(0.12) }}>
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
          <path
            d="M-40 205 L20 160 L64 182 L120 132 L178 178 L236 140 L292 184 L350 150 L440 196 L440 300 L-40 300Z"
            className="ridge-camp-far"
          />
          <path
            d="M-40 222 L40 192 L96 210 L160 180 L230 214 L300 188 L360 208 L440 196 L440 300 L-40 300Z"
            className="ridge-camp-near-hills"
          />
        </svg>
      </div>

      {scene.layers.map((l, i) => (
        <div key={i} className="ridge-camp-layer absolute inset-0" style={{ transform: cam(l.depth) }}>
          <Placed
            src={l.src}
            x={l.x}
            bottom={l.bottom}
            h={l.h}
            flip={l.flip}
            className={l.sway ? 'ridge-el-sway' : ''}
            style={{
              opacity: l.dim ?? 1,
              filter: l.depth < 0.5 ? `blur(${((0.5 - l.depth) * 2).toFixed(1)}px) saturate(0.7)` : undefined,
            }}
          />
        </div>
      ))}

      {/* Le sol de la clairière. */}
      <div className="ridge-camp-layer absolute inset-0" style={{ transform: cam(0.7) }}>
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
          <path d="M-60 246 C60 232 160 236 240 234 C320 232 400 238 470 242 L470 300 L-60 300Z" className="ridge-camp-ground" />
        </svg>
      </div>

      {scene.pieces.filter((pc) => !pc.glow).map((pc) => {
        const at = stageOf(pc.at);
        const gone = pc.until !== undefined && stageIndex >= stageOf(pc.until);
        const r = gone ? 0 : reveal(at, stageIndex, setsDone, setsTotal);
        if (r <= 0) return null;
        return (
          <div key={pc.src + pc.at} className="ridge-camp-layer absolute inset-0" style={{ transform: cam(pc.depth) }}>
            {/* Elle se construit du sol vers le haut, un cran par série. */}
            <Placed
              src={pc.src}
              x={pc.x}
              bottom={pc.bottom}
              h={pc.h}
              className={['ridge-camp-piece', pc.glow ? 'ridge-el-flicker' : ''].join(' ')}
              style={{ clipPath: `inset(${((1 - r) * 100).toFixed(0)}% 0 0 0)` }}
            />
          </div>
        );
      })}

      {/* Le personnage : une pose par étape. En attendant ses images, rien. */}
      {scene.poses
        ?.filter((ps) => stageOf(ps.at) === stageIndex)
        .map((ps) => (
          <div key={ps.src} className="ridge-camp-layer absolute inset-0" style={{ transform: cam(0.8) }}>
            <Placed src={ps.src} x={ps.x} bottom={6} h={ps.h} className="ridge-camp-breath" />
          </div>
        ))}

      {/* La lumière : un voile chaud au crépuscule, bleu la nuit. */}
      <div className="ridge-camp-dusk pointer-events-none absolute inset-0" style={{ opacity: (1 - p) * 0.9 }} />
      <div className="ridge-camp-night pointer-events-none absolute inset-0" style={{ opacity: p * 0.85 }} />

      {/* Le feu et sa lueur passent après les voiles : la nuit ne l'éteint pas,
          c'est lui qui l'éclaire. */}
      {fireLit > 0 && (
        <div className="ridge-camp-layer absolute inset-0" style={{ transform: cam(0.75) }}>
          <div className="ridge-camp-glow absolute" style={{ opacity: fireLit }} />
        </div>
      )}
      {scene.pieces.filter((pc) => pc.glow).map((pc) => {
        const r = reveal(stageOf(pc.at), stageIndex, setsDone, setsTotal);
        if (r <= 0) return null;
        return (
          <div key={pc.src + pc.at} className="ridge-camp-layer absolute inset-0" style={{ transform: cam(pc.depth) }}>
            <Placed
              src={pc.src}
              x={pc.x}
              bottom={pc.bottom}
              h={pc.h}
              className="ridge-camp-piece ridge-el-flicker"
              style={{ clipPath: `inset(${((1 - r) * 100).toFixed(0)}% 0 0 0)` }}
            />
          </div>
        );
      })}

      <SceneParticles night={mode === 'night' || p > 0.4} date={date} />

      {/* Le premier plan passe devant tout, et bouge le plus. */}
      {scene.foreground.map((l, i) => (
        <div key={i} className="ridge-camp-layer absolute inset-0" style={{ transform: cam(1) }}>
          <Placed src={l.src} x={l.x} bottom={l.bottom} h={l.h} flip={l.flip} className="ridge-camp-fore ridge-el-sway" />
        </div>
      ))}
    </div>
  );
}
