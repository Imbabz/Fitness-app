/*
 * Four places, built for calm rather than for realism.
 *
 * The first version of this file was frightening, and not by accident. It
 * reached for realism and surprise, and the vocabulary it arrived at —
 * indistinct voices, isolated low thumps, a bell tolling in six seconds of
 * stone, distant thunder, bird calls at night, sparse events over a quiet bed —
 * is item for item the standard kit of horror sound design. A rare loud event
 * in a quiet field is what a threat sounds like. The brain is built to flag it,
 * and no amount of tuning the frequencies fixes that.
 *
 * ── The rules, which are the opposite of the realistic ones ────────────────
 *
 *   1. **Density, not sparsity.** Many tiny events per second read as texture;
 *      a few large ones read as incidents. Everything here is texture.
 *   2. **No voices.** Indistinct speech is inherently uncanny — the ear tries
 *      to resolve it, fails, and stays alert. This was the worst offender.
 *   3. **No isolated low transients.** Those are footsteps, doors, something
 *      moving in the dark. Low frequencies belong in the continuous bed only.
 *   4. **Nothing distant.** Far away plus reverberant plus rare is dread.
 *      Close and continuous is safe.
 *   5. **Crest factor at or under about 6.** This is the measurable form of
 *      all of the above: it is the ratio of the loudest moment to the average,
 *      so a low crest means nothing ever jumps out. The frightening version
 *      measured 18.8.
 *   6. **Soft onsets.** Nothing with a sharp attack except grains, which are
 *      too small and too many to startle anyone.
 *
 * The bands still matter and are still load-bearing — each layer sits where
 * that source actually lives, and moving one an octave turns a place back into
 * generic noise. But band accuracy is what makes it convincing; the rules above
 * are what make it bearable, and they win where the two disagree.
 */

import { reverb, type Sink } from './audio';
import { bed, grains, occasionally, struck } from './scene';

export type SceneId = 'market' | 'tent' | 'campfire' | 'abbey';

export interface Scene {
  id: SceneId;
  label: string;
  /** What you are standing in. Shown in the picker. */
  note: string;
  build(ac: AudioContext, sink: Sink, out: AudioNode): void;
}

export const SCENES: Scene[] = [
  {
    id: 'market',
    label: 'Village',
    note: 'A warm room above a busy street',
    build(ac, sink, out) {
      /*
       * This began as a market square with a crowd in it, and the crowd was the
       * single most frightening thing in the set. Murmuring voices cannot be
       * made calm — so there are none. What is left is the warmth of a busy
       * place heard through a wall: the hum, the movement, none of the words.
       */
      bed(ac, sink, out, { low: 120, high: 900, level: 0.16, swell: 0.03, swellHz: 0.021 });
      bed(ac, sink, out, { low: 500, high: 2600, level: 0.05, swell: 0.018, swellHz: 0.037 });

      // Activity as texture: fast enough that no single event is an event.
      grains(ac, sink, out, { rate: 26, low: 700, high: 2600, level: 0.05, decay: 0.07 });
      grains(ac, sink, out, { rate: 9, low: 250, high: 900, level: 0.045, decay: 0.13 });

      // A loom, a mill wheel, something turning steadily downstairs. Regular on
      // purpose: predictability is the whole point here.
      grains(ac, sink, out, { rate: 3.4, low: 160, high: 520, level: 0.05, decay: 0.2 });
    },
  },

  {
    id: 'tent',
    label: 'Tente',
    note: 'Under canvas, steady rain',
    build(ac, sink, out) {
      /*
       * Rain on fabric, not rain in the open: canvas damps everything above
       * about 3kHz, so the brightness that defines open rain is absent and what
       * remains is drumming at 800-3000Hz.
       *
       * The thunder and the guy-line thumps are gone. Both were startles, and a
       * startle is the one thing a session done face-down on the floor cannot
       * afford.
       */
      grains(ac, sink, out, { rate: 150, low: 900, high: 3000, level: 0.075, decay: 0.028 });
      grains(ac, sink, out, { rate: 60, low: 1800, high: 4200, level: 0.03, decay: 0.02 });
      // The wash of everything falling further off, over the whole fly.
      bed(ac, sink, out, { low: 400, high: 2400, level: 0.15, swell: 0.03, swellHz: 0.035 });
      // The canvas has a body. Without it this is rain with no tent around it.
      bed(ac, sink, out, { low: 80, high: 260, level: 0.07, swell: 0.02, swellHz: 0.019 });
      // Wind, as a slow breathing of the whole bed rather than as gusts.
      bed(ac, sink, out, { low: 180, high: 1000, level: 0.05, swell: 0.03, swellHz: 0.012 });
    },
  },

  {
    id: 'campfire',
    label: 'Feu de camp',
    note: 'A fire close by, leaves overhead',
    build(ac, sink, out) {
      // The roar you feel more than hear.
      bed(ac, sink, out, { low: 70, high: 340, level: 0.085, swell: 0.025, swellHz: 0.06 });
      /*
       * Crackle, but as a continuous bed of small events rather than as
       * occasional pops. The old version fired sharp isolated cracks over near
       * silence and measured a crest of 18.8 — which is to say it kept making
       * you flinch.
       */
      grains(ac, sink, out, { rate: 30, low: 900, high: 3600, level: 0.075, decay: 0.045 });
      grains(ac, sink, out, { rate: 8, low: 400, high: 1400, level: 0.05, decay: 0.1 });

      // Leaves: granular by nature, thousands of separate tiny collisions at
      // 2-8kHz. Filtering noise into that band gives hiss; only the rate gives
      // leaves.
      grains(ac, sink, out, { rate: 220, low: 2400, high: 7500, level: 0.03, decay: 0.018 });
      // The canopy moving, well below the leaves themselves.
      bed(ac, sink, out, { low: 200, high: 1200, level: 0.06, swell: 0.03, swellHz: 0.015 });

      // No owls, no night birds. A lone call in the dark is a horror cue, and
      // it was one here too.
    },
  },

  {
    id: 'abbey',
    label: 'Abbaye',
    note: 'Warm stone, a soft bell',
    build(ac, sink, out) {
      /*
       * Two and a half seconds of stone, not six. A cavernous tail with rare
       * events in it is dread; a short warm one is a room. The footsteps are
       * gone entirely — somebody walking towards you out of sight is the oldest
       * cue there is.
       */
      const space = reverb(ac, 2.6, 2.2);
      const wet = ac.createGain();
      wet.gain.value = 0.4;
      if (space) {
        space.connect(wet).connect(out);
        sink.nodes.push(space, wet);
      }
      const room = space ?? out;

      bed(ac, sink, out, { low: 110, high: 700, level: 0.09, swell: 0.025, swellHz: 0.018 });
      bed(ac, sink, room, { low: 500, high: 2600, level: 0.05, swell: 0.02, swellHz: 0.03 });
      // Air moving through an arcade, as texture.
      grains(ac, sink, out, { rate: 40, low: 1200, high: 4000, level: 0.014, decay: 0.03 });

      /*
       * The bell, made gentle: fewer partials and a softer set of them, a
       * fraction of the old level, and often enough to be expected rather than
       * rare enough to be an omen. Tolling is the frightening version of this.
       */
      occasionally(sink, 15, () => {
        struck(ac, room, { hz: 293.66, level: 0.07, decay: 3.4, partials: [1, 2, 3] });
      });
    },
  },
];

export const SCENE_BY_ID: Record<string, Scene> = Object.fromEntries(
  SCENES.map((s) => [s.id, s]),
);

export function isSceneId(v: unknown): v is SceneId {
  return typeof v === 'string' && v in SCENE_BY_ID;
}
