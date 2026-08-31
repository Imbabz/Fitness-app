/*
 * One short tone, synthesised. Web Audio oscillators rather than audio files so
 * the bundle cost is zero and the offline guarantee is untouched.
 * Off by default — see BUILD_SPEC §5.3.
 */

/*
 * Shares the app's single AudioContext. It used to make its own, which meant
 * the beeps lived in a context first created during a timer — never inside a
 * tap — and iOS therefore kept it suspended and silent. See audio.ts.
 */
import { context } from './audio';

/** Soft, low, short. A gym is loud and a bedroom at night is quiet — this has
 *  to be tolerable in both, so it errs quiet. */
export function beep(frequency = 440, seconds = 0.16, peak = 0.12) {
  const ac = context();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    // Envelope the gain — a bare start/stop clicks audibly.
    gain.gain.setValueAtTime(0.0001, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ac.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + seconds);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + seconds + 0.02);
  } catch {
    /* no-op */
  }
}

/**
 * The last few seconds of a timer.
 *
 * Not a beep — a struck bowl. A square-ish blip at a fifth of the volume of the
 * room is an alarm, and an alarm is the opposite of what a session that ends
 * face-down on the floor at 22:00 needs. This is a low sine with a touch of its
 * own octave, a soft attack and a long decay, quiet enough to sit inside the
 * music rather than cut across it — the ducking in ambient.ts is what makes it
 * audible, not the volume.
 *
 * Pitch carries the countdown, rising a whole tone each second and resolving up
 * a fourth at zero, so the last one is unmistakable without being louder.
 */
export function countdownTick(secondsLeft: number) {
  const ac = context();
  if (!ac) return;

  const done = secondsLeft <= 0;
  // G3, A3, B3, then up to E4 on the final one.
  const hz = done ? 329.63 : secondsLeft === 1 ? 246.94 : secondsLeft === 2 ? 220 : 196;
  const decay = done ? 2.4 : 1.3;
  const peak = done ? 0.075 : 0.05;

  try {
    const bus = ac.createGain();
    bus.gain.value = 1;
    bus.connect(ac.destination);

    // Fundamental, plus an octave at a fraction of it. Two partials is the
    // difference between a tone and something that sounds struck.
    for (const [ratio, level, ratioDecay] of [
      [1, 1, 1],
      [2, 0.22, 0.55],
    ] as const) {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = hz * ratio;
      const env = ac.createGain();
      const now = ac.currentTime;
      env.gain.setValueAtTime(0.0001, now);
      // 40ms rather than 2ms: slow enough that it swells instead of striking.
      env.gain.exponentialRampToValueAtTime(peak * level, now + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.04 + decay * ratioDecay);
      osc.connect(env).connect(bus);
      osc.start();
      osc.stop(now + 0.04 + decay + 0.2);
    }

    window.setTimeout(
      () => {
        try {
          bus.disconnect();
        } catch {
          /* no-op */
        }
      },
      (decay + 1) * 1000,
    );
  } catch {
    /* no-op */
  }
}
