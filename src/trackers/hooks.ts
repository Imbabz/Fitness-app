import { useCallback, useEffect, useRef, useState } from 'react';
import { countdownTick } from '../lib/sound';
import { duck } from '../lib/ambient';

/**
 * Countdown driven by a target end-timestamp, never a decrementing counter.
 * Screen lock, tab backgrounding and throttled timers all stop `setInterval`
 * firing on schedule; recomputing from `Date.now()` means none of that drifts.
 *
 * Pass `endsAt: null` to idle.
 */
export function useCountdown(endsAt: number | null, onDone?: () => void) {
  const [remainingMs, setRemainingMs] = useState(() =>
    endsAt === null ? 0 : Math.max(0, endsAt - Date.now()),
  );
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    if (endsAt === null) {
      setRemainingMs(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        if (firedFor.current !== endsAt) {
          firedFor.current = endsAt;
          doneRef.current?.();
        }
        return;
      }
      raf = window.setTimeout(tick, 100);
    };
    tick();
    return () => window.clearTimeout(raf);
  }, [endsAt]);

  return {
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
  };
}

/**
 * Holds the screen awake while a tracker is active. Re-acquires on visibility
 * change — the browser drops the sentinel whenever the tab is hidden, and
 * without this the screen sleeps the moment you glance away mid-set.
 */
export function useWakeLock(active: boolean) {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const acquire = async () => {
      try {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void s.release();
          return;
        }
        sentinel.current = s;
      } catch {
        // Denied, unsupported, or not user-activated. Not worth surfacing.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !sentinel.current) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      const s = sentinel.current;
      sentinel.current = null;
      if (s) void s.release().catch(() => undefined);
    };
  }, [active]);
}

/**
 * Distinguishes a tap from a press-and-hold. Used by the rep counter, where a
 * tap increments and a 400ms hold decrements — with chalky fingers a small "−"
 * button gets mis-hit constantly, so the fix has to be forgiving.
 */
export function useTapOrHold({
  onTap,
  onHold,
  holdMs = 400,
}: {
  onTap: () => void;
  onHold: () => void;
  holdMs?: number;
}) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    fired.current = false;
    clear();
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onHold();
    }, holdMs);
  }, [clear, holdMs, onHold]);

  const end = useCallback(() => {
    clear();
    if (!fired.current) onTap();
    fired.current = false;
  }, [clear, onTap]);

  const cancel = useCallback(() => {
    clear();
    fired.current = false;
  }, [clear]);

  useEffect(() => clear, [clear]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      start();
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      end();
    },
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * Beeps through the closing seconds of a timer, once each. Driven by the
 * countdown's own `remainingSeconds`, so it stays correct across a backgrounded
 * tab — the timers track a target timestamp rather than decrementing, and a
 * phone that slept through the last five seconds should not fire five beeps on
 * waking. Only the seconds actually observed sound.
 */
export function useCountdownBeeps(remainingSeconds: number, enabled: boolean, from = 3) {
  const spoken = useRef(new Set<number>());

  useEffect(() => {
    if (!enabled) spoken.current.clear();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (remainingSeconds > from) {
      // Back above the window means a new timer, or one that was extended.
      if (spoken.current.size > 0) spoken.current.clear();
      return;
    }
    if (remainingSeconds < 1 || spoken.current.has(remainingSeconds)) return;
    spoken.current.add(remainingSeconds);
    // Dip whatever is playing rather than making the cue loud enough to beat
    // it. A beep that has to win on volume is the startle the soundtrack exists
    // to avoid; ducking lets it stay quiet and still carry.
    duck(1);
    countdownTick(remainingSeconds);
  }, [remainingSeconds, enabled, from]);
}
