let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

/** Fire-and-forget. Silently absent on iOS Safari, which is fine — every
 *  haptic in this app is paired with a visual change. */
export function haptic(pattern: number | number[] = 10) {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no-op */
  }
}

export const HAPTIC: Record<'tick' | 'complete' | 'transition', number | number[]> = {
  tick: 10, // one rep
  complete: [20, 40, 20], // set / hold finished
  transition: 30, // stage or block change
};
