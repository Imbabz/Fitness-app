/*
 * What Ridge works out about a file when you import it.
 *
 * The point is that nothing about playing your music is arbitrary. Without
 * this, a track loops from its first sample to its last — which means an
 * audible restart every few minutes, dead air wherever the file has a silent
 * intro, and no basis for deciding what to play when. With it, the loop is
 * seam-matched, the silence is trimmed, and a collection is ordered by how busy
 * each track actually is, so the calmest one lands on the spine block.
 *
 * ── Two constraints worth knowing ─────────────────────────────────────────
 *
 * Decode once, here, and never again. Playback streams from the blob through an
 * <audio> element; a five-minute stereo track decoded to PCM is ~50MB resident
 * and several would sink a phone. The decode below asks for mono at 8kHz, so
 * the browser resamples on the way in and the same track costs ~10MB for the
 * few hundred milliseconds this runs.
 *
 * No FFT, no dependencies. Loop matching is normalised cross-correlation in the
 * time domain, and everything else is RMS and energy flux — arithmetic over a
 * Float32Array. 8kHz is plenty: none of these measurements care about anything
 * above 4kHz.
 */

export interface TrackAnalysis {
  durationSec: number;
  /** Seconds of silence at each end, so a sequence has no dead gaps. */
  trimStart: number;
  trimEnd: number;
  /** Seam-matched loop, in seconds. */
  loopStart: number;
  loopEnd: number;
  /** Coarse RMS envelope. Used to crossfade at a quiet moment. */
  energy: number[];
  /** Onset density, 0-1. Orders a collection: busiest first, calmest last. */
  busyness: number;
  /** Normalisation, so a loud track does not jump out after a quiet one. */
  gain: number;
}

/** Low enough that the browser resamples hard; high enough for onset detection. */
const RATE = 8000;
const BUCKETS = 64;
/** A quiet passage, relative to the track's own peak, counts as silence. */
const SILENCE = 0.02;

function rms(data: Float32Array, from: number, to: number): number {
  let sum = 0;
  const end = Math.min(to, data.length);
  for (let i = Math.max(0, from); i < end; i++) sum += (data[i] as number) ** 2;
  const n = Math.max(1, end - Math.max(0, from));
  return Math.sqrt(sum / n);
}

/**
 * How well two windows line up, -1 to 1. A loop is inaudible when the samples
 * either side of the seam actually continue each other, which is what this
 * measures — matching loudness alone is not enough and produces a click.
 */
function correlation(data: Float32Array, a: number, b: number, len: number): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const x = data[a + i] as number;
    const y = data[b + i] as number;
    if (x === undefined || y === undefined) break;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na * nb);
  return denom > 1e-9 ? dot / denom : 0;
}

/** Rise in short-window energy — the cheap, dependency-free onset proxy. */
function flux(data: Float32Array): number {
  const win = Math.floor(RATE * 0.05);
  if (win < 1 || data.length < win * 4) return 0;
  let previous = 0;
  let rises = 0;
  let windows = 0;
  for (let i = 0; i + win <= data.length; i += win) {
    const level = rms(data, i, i + win);
    if (level > previous * 1.35 && level > 0.01) rises += 1;
    previous = level;
    windows += 1;
  }
  // Onsets per second, mapped onto 0-1. Four a second is already busy for the
  // kind of music this is for.
  const perSecond = windows > 0 ? rises / (windows * 0.05) : 0;
  return Math.max(0, Math.min(1, perSecond / 4));
}

function edges(data: Float32Array, peak: number): { start: number; end: number } {
  const threshold = peak * SILENCE;
  const win = Math.floor(RATE * 0.05);
  let start = 0;
  let end = data.length;
  for (let i = 0; i + win <= data.length; i += win) {
    if (rms(data, i, i + win) > threshold) {
      start = i;
      break;
    }
  }
  for (let i = data.length - win; i >= 0; i -= win) {
    if (rms(data, i, i + win) > threshold) {
      end = i + win;
      break;
    }
  }
  return { start, end: Math.max(end, start + win) };
}

/**
 * Pick two points that both sit in a quiet moment *and* whose waveforms
 * continue each other. Quiet alone gives a loop that thumps; correlation alone
 * can land mid-phrase. Requiring both is what makes the seam disappear.
 */
function loopPoints(
  data: Float32Array,
  from: number,
  to: number,
): { start: number; end: number } {
  const span = to - from;
  const minLoop = RATE * 8;
  if (span < minLoop * 1.5) return { start: from, end: to };

  const win = Math.floor(RATE * 0.12);
  const step = Math.floor(RATE * 0.25);
  const peak = Math.max(1e-6, rms(data, from, to));

  // Candidate ends, searched backwards from the tail: a longer loop is always
  // preferable to a short one that happens to correlate slightly better.
  let best = { start: from, end: to, score: -Infinity };
  for (let end = to - win; end > from + minLoop; end -= step) {
    const quiet = 1 - Math.min(1, rms(data, end - win, end) / peak);
    const match = correlation(data, from, end - win, win);
    const score = match * 2 + quiet;
    if (score > best.score) best = { start: from, end, score };
    // Enough candidates to find a good one without walking a 40-minute file.
    if ((to - end) / step > 240) break;
  }
  return { start: best.start, end: best.end };
}

/**
 * Everything after decoding, kept separate from it so it can be checked against
 * signals whose answers are known in advance — a tone of a given period, a file
 * with a measured amount of leading silence. There is no other way to know this
 * code is right: the output is audio, and a passing render proves nothing about
 * whether the loop actually seams.
 */
export function analyseSamples(data: Float32Array, rate: number): TrackAnalysis | null {
  try {
    if (data.length === 0) return null;

    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i] as number);
      if (v > peak) peak = v;
    }
    if (peak < 1e-5) return null;

    const { start, end } = edges(data, peak);
    const loop = loopPoints(data, start, end);

    const energy: number[] = [];
    const bucket = Math.max(1, Math.floor((end - start) / BUCKETS));
    for (let b = 0; b < BUCKETS; b++) {
      energy.push(Number(rms(data, start + b * bucket, start + (b + 1) * bucket).toFixed(4)));
    }

    const overall = rms(data, start, end);
    return {
      durationSec: data.length / rate,
      trimStart: start / rate,
      trimEnd: (data.length - end) / rate,
      loopStart: loop.start / rate,
      loopEnd: loop.end / rate,
      energy,
      busyness: Number(flux(data.subarray(start, end)).toFixed(3)),
      /*
       * Aim every track at the same working level, so a loud master does not
       * jump out after a quiet field recording.
       *
       * The window is about -16dB to +12dB. Narrower than that and real
       * material is left unmatched — the spread between an ambient recording
       * and a mastered track routinely exceeds 16dB. Wider and a nearly silent
       * file gets amplified into its own hiss.
       *
       * The peak guard is what keeps a very dynamic recording from clipping:
       * quiet on average and loud in places is exactly what a classical
       * recording looks like, and scaling it by its RMS alone would clip the
       * loud places.
       */
      gain: Number(
        Math.max(
          0.15,
          Math.min(4, 0.95 / Math.max(0.05, peak), 0.12 / Math.max(0.005, overall)),
        ).toFixed(3),
      ),
    };
  } catch {
    return null;
  }
}

/**
 * Decode a file once and measure it. Resolves to null if it cannot be read — an
 * undecodable file still imports and simply plays start to end on loop, which
 * is what happened before this existed.
 */
export async function analyse(blob: Blob): Promise<TrackAnalysis | null> {
  try {
    const Ctor =
      window.OfflineAudioContext ??
      (window as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
    if (!Ctor) return null;

    const bytes = await blob.arrayBuffer();
    // Length is a placeholder; decodeAudioData sizes the result itself. Asking
    // for mono at 8kHz makes the browser resample on the way in, which is the
    // whole memory story — see the header.
    const offline = new Ctor(1, RATE, RATE);
    const buffer = await offline.decodeAudioData(bytes);
    return analyseSamples(buffer.getChannelData(0), buffer.sampleRate);
  } catch {
    return null;
  }
}
