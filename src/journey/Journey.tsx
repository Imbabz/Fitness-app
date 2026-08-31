import { useCallback, useEffect, useRef, useState } from 'react';
import type { Block, Session } from '../types';
import { useApp } from '../state/AppStateContext';
import { ProgressArc } from './ProgressArc';
import { Trailhead } from './Trailhead';
import { Stage } from './Stage';
import { Interstitial } from './Interstitial';
import { Summit } from './Summit';
import { MorningWarning } from './MorningWarning';
import { AmbientButton } from './AmbientButton';
import { prepareAmbient, resolveAmbient, startAmbient, stopAmbient } from '../lib/ambient';
import { seek, setProgress } from '../lib/arc';
import { haptic, HAPTIC } from '../lib/haptics';

const SWIPE_PX = 60;

/**
 * The session as a path: trailhead → stages → summit.
 *
 * `stageIndex` lives in `activeSession`, so closing the app mid-session and
 * reopening it drops you back on the exact stage with every logged set intact.
 */
export function Journey({ session, onExit }: { session: Session; onExit: () => void }) {
  const { state, beginSession, setStageIndex, abandonSession } = useApp();
  const active = state.activeSession;
  const stageIndex = active?.stageIndex ?? -1;
  const last = session.exercises.length;

  const [interstitial, setInterstitial] = useState<Block | null>(null);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [showMorning, setShowMorning] = useState(
    () => session.id === 'daily' && new Date().getHours() < 8,
  );

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(-1, Math.min(last, next));
      if (clamped === stageIndex) return;
      setDirection(clamped > stageIndex ? 'forward' : 'back');

      // Entering a new block is a marked moment, not just the next card.
      const from = session.exercises[stageIndex]?.block;
      const to = session.exercises[clamped]?.block;
      if (to && to !== from && clamped > stageIndex) setInterstitial(to);
      else haptic(HAPTIC.transition);

      setStageIndex(clamped);
      window.scrollTo({ top: 0 });
    },
    [last, session.exercises, setStageIndex, stageIndex],
  );

  // ── Swipe navigation. Ignores gestures that start on an interactive
  //    element, so the rep counter's tap zone is never in conflict. ─────────
  const start = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, summary, [data-no-swipe]')) {
      start.current = null;
      return;
    }
    start.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || stageIndex < 0 || stageIndex >= last) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(stageIndex + (dx < 0 ? 1 : -1));
  };

  useEffect(() => {
    if (session.id !== 'daily') setShowMorning(false);
  }, [session.id]);

  /*
   * What should be playing right now.
   *
   * One choice for a whole session cannot say that the main block carries more
   * weight than the spine block wants. A per-block override does; anything
   * unset falls back to the session-wide choice, so this costs nothing until
   * it is used.
   */
  const onStage = stageIndex >= 0;
  const block = session.exercises[Math.max(0, stageIndex)]?.block;
  const wanted =
    (block ? state.settings.ambientByBlock[block] : undefined) ?? state.settings.ambient;
  const layer = state.settings.ambientLayer;

  /*
   * The bed belongs to the session, not to the app: it starts once you are on a
   * stage and stops when you leave, whichever way you leave.
   *
   * Loading a file is what takes time; play() is what needs the gesture. So the
   * blob is fetched while the trailhead is still on screen, and Begin has
   * nothing left to wait for.
   */
  useEffect(() => {
    void prepareAmbient(wanted);
  }, [wanted]);

  useEffect(() => {
    if (onStage) startAmbient(wanted, 0.35, layer);
    else stopAmbient();
  }, [onStage, wanted, layer]);

  useEffect(() => stopAmbient, []);

  /*
   * How far through the session the soundtrack thinks we are.
   *
   * Sets logged over sets prescribed, not stage position: a stage with four
   * sets is four times the work of one with a single set, and the music should
   * move at the rate the work does. That is also what makes it last exactly the
   * session — linger and it stretches, hurry and it tightens.
   */
  const prescribed = session.exercises.reduce((n, e) => n + e.sets, 0);
  const done = active?.sets.length ?? 0;
  const ratio = prescribed > 0 ? done / prescribed : last > 0 ? Math.max(0, stageIndex) / last : 0;

  useEffect(() => {
    setProgress(ratio);
  }, [ratio]);

  // Reaching the summit is the ending, so the soundtrack gets to land on it
  // rather than being cut off when the screen changes.
  useEffect(() => {
    if (stageIndex >= last) resolveAmbient();
  }, [stageIndex, last]);

  // No active session, or walked back off the first stage — either way the
  // trailhead is what you see, and Begin is a single press.
  if (!active || stageIndex < 0) {
    const begin = () => {
      // Directly in the handler, not via the effect below: iOS only lets an
      // AudioContext start from inside a user gesture.
      seek(ratio);
      startAmbient(wanted, 0.35, layer);
      if (active) {
        go(0);
        return;
      }
      beginSession(session.id);
      haptic(HAPTIC.transition);
      const first = session.exercises[0]?.block;
      if (first) setInterstitial(first);
    };

    return (
      <>
        <Trailhead
          session={session}
          onBegin={begin}
          onExit={() => {
            if (active) abandonSession();
            onExit();
          }}
        />
        {showMorning && (
          <div className="fixed inset-x-0 bottom-24 z-30 px-5">
            <MorningWarning onDismiss={() => setShowMorning(false)} />
          </div>
        )}
        {interstitial && (
          <Interstitial block={interstitial} onDismiss={() => setInterstitial(null)} />
        )}
      </>
    );
  }

  if (stageIndex >= last) {
    return <Summit session={session} onSaved={onExit} onBack={() => go(last - 1)} />;
  }

  return (
    <div onPointerDown={onPointerDown} onPointerUp={onPointerUp} className="min-h-dvh">
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-base/90 px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <ProgressArc session={session} stageIndex={stageIndex} />
        </div>
        <AmbientButton />
      </div>

      <div key={stageIndex} className={direction === 'forward' ? 'ridge-slide-in' : 'ridge-slide-back'}>
        <Stage
          session={session}
          stageIndex={stageIndex}
          onNext={() => go(stageIndex + 1)}
          onBack={() => go(stageIndex - 1)}
          // Leaving keeps `activeSession`, so the home screen offers Resume and
          // the journey reopens on this exact stage.
          onLeave={onExit}
          onDiscard={() => {
            abandonSession();
            onExit();
          }}
        />
      </div>

      {interstitial && (
        <Interstitial block={interstitial} onDismiss={() => setInterstitial(null)} />
      )}
    </div>
  );
}
