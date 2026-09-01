/*
 * Places, not sounds.
 *
 * The previous soundtracks were a pad with a melody over a texture, and the
 * pad was the problem: a sustained chord announces "this is a synthesiser"
 * within two bars, however well voiced. Real environments contain almost no
 * sustained pitch. They are made of *events* — thousands of small ones, a few
 * large ones — across several timescales at once, and the pitched material,
 * where there is any, is distant and rare.
 *
 * ── What this is built from ────────────────────────────────────────────────
 *
 * Not from analysing recordings: nothing in this container can reach an audio
 * library, so no file was studied. It is built from the acoustics of the
 * scenes themselves — which frequency band each source actually occupies, and
 * how its events are spaced in time. Those two facts do most of the work, and
 * getting either wrong is what makes synthesised ambience sound fake:
 *
 *   - **Band.** Leaves rustling live at 2-8kHz and have almost no low end;
 *     rain on canvas is 800-3000Hz because the fabric damps everything above;
 *     a crowd is 300-2000Hz with formant humps near 500 and 1500 where vowels
 *     sit. Put any of them in the wrong band and it becomes generic noise.
 *   - **Timing.** Real events are Poisson-distributed, never gridded, and they
 *     cluster — gusts, swells, flurries. Evenly spaced events read as a machine
 *     immediately, which is the single most common tell.
 *
 *   - **Distance.** Far away means quieter, darker and more reverberant, in
 *     that order of importance. A distant bell that is merely quiet still
 *     sounds close.
 */

import { drift, noiseSource, type Sink } from './audio';

/** Poisson-ish gap: mean seconds, never a grid. */
function gap(mean: number, spread = 0.8): number {
  return Math.max(0.03, mean * (1 - spread + Math.random() * spread * 2));
}

/** Schedule something at irregular intervals until the sink is released. */
function recur(sink: Sink, mean: number, spread: number, fire: () => void) {
  const tick = () => {
    fire();
    sink.timers.push(window.setTimeout(tick, gap(mean, spread) * 1000));
  };
  sink.timers.push(window.setTimeout(tick, gap(mean, spread) * 1000));
}

/** A continuous band of noise. The floor of every scene. */
export function bed(
  ac: AudioContext,
  sink: Sink,
  out: AudioNode,
  o: { low: number; high: number; level: number; swell?: number; swellHz?: number },
) {
  const src = noiseSource(ac);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = o.low;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.high;
  const g = ac.createGain();
  if (o.swell) drift(ac, sink, g.gain, o.level, o.swell, o.swellHz ?? 0.05);
  else g.gain.value = o.level;
  src.connect(hp).connect(lp).connect(g).connect(out);
  src.start();
  sink.nodes.push(src);
  return g;
}

/**
 * Many tiny damped events per second — the texture of leaves, of rain on a
 * surface, of gravel. This is the generator a plain noise bed cannot fake:
 * rustle is *granular*, and smoothing it into hiss is exactly what makes
 * synthesised wind sound like a hairdryer.
 */
export function grains(
  ac: AudioContext,
  sink: Sink,
  out: AudioNode,
  o: { rate: number; low: number; high: number; level: number; decay: number },
) {
  const burst = () => {
    const src = noiseSource(ac);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = o.low + Math.random() * (o.high - o.low);
    bp.Q.value = 1.2 + Math.random() * 2;
    const env = ac.createGain();
    const now = ac.currentTime;
    const life = o.decay * (0.5 + Math.random());
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(o.level * (0.4 + Math.random() * 0.6), now + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, now + life);
    src.connect(bp).connect(env).connect(out);
    src.start();
    src.stop(now + life + 0.05);
  };
  recur(sink, 1 / o.rate, 0.95, burst);
}

/*
 * ── Kept, but used by nothing ──────────────────────────────────────────────
 *
 * `thump`, `babble`, `call` and `far` are the four generators that made the
 * first version of these scenes frightening, and no scene uses them now. They
 * are accurate — that was the problem. An isolated low impact is a footstep,
 * indistinct voices are uncanny however warm the room, a lone call in the dark
 * is a horror cue, and distance plus rarity is dread.
 *
 * They stay because they are correct and might serve something that is not
 * trying to be calming. Reaching for one in an ambience is almost certainly a
 * mistake; if you do, check the crest factor afterwards.
 */

/** A low thump: a footfall, a cart, a tent pole taking a gust. */
export function thump(
  ac: AudioContext,
  sink: Sink,
  out: AudioNode,
  o: { mean: number; hz: number; level: number; decay?: number },
) {
  recur(sink, o.mean, 0.9, () => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    const now = ac.currentTime;
    const hz = o.hz * (0.8 + Math.random() * 0.4);
    osc.frequency.setValueAtTime(hz * 1.6, now);
    // A pitch drop is what makes a sine read as an impact rather than a note.
    osc.frequency.exponentialRampToValueAtTime(hz * 0.7, now + 0.12);
    const env = ac.createGain();
    const life = o.decay ?? 0.35;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(o.level * (0.6 + Math.random() * 0.5), now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + life);
    osc.connect(env).connect(out);
    osc.start();
    osc.stop(now + life + 0.05);
  });
}

/**
 * Human voices at a distance, without words.
 *
 * Two bandpasses at roughly the first and second formants of a neutral vowel,
 * over noise, wandering slowly. Individually it is nothing; a few of them at
 * different rates is unmistakably a crowd, because what the ear identifies is
 * the formant region and the restlessness, not any word.
 */
export function babble(
  ac: AudioContext,
  sink: Sink,
  out: AudioNode,
  o: { level: number; voices?: number },
) {
  for (let i = 0; i < (o.voices ?? 4); i++) {
    const src = noiseSource(ac);
    const f1 = ac.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 6;
    drift(ac, sink, f1.frequency, 430 + Math.random() * 240, 120, 0.4 + Math.random() * 1.4);
    const f2 = ac.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 5;
    drift(ac, sink, f2.frequency, 1250 + Math.random() * 700, 350, 0.5 + Math.random() * 1.6);

    const level = ac.createGain();
    // Syllable-rate movement: speech is about four a second, and this is the
    // cue that says "people" rather than "noise".
    drift(ac, sink, level.gain, o.level * 0.6, o.level * 0.55, 2.5 + Math.random() * 2.5);
    const sum = ac.createGain();
    sum.gain.value = 0.5;

    src.connect(f1).connect(sum);
    src.connect(f2).connect(sum);
    sum.connect(level).connect(out);
    src.start();
    sink.nodes.push(src);
  }
}

/** Struck metal: a bell, a hammer on an anvil, a pot. Inharmonic on purpose. */
export function struck(
  ac: AudioContext,
  out: AudioNode,
  o: { hz: number; level: number; decay: number; partials?: number[] },
) {
  // Real bells are inharmonic — these ratios are why a bell is not a flute.
  const partials = o.partials ?? [1, 2.0, 2.76, 5.4];
  const now = ac.currentTime;
  for (const [i, ratio] of partials.entries()) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = o.hz * ratio;
    const env = ac.createGain();
    // Higher partials die first, which is what decay actually sounds like.
    const life = o.decay / (1 + i * 0.7);
    const share = o.level / (1 + i * 1.6);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, share), now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + life);
    osc.connect(env).connect(out);
    osc.start();
    osc.stop(now + life + 0.1);
  }
}

/** A bird, an owl, an insect: a narrow tone with vibrato and a short life. */
export function call(
  ac: AudioContext,
  out: AudioNode,
  o: { hz: number; level: number; seconds: number; vibrato?: number; sweep?: number },
) {
  const osc = ac.createOscillator();
  osc.type = 'sine';
  const now = ac.currentTime;
  osc.frequency.setValueAtTime(o.hz, now);
  if (o.sweep) osc.frequency.exponentialRampToValueAtTime(o.hz * o.sweep, now + o.seconds);

  if (o.vibrato) {
    const lfo = ac.createOscillator();
    const amount = ac.createGain();
    lfo.frequency.value = 5 + Math.random() * 3;
    amount.gain.value = o.vibrato;
    lfo.connect(amount).connect(osc.detune);
    lfo.start();
    lfo.stop(now + o.seconds + 0.3);
  }

  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(o.level, now + 0.04);
  env.gain.setValueAtTime(o.level, now + o.seconds * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, now + o.seconds + 0.25);
  osc.connect(env).connect(out);
  osc.start();
  osc.stop(now + o.seconds + 0.35);
}

/** Fire a generator at long irregular intervals. Exported for scene recipes. */
export function occasionally(sink: Sink, meanSeconds: number, fire: () => void) {
  recur(sink, meanSeconds, 0.85, fire);
}

/**
 * Distance, applied properly: darker first, quieter second.
 *
 * Returns a node to feed. Anything sent through it sits further back, and
 * because the filter matters more than the gain, it stays *behind* the scene
 * rather than merely being a small version of it.
 */
export function far(
  ac: AudioContext,
  sink: Sink,
  out: AudioNode,
  o: { cutoff: number; level: number },
): GainNode {
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.cutoff;
  const g = ac.createGain();
  g.gain.value = o.level;
  const input = ac.createGain();
  input.connect(lp).connect(g).connect(out);
  sink.nodes.push(input, lp, g);
  return input;
}
