import { useCallback, useEffect, useRef, useState } from 'react';
import type { Block, Session } from '../types';
import { useApp } from '../state/AppStateContext';
import { ProgressArc } from './ProgressArc';
import { Trailhead } from './Trailhead';
import { Stage } from './Stage';
import { Interstitial } from './Interstitial';
import { Summit } from './Summit';
import { MorningWarning } from './MorningWarning';
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

  // No active session, or walked back off the first stage — either way the
  // trailhead is what you see, and Begin is a single press.
  if (!active || stageIndex < 0) {
    const begin = () => {
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
      <div className="sticky top-0 z-20 bg-base/90 px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm">
        <ProgressArc session={session} stageIndex={stageIndex} />
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
