import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import type { SceneSpec } from '../data/adventures';
import { CampScene } from './CampScene';

/*
 * Quelle clairière montrer.
 *
 * La version WebGL est la vraie : plans en profondeur, mise au point, rayons,
 * halo. La version CSS est le secours, et elle prend le relais sans un mot :
 *  - le temps que le module WebGL se charge (il n'est téléchargé que pour
 *    cette scène) ;
 *  - si le navigateur n'a pas WebGL, ou s'il le perd en route ;
 *  - si le téléphone demande moins de mouvement : la caméra qui avance et le
 *    vent sont précisément ce qu'on nous demande de retirer.
 * Un écran blanc à la place de l'histoire, jamais.
 */

const CampSceneGL = lazy(() => import('./CampSceneGL'));

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Une erreur dans le module WebGL ne doit jamais emporter l'étape. */
class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CampStage(props: {
  scene: SceneSpec;
  stageIndex: number;
  stageCount: number;
  setsDone: number;
  setsTotal: number;
  mode: 'day' | 'night';
}) {
  const [gl, setGl] = useState(() => webglAvailable() && !reducedMotion());
  const css = <CampScene {...props} />;
  if (!gl) return css;
  return (
    <Fallback fallback={css}>
      <Suspense fallback={css}>
        <CampSceneGL
          scene={props.scene}
          stageIndex={props.stageIndex}
          stageCount={props.stageCount}
          setsDone={props.setsDone}
          setsTotal={props.setsTotal}
          onFail={() => setGl(false)}
        />
      </Suspense>
    </Fallback>
  );
}
