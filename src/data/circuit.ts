import type { Exercise } from '../types';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * CIRCUIT LIBRARY — the pool a HIIT or a sequential circuit is built from.
 *
 * Deliberately kept OUT of `EXERCISES`. That array is the near-frozen gym and
 * rehab programme, and it is what the "add an exercise" pickers offer; dropping
 * twenty-seven bodyweight movements into it would dilute a selection that was
 * made one exercise at a time. These are a separate pool, resolvable by id
 * through `EXERCISE_BY_ID` so history and trackers find them, and offered only
 * where a circuit is being built.
 *
 * ── The exclusion table still governs this file ────────────────────────────
 *
 * Everything here is bodyweight, dip bars or a band, and every entry had to
 * survive the same test as the gym library (see
 * .claude/skills/session-content/SKILL.md). What that ruled out, and why it is
 * worth writing down rather than rediscovering:
 *
 *   · Burpees, mountain climbers, spiderman planks — repeated end-range lumbar
 *     flexion, fast and fatigued. Doing the excluded movement quickly does not
 *     make it safer; it makes it worse.
 *   · Jumping jacks, jump squats, jump lunges, skipping — repeated landing
 *     impact spiking axial compression on a disc. `x-march` and `x-step-touch`
 *     are here to cover the same job without the landings.
 *   · Hanging or dip-bar knee raises, V-ups, flutter kicks, Russian twists —
 *     loaded flexion, and in the last case flexion plus rotation.
 *   · The McGill Big 3 (dead bug, side plank, bird dog) are absent on purpose.
 *     They are judged on position, not on speed, and against a clock while
 *     fatigued the position degrades into flexion. They stay in the spine
 *     block, untimed. This is the same rule `hiitSession()` enforces in code.
 *
 * `x-pallof` is the deliberate inverse of the loaded-rotation exclusion: it
 * resists rotation rather than producing it, which is the trunk quality a
 * protruding disc actually wants.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** What you need to hand. Drives the filter in the builder. */
export type Equipment = 'bodyweight' | 'dip-bars' | 'band' | 'box';

/** Movement pattern. Used to keep a generated circuit from stacking three
 *  presses in a row — alternating patterns is most of what makes a circuit
 *  tolerable. */
export type Pattern = 'squat' | 'hinge' | 'push' | 'pull' | 'core' | 'conditioning';

export interface CircuitExercise extends Exercise {
  equipment: Equipment[];
  pattern: Pattern;
}

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  bodyweight: 'Bodyweight',
  'dip-bars': 'Dip bars',
  band: 'Band',
  box: 'Box or step',
};

export const PATTERN_LABEL: Record<Pattern, string> = {
  squat: 'Legs',
  hinge: 'Hips',
  push: 'Push',
  pull: 'Pull',
  core: 'Trunk',
  conditioning: 'Conditioning',
};

export const PATTERN_ORDER: Pattern[] = [
  'squat',
  'hinge',
  'push',
  'pull',
  'core',
  'conditioning',
];

export const CIRCUIT_EXERCISES: CircuitExercise[] = [
  // ── Legs ──────────────────────────────────────────────────────────────────
  {
    id: 'x-squat',
    name: 'Air squat',
    block: 'main',
    prescription: '3 × 15 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [15, 15, 15],
    restSeconds: 60,
    execution:
      'Feet slightly wider than the shoulders, weight through the whole foot. Hips travel back ' +
      'and down, chest stays proud, arms counterbalance in front. Go to the depth where the low ' +
      'back is still neutral and stop there — the tuck at the bottom is lumbar flexion.',
    cue: 'Hips back, chest proud.',
    why:
      'The cheapest way to load the legs with nothing on the spine. It also rehearses the hinge ' +
      'that every loaded lift in the gym sessions depends on, so the pattern is grooved on days ' +
      'with no barbell anywhere near it.',
    animation: 'squat',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'squat',
  },
  {
    id: 'x-split-squat',
    name: 'Split squat',
    block: 'main',
    prescription: '3 × 10 per side · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [10, 10, 10],
    restSeconds: 60,
    execution:
      'One foot forward, one back, torso upright and stacked over the hips. Drop the back knee ' +
      'straight down towards the floor, then press through the front foot to stand. Both legs ' +
      'before the set counts. No forward lean — that lean is where the back starts working.',
    cue: 'Straight down, torso stacked.',
    why:
      'Single-leg strength without the axial load of a barbell, and the stance itself is an ' +
      'anti-rotation task for the trunk. Unilateral work matters here because an asymmetric hip ' +
      'is one of the ways a disc gets loaded unevenly in the first place.',
    animation: 'squat',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'squat',
  },
  {
    id: 'x-reverse-lunge',
    name: 'Reverse lunge',
    block: 'main',
    prescription: '3 × 10 per side · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [10, 10, 10],
    restSeconds: 60,
    execution:
      'Stand tall, step one foot back and lower the knee towards the floor, then drive through ' +
      'the front leg to return. Alternate sides. Keep the torso vertical throughout; if you have ' +
      'to lean to get back up, shorten the step.',
    cue: 'Step back, stand tall.',
    why:
      'Stepping backwards rather than forwards means nothing has to be decelerated on landing, so ' +
      'the knee and the disc both get an easier ride than a forward lunge or a jumping one. The ' +
      'jump variants are excluded for exactly that reason.',
    animation: 'squat',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'squat',
  },
  {
    id: 'x-step-up',
    name: 'Step-up',
    block: 'main',
    prescription: '3 × 10 per side · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [10, 10, 10],
    restSeconds: 60,
    execution:
      'Box at roughly knee height. Place the whole foot on it, stand up by pushing through that ' +
      'leg rather than pushing off the floor with the trailing one, then lower under control. ' +
      'Both legs before the set counts.',
    cue: 'Push through the top foot.',
    why:
      'Hip and knee extension through a long range with no impact and no load on the spine, which ' +
      'makes it the one leg movement that is almost always available on a bad back day. Lowering ' +
      'under control is half the point — that eccentric is what the climbing descent asks for.',
    animation: 'walk',
    loadTracked: false,
    equipment: ['box'],
    pattern: 'squat',
  },
  {
    id: 'x-wall-sit',
    name: 'Wall sit',
    block: 'main',
    prescription: '3 × 40 sec hold · rest 60 sec',
    tracking: 'hold',
    sets: 3,
    repScheme: [1, 1, 1],
    holdSeconds: 40,
    restSeconds: 60,
    execution:
      'Back flat against the wall, feet forward, slide down until the knees are near 90°. The ' +
      'whole low back stays in contact with the wall — if it lifts away, walk the feet in. Breathe ' +
      'normally rather than bracing and holding your breath.',
    cue: 'Low back pinned to the wall.',
    why:
      'An isometric that builds quad endurance with the lumbar spine supported and completely ' +
      'still. That makes it a better interval station than any squat jump: the metabolic cost is ' +
      'high and the mechanical cost to the disc is zero.',
    animation: 'squat',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'squat',
  },
  {
    id: 'x-calf-raise',
    name: 'Calf raise',
    block: 'main',
    prescription: '3 × 20 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [20, 20, 20],
    restSeconds: 60,
    execution:
      'Stand tall, rise onto the toes as high as the ankle will go, pause at the top, lower all ' +
      'the way down under control. Fingertips on a wall for balance if needed. Slow at both ends ' +
      'rather than bouncing.',
    cue: 'All the way up, all the way down.',
    why:
      'Calf and foot endurance is what holds a small edge, and it is the one thing on this list ' +
      'that asks nothing at all of the spine. Useful as the station that lets the low back rest ' +
      'while the heart rate stays up.',
    animation: 'walk',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'squat',
  },

  // ── Hips ──────────────────────────────────────────────────────────────────
  {
    id: 'x-glute-bridge',
    name: 'Glute bridge',
    block: 'main',
    prescription: '3 × 15 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [15, 15, 15],
    restSeconds: 60,
    execution:
      'On your back, knees bent, feet flat and close to the hips. Press through the heels and ' +
      'lift the hips until the body is straight from knee to shoulder. The movement finishes with ' +
      'the glutes, not by arching the low back — ribs stay down.',
    cue: 'Finish with the glutes, not the back.',
    why:
      'Hip extension strength is what stops the lumbar spine standing in for the glutes, which is ' +
      'the most common way a protrusion gets re-provoked walking around. Supine, so the disc is ' +
      'unloaded throughout.',
    animation: 'hipThrust',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'hinge',
  },
  {
    id: 'x-single-leg-bridge',
    name: 'Single-leg glute bridge',
    block: 'main',
    prescription: '3 × 10 per side · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [10, 10, 10],
    restSeconds: 60,
    execution:
      'Set up as the bridge, then extend one leg straight. Drive through the planted heel and ' +
      'lift until the hips are level — the test is that the free hip does not drop. Both sides ' +
      'before the set counts.',
    cue: 'Hips stay level.',
    why:
      'The progression from the bridge, and a direct check on which side is doing less. Keeping ' +
      'the pelvis level under a one-sided load is the same quality the bird dog trains, which is ' +
      'why it earns a place where a loaded rotation never would.',
    animation: 'hipThrust',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'hinge',
  },
  {
    id: 'x-band-rdl',
    name: 'Band RDL',
    block: 'main',
    prescription: '3 × 15 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [15, 15, 15],
    restSeconds: 60,
    execution:
      'Stand on the band, hold both ends at the hips. Push the hips back with a long straight ' +
      'back, feeling the hamstrings load, and stop the moment the back wants to round. Stand by ' +
      'driving the hips forward. Knees stay softly bent, never locked.',
    cue: 'Hips back. Stop before it rounds.',
    why:
      'The hinge pattern with tension that increases as you stand rather than as you bend over — ' +
      'the opposite of a barbell, and much kinder to the bottom position. It is the drill that ' +
      'makes the loaded RDL in session B safe, rehearsed with nothing to drop.',
    animation: 'hinge',
    loadTracked: false,
    equipment: ['band'],
    pattern: 'hinge',
  },
  {
    id: 'x-monster-walk',
    name: 'Band lateral walk',
    block: 'main',
    prescription: '3 × 20 steps · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [20, 20, 20],
    restSeconds: 60,
    execution:
      'Band around the ankles or just above the knees, feet hip-width, small bend in the knees. ' +
      'Step sideways against the band, keeping the feet pointing forward and the torso still. ' +
      'Count a step on each side. Do not let the band pull the knees inwards.',
    cue: 'Torso still, knees out.',
    why:
      'Glute medius work, which is what keeps the pelvis level when you stand on one leg. A weak ' +
      'one shows up as a hip drop, and a hip drop is lateral flexion of the lumbar spine on every ' +
      'single step.',
    animation: 'walk',
    loadTracked: false,
    equipment: ['band'],
    pattern: 'hinge',
  },

  // ── Push ──────────────────────────────────────────────────────────────────
  {
    id: 'x-pushup',
    name: 'Push-up',
    block: 'main',
    prescription: '3 × 12 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 60,
    execution:
      'Hands under the shoulders, body straight from heel to head, ribs down and glutes squeezed. ' +
      'Lower until the chest is a fist off the floor, press back up. If the hips start to sag, ' +
      'stop the set — that sag is lumbar extension under load.',
    cue: 'Straight line. Squeeze the glutes.',
    why:
      'Pressing strength and a moving plank in one movement. The trunk work is the reason it is ' +
      'the anchor push of this library: holding the line while the arms work is exactly the ' +
      'quality that protects the back when you are tired.',
    animation: 'pushup',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'push',
  },
  {
    id: 'x-incline-pushup',
    name: 'Incline push-up',
    block: 'main',
    prescription: '3 × 15 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [15, 15, 15],
    restSeconds: 60,
    execution:
      'Hands on the dip bars, a box or a bench, body straight from heel to head. The higher the ' +
      'hands, the easier it is. Lower the chest to the hands, press back up, holding the straight ' +
      'line the whole way.',
    cue: 'Raise the hands before you drop the hips.',
    why:
      'The regression that keeps the pattern honest. A sagging push-up trains lumbar extension ' +
      'under load; an incline one does not, so on a tired day this is the correct choice rather ' +
      'than the lesser one.',
    animation: 'pushup',
    loadTracked: false,
    equipment: ['dip-bars', 'box'],
    pattern: 'push',
  },
  {
    id: 'x-pike-pushup',
    name: 'Pike push-up',
    block: 'main',
    prescription: '3 × 8 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [8, 8, 8],
    restSeconds: 60,
    execution:
      'From a push-up position, walk the feet in until the hips are high and the body makes a V. ' +
      'Lower the crown of the head towards the floor between the hands, then press back up. Keep ' +
      'the knees as straight as the hamstrings allow without the back rounding.',
    cue: 'Hips high, head between the hands.',
    why:
      'The overhead press pattern with the load going through the arms into the floor instead of ' +
      'down through the spine. That is the whole reason it is here and the standing overhead ' +
      'press is not: same shoulder work, none of the axial compression plus lumbar extension.',
    animation: 'pushup',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'push',
  },
  {
    id: 'x-diamond-pushup',
    name: 'Close-grip push-up',
    block: 'main',
    prescription: '3 × 10 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [10, 10, 10],
    restSeconds: 60,
    execution:
      'Hands close together under the chest, elbows tracking back along the ribs rather than ' +
      'flaring out. Same straight line as a normal push-up. Lower until the chest touches the ' +
      'hands, press up.',
    cue: 'Elbows back along the ribs.',
    why:
      'Triceps and lockout strength, which is what the dip and the bench both run out of first. ' +
      'Harder than a push-up with no extra cost to the spine, so it is the way to make this ' +
      'station harder without adding load.',
    animation: 'pushup',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'push',
  },
  {
    id: 'x-dips',
    name: 'Dips',
    block: 'main',
    prescription: '3 × 8 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [8, 8, 8],
    restSeconds: 60,
    execution:
      'On the bars, arms locked, shoulders down away from the ears. Lower until the upper arms ' +
      'are roughly parallel to the floor, then press back up. Keep a slight forward lean and the ' +
      'ribs down. Stop the set if the shoulders start to shrug up.',
    cue: 'Shoulders down, ribs down.',
    why:
      'The strongest pressing pattern available without a bench, and the bars mean the spine is ' +
      'hanging rather than compressed. Depth is capped at parallel on purpose — below that the ' +
      'shoulder pays for it and nothing useful is added.',
    animation: 'dip',
    loadTracked: false,
    equipment: ['dip-bars'],
    pattern: 'push',
  },
  {
    id: 'x-support-hold',
    name: 'Support hold',
    block: 'main',
    prescription: '3 × 30 sec hold · rest 60 sec',
    tracking: 'hold',
    sets: 3,
    repScheme: [1, 1, 1],
    holdSeconds: 30,
    restSeconds: 60,
    execution:
      'On the dip bars, arms straight and locked, shoulders actively pulled down away from the ' +
      'ears, legs together and still. Ribs down so the low back does not arch. Breathe through ' +
      'the hold rather than holding your breath.',
    cue: 'Shoulders down, ribs down, still.',
    why:
      'Straight-arm scapular strength, which is what holds a shoulder together on a long reach. ' +
      'It is also a traction position: the spine is suspended between the arms, so it is one of ' +
      'the few hard stations that unloads the disc while you do it.',
    animation: 'dip',
    loadTracked: false,
    equipment: ['dip-bars'],
    pattern: 'push',
  },

  // ── Pull ──────────────────────────────────────────────────────────────────
  {
    id: 'x-inverted-row',
    name: 'Inverted row',
    block: 'main',
    prescription: '3 × 12 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 60,
    execution:
      'Bar or dip bar at hip height, heels on the floor, body straight from heel to shoulder. ' +
      'Pull the chest to the bar leading with the elbows, pause, lower under control. Raise the ' +
      'bar to make it easier rather than letting the hips drop.',
    cue: 'One straight line. Hips do not sag.',
    why:
      'A horizontal pull that costs the spine nothing — the trunk is rigid and horizontal, so ' +
      'there is no loaded flexion at any point in it. This is the movement that makes bent-over ' +
      'rows unnecessary rather than merely forbidden.',
    animation: 'row',
    loadTracked: false,
    equipment: ['dip-bars', 'box'],
    pattern: 'pull',
  },
  {
    id: 'x-band-row',
    name: 'Band row',
    block: 'main',
    prescription: '3 × 15 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [15, 15, 15],
    restSeconds: 60,
    execution:
      'Anchor the band at chest height and step back until it is taut. Stand or sit tall, pull ' +
      'both handles to the ribs leading with the elbows, squeeze the shoulder blades together, ' +
      'return under control. The torso stays upright and does not rock.',
    cue: 'Elbows to the ribs, torso still.',
    why:
      'Mid-back work with the torso vertical, which is the entire difference between this and a ' +
      'bent-over row: the load pulls horizontally instead of hanging off a flexed spine. Anchor ' +
      'it to a door and it travels, which is the point of the band.',
    animation: 'row',
    loadTracked: false,
    equipment: ['band'],
    pattern: 'pull',
  },
  {
    id: 'x-band-pulldown',
    name: 'Band pulldown',
    block: 'main',
    prescription: '3 × 15 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [15, 15, 15],
    restSeconds: 60,
    execution:
      'Anchor the band high — a door frame or the top of the bars. Kneel or stand tall, arms ' +
      'overhead, pull the hands down and out to the sides of the chest, leading with the elbows. ' +
      'Let it return slowly. Ribs stay down rather than arching back to get more range.',
    cue: 'Lead with the elbows, ribs down.',
    why:
      'The lat pattern without a machine. Arching the back to finish the rep is the failure mode ' +
      'and the reason the cue is about the ribs: once the lumbar spine extends to help, the lats ' +
      'have stopped working and the back has started.',
    animation: 'pull',
    loadTracked: false,
    equipment: ['band'],
    pattern: 'pull',
  },
  {
    id: 'x-band-pull-apart',
    name: 'Band pull-apart',
    block: 'main',
    prescription: '3 × 20 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [20, 20, 20],
    restSeconds: 60,
    execution:
      'Band at chest height, arms straight out in front, hands shoulder-width. Pull the band ' +
      'apart until the arms are wide, leading from the shoulder blades, then return slowly. ' +
      'Elbows stay straight and the ribs stay down throughout.',
    cue: 'Lead from the shoulder blades.',
    why:
      'Direct work for the muscles that hold the shoulders back, which climbing systematically ' +
      'shortens on the other side. Cheap, high rep, and it can go anywhere in a circuit as the ' +
      'station that lets the legs recover.',
    animation: 'pullApart',
    loadTracked: false,
    equipment: ['band'],
    pattern: 'pull',
  },
  {
    id: 'x-band-face-pull',
    name: 'Band face pull',
    block: 'main',
    prescription: '3 × 15 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [15, 15, 15],
    restSeconds: 60,
    execution:
      'Anchor the band at face height. Pull both ends towards the forehead, elbows high and wide, ' +
      'finishing with the hands either side of the head and the shoulder blades squeezed. Return ' +
      'slowly. Stand tall — do not lean back to pull harder.',
    cue: 'Elbows high, hands past the ears.',
    why:
      'Rear delts and the external rotators in one movement, which is the combination that keeps ' +
      'a climbing shoulder healthy. Standing tall rather than leaning back is what keeps it a ' +
      'shoulder exercise instead of a lumbar one.',
    animation: 'pullApart',
    loadTracked: false,
    equipment: ['band'],
    pattern: 'pull',
  },
  {
    id: 'x-band-curl',
    name: 'Band curl',
    block: 'main',
    prescription: '3 × 15 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [15, 15, 15],
    restSeconds: 60,
    execution:
      'Stand on the band, hold the ends with the palms forward, elbows pinned to the ribs. Curl ' +
      'to the shoulders, lower slowly all the way to straight. The torso does not move — if you ' +
      'have to swing, the band is too strong.',
    cue: 'Elbows pinned, torso still.',
    why:
      'Elbow flexor work with a resistance curve that peaks where the arm is strongest, which is ' +
      'easier on an elbow than a dumbbell. Climbers need the tendon tolerance more than the size, ' +
      'and high-rep band work is a kind way to build it.',
    animation: 'curl',
    loadTracked: false,
    equipment: ['band'],
    pattern: 'pull',
  },
  {
    id: 'x-band-pushdown',
    name: 'Band pushdown',
    block: 'main',
    prescription: '3 × 15 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [15, 15, 15],
    restSeconds: 60,
    execution:
      'Anchor the band high. Elbows at the ribs and still, press the hands down until the arms ' +
      'are straight, then let them return slowly. Stand tall with the ribs down; the only thing ' +
      'moving is the forearm.',
    cue: 'Only the forearm moves.',
    why:
      'Triceps work that needs no load on the trunk at all, which makes it a useful pairing for a ' +
      'station where the legs or the back need a break. Lockout strength is what the dip runs out ' +
      'of first.',
    animation: 'curl',
    loadTracked: false,
    equipment: ['band'],
    pattern: 'pull',
  },

  // ── Trunk ─────────────────────────────────────────────────────────────────
  {
    id: 'x-plank',
    name: 'Front plank',
    block: 'main',
    prescription: '3 × 40 sec hold · rest 60 sec',
    tracking: 'hold',
    sets: 3,
    repScheme: [1, 1, 1],
    holdSeconds: 40,
    restSeconds: 60,
    execution:
      'Forearms and toes on the floor, elbows under the shoulders, body straight from heel to ' +
      'head. Squeeze the glutes and keep the ribs down so the low back does not sag. Breathe ' +
      'normally. End the hold when the position goes, not when the timer does.',
    cue: 'Glutes on, ribs down.',
    why:
      'Anti-extension trunk endurance, which is the quality that stops the lumbar spine sagging ' +
      'into its end range when you are tired. It is here instead of any sit-up variant: same ' +
      'muscles, none of the repeated flexion that provokes a protrusion.',
    animation: 'frontplank',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'core',
  },
  {
    id: 'x-bear-hold',
    name: 'Bear hold',
    block: 'main',
    prescription: '3 × 30 sec hold · rest 60 sec',
    tracking: 'hold',
    sets: 3,
    repScheme: [1, 1, 1],
    holdSeconds: 30,
    restSeconds: 60,
    execution:
      'On hands and knees, hands under the shoulders and knees under the hips. Tuck the tailbone ' +
      'slightly so the low back is flat, then hover the knees a couple of centimetres off the ' +
      'floor and hold. The back does not move. Small hover, long hold.',
    cue: 'Flat back, knees just off the floor.',
    why:
      'The hardest trunk brace available with the spine in a completely neutral position — the ' +
      'whole task is refusing to move. That is the opposite of a crunch, and it is the quality ' +
      'the Big 3 are built around, which is why it transfers.',
    animation: 'frontplank',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'core',
  },
  {
    id: 'x-pallof',
    name: 'Band Pallof press',
    block: 'main',
    prescription: '3 × 10 per side · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [10, 10, 10],
    restSeconds: 60,
    execution:
      'Anchor the band at chest height and stand side-on to it, hands together at the sternum. ' +
      'Press the hands straight out in front and bring them back, refusing to let the band turn ' +
      'you. The hips and shoulders stay square the whole time. Both sides before the set counts.',
    cue: 'Stay square. Nothing rotates.',
    why:
      'Loaded rotation is the one combination this programme never allows, and this is its ' +
      'inverse: the band tries to rotate you and the job is to resist. Building that resistance ' +
      'is what makes the twist you cannot avoid in daily life a non-event.',
    animation: 'press',
    loadTracked: false,
    equipment: ['band'],
    pattern: 'core',
  },

  // ── Conditioning ──────────────────────────────────────────────────────────
  {
    id: 'x-march',
    name: 'Marching in place',
    block: 'main',
    prescription: '3 × 40 sec · rest 45 sec',
    tracking: 'hold',
    sets: 3,
    repScheme: [1, 1, 1],
    holdSeconds: 40,
    restSeconds: 45,
    execution:
      'Stand tall and drive the knees up to hip height alternately, swinging the opposite arm. ' +
      'The foot lands flat and quiet — this is a march, not a run. Keep the torso vertical and ' +
      'the ribs down rather than leaning back as it gets hard.',
    cue: 'Knees up, feet quiet.',
    why:
      'Gets the heart rate up with one foot on the floor at all times, so there is no landing ' +
      'impact and no axial spike. It is the replacement for jumping jacks and skipping, both of ' +
      'which are excluded for the landings rather than the effort.',
    animation: 'walk',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'conditioning',
  },
  {
    id: 'x-step-touch',
    name: 'Lateral step-touch',
    block: 'main',
    prescription: '3 × 40 sec · rest 45 sec',
    tracking: 'hold',
    sets: 3,
    repScheme: [1, 1, 1],
    holdSeconds: 40,
    restSeconds: 45,
    execution:
      'Step out to one side and bring the other foot to meet it, then reverse, keeping a low ' +
      'athletic bend in the knees. Arms swing naturally. Stay low and quiet; do not bounce ' +
      'upwards between steps.',
    cue: 'Stay low, stay quiet.',
    why:
      'Sideways conditioning that loads the hips in the frontal plane, which almost nothing else ' +
      'in the programme does. No impact and no rotation under load, so it adds a direction of ' +
      'movement without adding risk.',
    animation: 'walk',
    loadTracked: false,
    equipment: ['bodyweight'],
    pattern: 'conditioning',
  },
];

export const CIRCUIT_BY_ID: Record<string, CircuitExercise> = Object.fromEntries(
  CIRCUIT_EXERCISES.map((e) => [e.id, e]),
);

/** Grouped for the builder's picker, in pattern order. */
export function circuitByPattern(): Array<{ pattern: Pattern; exercises: CircuitExercise[] }> {
  return PATTERN_ORDER.map((pattern) => ({
    pattern,
    exercises: CIRCUIT_EXERCISES.filter((e) => e.pattern === pattern),
  })).filter((g) => g.exercises.length > 0);
}

/** Everything doable with the kit to hand. `bodyweight` is always available. */
export function circuitFor(available: Equipment[]): CircuitExercise[] {
  const kit = new Set<Equipment>([...available, 'bodyweight']);
  return CIRCUIT_EXERCISES.filter((e) => e.equipment.some((need) => kit.has(need)));
}
