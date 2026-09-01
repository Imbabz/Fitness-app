/*
 * Four places.
 *
 * Each is a recipe over the generators in scene.ts, and each is written to a
 * specific image rather than to a mood word — because "calm" produces a pad and
 * "a tent at night while it rains" produces a scene. The comments name what
 * each layer is meant to be, so a later reader can tell whether it still is.
 *
 * The bands are the load-bearing part. Nothing here is arbitrary: each layer
 * sits where that source actually lives, and moving one an octave is enough to
 * turn a place back into generic noise.
 */

import { reverb, type Sink } from './audio';
import { babble, bed, call, far, grains, occasionally, struck, thump } from './scene';

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
    label: 'Marché',
    note: 'A market square, late morning',
    build(ac, sink, out) {
      const space = reverb(ac, 2.4, 2.6);
      const wet = ac.createGain();
      wet.gain.value = 0.22;
      if (space) {
        space.connect(wet).connect(out);
        sink.nodes.push(space, wet);
      }

      // The crowd. Six voices at different syllable rates: any fewer and you
      // hear individuals, any more and it smooths back into hiss.
      babble(ac, sink, out, { level: 0.34, voices: 6 });
      // The low body of a covered square full of people.
      bed(ac, sink, out, { low: 140, high: 700, level: 0.05, swell: 0.02, swellHz: 0.03 });

      // Footfall and cartwheels on stone, irregular and constant.
      thump(ac, sink, out, { mean: 0.9, hz: 95, level: 0.1, decay: 0.28 });
      thump(ac, sink, out, { mean: 3.4, hz: 62, level: 0.11, decay: 0.5 });

      // Crates, hooves, wooden clatter — the mid-high events that make a market
      // busy rather than merely populated.
      grains(ac, sink, out, { rate: 3.2, low: 900, high: 3800, level: 0.22, decay: 0.09 });

      // A smith, a few streets away. Rare, and behind everything.
      const distance = far(ac, sink, space ?? out, { cutoff: 2200, level: 0.5 });
      occasionally(sink, 11, () => {
        const hits = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < hits; i++) {
          window.setTimeout(
            () => struck(ac, distance, { hz: 620 + Math.random() * 160, level: 0.16, decay: 0.5, partials: [1, 2.4, 4.1] }),
            i * (240 + Math.random() * 90),
          );
        }
      });

      // The church, on the hour. The only pitched thing here, and it is far off.
      occasionally(sink, 46, () =>
        struck(ac, distance, { hz: 196, level: 0.3, decay: 7 }),
      );
    },
  },

  {
    id: 'tent',
    label: 'Tente',
    note: 'Under canvas, raining, night',
    build(ac, sink, out) {
      /*
       * Rain on fabric is not rain in the open, and the difference is entirely
       * in the top end: canvas damps everything above about 3kHz, so the hiss
       * that makes open rain sound bright is simply absent. What is left is the
       * drumming — thousands of small damped impacts in the 800-3000Hz band.
       */
      grains(ac, sink, out, { rate: 70, low: 900, high: 3000, level: 0.19, decay: 0.03 });
      // The muffled wash of everything falling further away, off the fly sheet.
      bed(ac, sink, out, { low: 400, high: 2200, level: 0.13, swell: 0.05, swellHz: 0.04 });
      // The canvas itself has a body. Without this it sounds like rain with no
      // tent around it.
      bed(ac, sink, out, { low: 70, high: 220, level: 0.05, swell: 0.025, swellHz: 0.021 });

      // Gusts pushing the fly: a slow low swell, and the fabric answering it.
      bed(ac, sink, out, { low: 45, high: 150, level: 0.03, swell: 0.026, swellHz: 0.013 });
      grains(ac, sink, out, { rate: 0.7, low: 200, high: 1100, level: 0.16, decay: 0.22 });

      // A pole or guy line taking the wind.
      thump(ac, sink, out, { mean: 13, hz: 70, level: 0.1, decay: 0.6 });

      // Thunder, far enough away to be weather rather than an event.
      const distance = far(ac, sink, out, { cutoff: 260, level: 0.85 });
      occasionally(sink, 52, () => {
        struck(ac, distance, { hz: 44, level: 0.34, decay: 5.5, partials: [1, 1.4, 2.1] });
      });
    },
  },

  {
    id: 'campfire',
    label: 'Feu de camp',
    note: 'A fire outside, wind in the leaves',
    build(ac, sink, out) {
      // The fire's roar. Low and narrow — the part you feel more than hear.
      bed(ac, sink, out, { low: 60, high: 300, level: 0.055, swell: 0.022, swellHz: 0.07 });
      // Crackles: sharp, bright, and wildly irregular. Regular spacing here is
      // the fastest way to sound like a machine.
      grains(ac, sink, out, { rate: 7, low: 1100, high: 4600, level: 0.3, decay: 0.05 });
      // The occasional pop as something gives.
      occasionally(sink, 7, () =>
        struck(ac, out, { hz: 300 + Math.random() * 500, level: 0.2, decay: 0.18, partials: [1, 3.2] }),
      );

      /*
       * Leaves. This is the layer that makes it outdoors, and it is granular,
       * not smooth: a rustle is thousands of tiny separate collisions at
       * 2-8kHz. Filtering white noise into that band gives a hiss; only the
       * grain rate gives leaves.
       */
      grains(ac, sink, out, { rate: 130, low: 2400, high: 8000, level: 0.12, decay: 0.02 });
      // Gusts moving through the canopy, well below the leaves themselves.
      bed(ac, sink, out, { low: 200, high: 1100, level: 0.05, swell: 0.04, swellHz: 0.016 });

      // Night birds and insects, far off and rare. Two different characters so
      // it does not become one repeating call.
      const distance = far(ac, sink, out, { cutoff: 4000, level: 0.45 });
      occasionally(sink, 26, () =>
        call(ac, distance, { hz: 420 + Math.random() * 90, level: 0.2, seconds: 0.5, vibrato: 18, sweep: 0.86 }),
      );
      occasionally(sink, 17, () => {
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          window.setTimeout(
            () => call(ac, distance, { hz: 3600 + Math.random() * 900, level: 0.07, seconds: 0.06 }),
            i * (110 + Math.random() * 70),
          );
        }
      });
    },
  },

  {
    // Not 'cloister': that id belongs to the composed theme, and a scene
    // taking it would make the theme unreachable.
    id: 'abbey',
    label: 'Abbaye',
    note: 'Stone, a bell, a long way from anyone',
    build(ac, sink, out) {
      /*
       * The one place where pitch belongs — but as architecture, not melody.
       * A cloister is defined by its reverb: six seconds of stone, and
       * everything in it arrives already decayed.
       */
      const space = reverb(ac, 6, 1.6);
      const wet = ac.createGain();
      wet.gain.value = 0.55;
      if (space) {
        space.connect(wet).connect(out);
        sink.nodes.push(space, wet);
      }
      const room = space ?? out;

      // Air moving through an arcade. Almost nothing, but silence would be wrong.
      bed(ac, sink, out, { low: 110, high: 700, level: 0.045, swell: 0.025, swellHz: 0.02 });
      bed(ac, sink, room, { low: 500, high: 2800, level: 0.03, swell: 0.02, swellHz: 0.033 });

      // The bell. Rare enough that it is an event when it comes.
      occasionally(sink, 38, () => {
        struck(ac, room, { hz: 146.8, level: 0.42, decay: 9, partials: [1, 2, 2.76, 5.4, 8.2] });
      });

      // A second bell, higher and further, answering the first now and then.
      const distance = far(ac, sink, room, { cutoff: 1800, level: 0.4 });
      occasionally(sink, 71, () => {
        window.setTimeout(
          () => struck(ac, distance, { hz: 220, level: 0.32, decay: 7 }),
          1800 + Math.random() * 2400,
        );
      });

      // Footsteps on flagstones, somewhere out of sight.
      occasionally(sink, 34, () => {
        const steps = 3 + Math.floor(Math.random() * 5);
        for (let i = 0; i < steps; i++) {
          window.setTimeout(() => {
            struck(ac, room, { hz: 900 + Math.random() * 400, level: 0.07, decay: 0.1, partials: [1, 2.7] });
          }, i * (620 + Math.random() * 140));
        }
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
