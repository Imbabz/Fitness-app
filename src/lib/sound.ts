/*
 * One short tone, synthesised. Web Audio oscillators rather than audio files so
 * the bundle cost is zero and the offline guarantee is untouched.
 * Off by default — see BUILD_SPEC §5.3.
 */

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Soft, low, short. A gym is loud and a bedroom at night is quiet — this has
 *  to be tolerable in both, so it errs quiet. */
export function beep(frequency = 440, seconds = 0.16) {
  const ac = context();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    // Envelope the gain — a bare start/stop clicks audibly.
    gain.gain.setValueAtTime(0.0001, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + seconds);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + seconds + 0.02);
  } catch {
    /* no-op */
  }
}

/**
 * The last few seconds of a timer. Rising in pitch so the final one is
 * unmistakable without being louder — a gym is noisy and a bedroom is not, so
 * the cue has to come from pitch rather than volume.
 */
export function countdownTick(secondsLeft: number) {
  if (secondsLeft <= 0) beep(660, 0.22);
  else beep(secondsLeft === 1 ? 560 : 460, 0.09);
}
