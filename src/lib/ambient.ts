/*
 * Ambient soundscapes, synthesised.
 *
 * Every bed here is noise and oscillators shaped in real time — there are no
 * audio files. That is not a shortcut: it keeps the bundle at zero cost, keeps
 * the offline guarantee intact (CLAUDE.md rule 5), and sidesteps licensing
 * entirely. Recorded ambience from a streaming channel would fail all three.
 *
 * Everything errs quiet. This plays in a gym over machines and in a bedroom at
 * 22:00, and the second case sets the ceiling.
 */

import { getTrack } from './tracks';

/** A synthesised bed, silence, or one of the user's own files. */
export type AmbientKind = 'off' | SynthKind | `track:${string}`;

export type SynthKind = 'rain' | 'waves' | 'wind' | 'fire' | 'drone';

export function isTrack(kind: AmbientKind): kind is `track:${string}` {
  return kind.startsWith('track:');
}

export function trackIdOf(kind: AmbientKind): string | null {
  return isTrack(kind) ? kind.slice('track:'.length) : null;
}

export const AMBIENT_KINDS: Array<{ id: 'off' | SynthKind; label: string; note: string }> = [
  { id: 'off', label: 'Off', note: 'Silence' },
  { id: 'rain', label: 'Rain', note: 'Steady, close' },
  { id: 'waves', label: 'Waves', note: 'Slow swell' },
  { id: 'wind', label: 'Wind', note: 'Open and high' },
  { id: 'fire', label: 'Fire', note: 'Crackle and hiss' },
  { id: 'drone', label: 'Drone', note: 'Low fifth, a bell' },
];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voices: AudioNode[] = [];
let timers: number[] = [];
let current: AmbientKind = 'off';

function context(): AudioContext | null {
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

/** Two seconds of noise, looped. Generated once and reused by every bed. */
let noiseBuffer: AudioBuffer | null = null;
function noise(ac: AudioContext): AudioBufferSourceNode {
  if (!noiseBuffer) {
    const length = ac.sampleRate * 2;
    noiseBuffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    // Brown-ish: integrated white noise, which sits far lower than white and is
    // what makes rain and surf read as distance rather than static.
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
function drift(ac: AudioContext, param: AudioParam, centre: number, depth: number, hz: number) {
  const lfo = ac.createOscillator();
  const amount = ac.createGain();
  lfo.frequency.value = hz;
  amount.gain.value = depth;
  param.value = centre;
  lfo.connect(amount).connect(param);
  lfo.start();
  voices.push(lfo);
}

function build(ac: AudioContext, kind: AmbientKind, out: GainNode) {
  if (kind === 'rain') {
    const src = noise(ac);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 700;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    drift(ac, lp.frequency, 5200, 900, 0.06);
    src.connect(hp).connect(lp).connect(out);
    src.start();
    voices.push(src);
    return;
  }

  if (kind === 'waves') {
    const src = noise(ac);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    drift(ac, lp.frequency, 900, 550, 0.07);
    const swell = ac.createGain();
    // The swell is the whole illusion: surf is one long breath, not a texture.
    drift(ac, swell.gain, 0.55, 0.42, 0.075);
    src.connect(lp).connect(swell).connect(out);
    src.start();
    voices.push(src);
    return;
  }

  if (kind === 'wind') {
    const src = noise(ac);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    drift(ac, bp.frequency, 1100, 700, 0.05);
    const gust = ac.createGain();
    drift(ac, gust.gain, 0.6, 0.35, 0.035);
    src.connect(bp).connect(gust).connect(out);
    src.start();
    voices.push(src);
    return;
  }

  if (kind === 'fire') {
    const src = noise(ac);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    const bed = ac.createGain();
    bed.gain.value = 0.5;
    src.connect(lp).connect(bed).connect(out);
    src.start();
    voices.push(src);

    // Crackles: short filtered bursts at irregular intervals. Regular spacing
    // reads as a machine immediately, so the gap is randomised every time.
    const crackle = () => {
      const burst = noise(ac);
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
      timers.push(window.setTimeout(crackle, 90 + Math.random() * 700));
    };
    timers.push(window.setTimeout(crackle, 200));
    return;
  }

  if (kind === 'drone') {
    // Root and fifth, the interval a hurdy-gurdy or a chant bourdon sits on.
    for (const [hz, level] of [
      [98, 0.5],
      [147, 0.32],
      [196, 0.16],
    ] as const) {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      // A little detune drift keeps it from sounding like a test tone.
      drift(ac, osc.detune, 0, 6, 0.04 + Math.random() * 0.03);
      osc.frequency.value = hz;
      const g = ac.createGain();
      g.gain.value = level;
      osc.connect(g).connect(out);
      osc.start();
      voices.push(osc);
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
      timers.push(window.setTimeout(bell, 22000 + Math.random() * 26000));
    };
    timers.push(window.setTimeout(bell, 9000));
  }
}

/*
 * ── The user's own files ───────────────────────────────────────────────────
 *
 * An <audio> element rather than a decoded Web Audio buffer: an hour-long file
 * decoded to PCM would be hundreds of megabytes in memory, while the element
 * streams it from the blob and loops natively.
 *
 * It is kept alive across selections and prepared ahead of time, because iOS
 * only honours play() inside a user gesture — awaiting the blob first would
 * break that chain, so by the time Begin is pressed the source is already set.
 */
let el: HTMLAudioElement | null = null;
let elUrl: string | null = null;
let elTrackId: string | null = null;
let fade: number | null = null;

function element(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
  }
  return el;
}

function rampTo(target: number, ms: number, thenPause = false) {
  const node = element();
  if (fade !== null) window.clearInterval(fade);
  const from = node.volume;
  const started = Date.now();
  fade = window.setInterval(() => {
    const t = Math.min(1, (Date.now() - started) / ms);
    node.volume = Math.max(0, Math.min(1, from + (target - from) * t));
    if (t >= 1) {
      if (fade !== null) window.clearInterval(fade);
      fade = null;
      if (thenPause) node.pause();
    }
  }, 40);
}

/**
 * Load a track's blob into the element without playing it. Safe to call from
 * an effect — it is the play() that needs a gesture, not the loading.
 */
export async function prepareAmbient(kind: AmbientKind) {
  const id = trackIdOf(kind);
  if (!id || id === elTrackId) return;
  const track = await getTrack(id);
  if (!track) return;
  if (elUrl) URL.revokeObjectURL(elUrl);
  elUrl = URL.createObjectURL(track.blob);
  elTrackId = id;
  const node = element();
  node.src = elUrl;
  node.load();
}

/** Drops the loaded file. Called when that track is deleted. */
export function forgetTrack(id: string) {
  if (elTrackId !== id) return;
  element().pause();
  element().removeAttribute('src');
  if (elUrl) URL.revokeObjectURL(elUrl);
  elUrl = null;
  elTrackId = null;
  if (current === `track:${id}`) current = 'off';
}

export function playing(): AmbientKind {
  return current;
}

export function stopAmbient() {
  for (const t of timers) window.clearTimeout(t);
  timers = [];
  current = 'off';

  if (el && !el.paused) rampTo(0, 400, true);

  if (master && ctx) {
    // Fade rather than cut: an abrupt stop on a noise bed is a click.
    const g = master;
    const at = ctx.currentTime;
    try {
      g.gain.cancelScheduledValues(at);
      g.gain.setValueAtTime(g.gain.value, at);
      g.gain.linearRampToValueAtTime(0.0001, at + 0.4);
    } catch {
      /* no-op */
    }
    const dying = voices;
    voices = [];
    master = null;
    window.setTimeout(() => {
      for (const v of dying) {
        try {
          (v as OscillatorNode).stop?.();
        } catch {
          /* already stopped */
        }
        v.disconnect();
      }
      try {
        g.disconnect();
      } catch {
        /* no-op */
      }
    }, 500);
  } else {
    voices = [];
    master = null;
  }
}

/**
 * Start a bed, replacing whatever was playing. Must be called from a user
 * gesture the first time — iOS will not start an AudioContext otherwise.
 */
export function startAmbient(kind: AmbientKind, level = 0.35) {
  if (kind === current) return;
  stopAmbient();
  if (kind === 'off') return;

  const id = trackIdOf(kind);
  if (id) {
    current = kind;
    const run = () => {
      const node = element();
      node.volume = 0;
      void node.play().catch(() => undefined);
      rampTo(level, 1200);
    };
    // Already loaded: play synchronously, so the call stays inside the gesture
    // that triggered it and iOS allows it. Otherwise load first and start when
    // it lands — checking that the choice still stands, since a slow load can
    // outlive the user changing their mind.
    if (id === elTrackId) run();
    else void prepareAmbient(kind).then(() => current === kind && run());
    return;
  }

  const ac = context();
  if (!ac) return;

  try {
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, ac.currentTime);
    out.gain.linearRampToValueAtTime(level, ac.currentTime + 1.2);
    out.connect(ac.destination);
    master = out;
    current = kind;
    build(ac, kind, out);
  } catch {
    stopAmbient();
  }
}
