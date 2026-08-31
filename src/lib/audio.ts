/*
 * Shared Web Audio primitives.
 *
 * Extracted once there were two consumers — the constant beds and the session
 * soundtracks — because the noise buffer is two seconds of generated samples
 * and building it twice would be wasteful, and because the textures themselves
 * are the raw material both are made of.
 *
 * No audio files anywhere in here. See CLAUDE.md rule 5.
 */

export type SynthKind = 'rain' | 'waves' | 'wind' | 'fire' | 'drone';

/** Everything a running graph needs torn down. Each consumer keeps its own. */
export interface Sink {
  nodes: Array<AudioNode & { stop?: (when?: number) => void }>;
  timers: number[];
}

export const emptySink = (): Sink => ({ nodes: [], timers: [] });

export function releaseSink(sink: Sink) {
  for (const t of sink.timers) window.clearTimeout(t);
  sink.timers = [];
  for (const n of sink.nodes) {
    try {
      n.stop?.();
    } catch {
      /* already stopped */
    }
    try {
      n.disconnect();
    } catch {
      /* no-op */
    }
  }
  sink.nodes = [];
}

/*
 * One AudioContext for the whole app.
 *
 * There used to be two — one here for ambience, one in sound.ts for the beeps —
 * and that was a real fault rather than mere waste. Each context has to be
 * resumed inside a user gesture of its own, and the beep context was first
 * created *when a beep fired*, which is during a timer and never during a tap.
 * On iOS it was therefore born suspended and stayed silent for the whole
 * session. Everything that makes a sound now shares this one.
 */
let ctx: AudioContext | null = null;

export function context(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * The context only if one already exists.
 *
 * Teardown and ducking must use this rather than context(): they run from
 * effects and timers, not taps, and creating a context outside a gesture is
 * exactly what leaves iOS holding a suspended one. Nothing that merely stops
 * sound has any business starting the audio system.
 */
export function existingContext(): AudioContext | null {
  return ctx;
}

/** Whether audio can actually be heard right now. For the diagnostic. */
export function contextState(): 'none' | AudioContextState {
  return ctx ? ctx.state : 'none';
}

/*
 * iOS suspends the context whenever the app is backgrounded, and does not
 * resume it on return; it also refuses to start one outside a user gesture. A
 * graph built while suspended is completely silent — and worse, an <audio>
 * element routed through a suspended context plays "successfully" to nobody.
 *
 * So: resume on any interaction, and on coming back to the foreground. Cheap,
 * idempotent, and it turns "sound stopped after I answered a message" from a
 * dead session into a non-event.
 */
function resume() {
  if (ctx && ctx.state !== 'running') void ctx.resume();
}

if (typeof document !== 'undefined') {
  for (const event of ['pointerdown', 'touchend', 'click', 'keydown']) {
    document.addEventListener(event, resume, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resume();
  });
}

/** Two seconds of brown-ish noise, looped. Generated once, reused by every graph. */
let noiseBuffer: AudioBuffer | null = null;

export function noiseSource(ac: AudioContext): AudioBufferSourceNode {
  if (!noiseBuffer) {
    const length = ac.sampleRate * 2;
    noiseBuffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    // Integrated white noise, which sits far lower than white and is what makes
    // rain and surf read as distance rather than static.
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

/** A slow sine on a parameter — swell, gust, flicker. */
export function drift(
  ac: AudioContext,
  sink: Sink,
  param: AudioParam,
  centre: number,
  depth: number,
  hz: number,
) {
  const osc = ac.createOscillator();
  const amount = ac.createGain();
  osc.frequency.value = hz;
  amount.gain.value = depth;
  param.value = centre;
  osc.connect(amount).connect(param);
  osc.start();
  sink.nodes.push(osc);
}

/**
 * One elemental texture, connected to `out`. These are the aggregate material:
 * a bed plays exactly one, a soundtrack layers one or two under a pad.
 */
export function texture(ac: AudioContext, kind: SynthKind, out: AudioNode, sink: Sink) {
  if (kind === 'rain') {
    const src = noiseSource(ac);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 700;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    drift(ac, sink, lp.frequency, 5200, 900, 0.06);
    src.connect(hp).connect(lp).connect(out);
    src.start();
    sink.nodes.push(src);
    return;
  }

  if (kind === 'waves') {
    const src = noiseSource(ac);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    drift(ac, sink, lp.frequency, 900, 550, 0.07);
    const swell = ac.createGain();
    // The swell is the whole illusion: surf is one long breath, not a texture.
    drift(ac, sink, swell.gain, 0.55, 0.42, 0.075);
    src.connect(lp).connect(swell).connect(out);
    src.start();
    sink.nodes.push(src);
    return;
  }

  if (kind === 'wind') {
    const src = noiseSource(ac);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    drift(ac, sink, bp.frequency, 1100, 700, 0.05);
    const gust = ac.createGain();
    drift(ac, sink, gust.gain, 0.6, 0.35, 0.035);
    src.connect(bp).connect(gust).connect(out);
    src.start();
    sink.nodes.push(src);
    return;
  }

  if (kind === 'fire') {
    const src = noiseSource(ac);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    const bed = ac.createGain();
    bed.gain.value = 0.5;
    src.connect(lp).connect(bed).connect(out);
    src.start();
    sink.nodes.push(src);

    // Crackles: short filtered bursts at irregular intervals. Regular spacing
    // reads as a machine immediately, so the gap is randomised every time.
    const crackle = () => {
      const burst = noiseSource(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1200 + Math.random() * 2600;
      bp.Q.value = 6;
      const env = ac.createGain();
      const now = ac.currentTime;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.5 + Math.random() * 0.5, now + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.05 + Math.random() * 0.09);
      burst.connect(bp).connect(env).connect(out);
      burst.start();
      burst.stop(now + 0.2);
      sink.timers.push(window.setTimeout(crackle, 90 + Math.random() * 700));
    };
    sink.timers.push(window.setTimeout(crackle, 200));
    return;
  }

  // drone — root and fifth, the interval a hurdy-gurdy or a chant bourdon sits on.
  for (const [hz, level] of [
    [98, 0.5],
    [147, 0.32],
    [196, 0.16],
  ] as const) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    // A little detune drift keeps it from sounding like a test tone.
    drift(ac, sink, osc.detune, 0, 6, 0.04 + Math.random() * 0.03);
    osc.frequency.value = hz;
    const g = ac.createGain();
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start();
    sink.nodes.push(osc);
  }

  // An occasional bell, far off and very soft.
  const bell = () => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 392;
    const env = ac.createGain();
    const now = ac.currentTime;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 4);
    osc.connect(env).connect(out);
    osc.start();
    osc.stop(now + 4.2);
    sink.timers.push(window.setTimeout(bell, 22000 + Math.random() * 26000));
  };
  sink.timers.push(window.setTimeout(bell, 9000));
}
