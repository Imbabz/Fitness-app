import type { Exercise } from '../types';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * EXERCISE LIBRARY — treat as near-frozen.
 *
 * This selection is medically deliberate. It is built for a climber rehabbing
 * an L5-S1 disc protrusion. Do NOT add exercises here, however reasonable the
 * addition looks. If a change seems to call for a new movement, stop and ask.
 *
 * EXCLUDED BY DESIGN — do not "helpfully" add these later:
 *   · Bent-over barbell rows   — sustained loaded lumbar flexion under fatigue
 *   · Standing overhead press  — axial compression with lumbar extension
 *   · Crunches and sit-ups     — repeated end-range flexion, the exact
 *                                mechanism that provokes a posterior disc
 *                                protrusion (McGill's position)
 *   · Any loaded rotation      — flexion + rotation under load is the highest
 *                                risk combination for an annular tear
 *
 * The Jefferson curl is the one deliberate exception to the flexion rule: it is
 * loaded flexion, but very light, very slow, segmental, and always last in the
 * session on a warm spine. That is the entire reason the spine block renders
 * last and cannot be reordered.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Shared across all three gym sessions. */
const cardioWarmup = (id: string, note: string): Exercise => ({
  id,
  name: 'Bike or treadmill',
  block: 'warmup',
  prescription: '15 min easy',
  tracking: 'duration',
  sets: 1,
  repScheme: [1],
  durationSeconds: 900,
  restSeconds: 0,
  execution:
    'Conversational pace throughout. You should be able to hold a sentence. ' +
    'If the bike, keep the seat high enough that you are not rounding to reach the pedals.',
  cue: 'Easy. This is not the workout.',
  why:
    `Fifteen minutes of gentle circulation raises disc and soft-tissue temperature ` +
    `before anything is loaded. ${note} A cold spine under load is the specific ` +
    `thing this whole programme is arranged to avoid.`,
  animation: 'bike',
  loadTracked: false,
  alternates: ['alt-walk'],
});

const jeffersonCurl = (id: string): Exercise => ({
  id,
  name: 'Jefferson curl',
  block: 'spine',
  prescription: '3 × 12 · very light · 5s down / 5s up · rest 90 sec',
  tracking: 'reps',
  sets: 3,
  repScheme: [12, 12, 12],
  tempo: { down: 5, up: 5 },
  restSeconds: 90,
  execution:
    'Stand on a box, feet hip-width, holding a light weight in both hands. Tuck the chin, ' +
    'then roll down one vertebra at a time — the movement starts at the neck and travels ' +
    'downwards. Let the weight hang. Reverse the same way, stacking from the bottom up. ' +
    'Knees stay soft but do not bend to cheat range.',
  cue: 'One vertebra at a time. Nothing hinges.',
  why:
    'Controlled, graded, very light loaded flexion is what restores tolerance to flexion ' +
    'rather than avoiding it forever. The load stays trivial on purpose — the adaptation ' +
    'comes from the tempo and the segmental control, never from the weight. It sits last ' +
    'in the session because the spine has to be warm and the discs unloaded by the earlier work.',
  animation: 'roll',
  loadTracked: true,
});

export const EXERCISES: Exercise[] = [
  // ── Session A · Pull ──────────────────────────────────────────────────────
  cardioWarmup(
    'a-cardio',
    'It also settles the nervous system before pulling.',
  ),
  {
    id: 'a-shoulder-prep',
    name: 'Arm circles + scapular retractions',
    block: 'warmup',
    prescription: '2 × 15 · rest 30 sec',
    tracking: 'reps',
    sets: 2,
    repScheme: [15, 15],
    restSeconds: 30,
    execution:
      'Ten slow arm circles each direction, then hang from a bar or hold a light band and ' +
      'pull the shoulder blades down and back without bending the elbows. Pause one second at the back.',
    cue: 'Blades down, then back. Elbows stay straight.',
    why:
      'Wakes up the scapular stabilisers before they are asked to work under load. ' +
      'A pulling session driven by the arms rather than the back is how shoulders get irritated.',
    animation: 'scapRetract',
    loadTracked: false,
    alternates: ['b-band-pull-aparts'],
  },
  {
    id: 'a-lat-pulldown',
    name: 'Lat pulldown, wide grip',
    block: 'main',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Grip wider than shoulders. Sit tall with the thighs pinned. Lead with the elbows ' +
      'driving down and in; the bar arrives at the collarbone. Control the way back up — ' +
      'let the shoulder blades rise at the top without losing the trunk.',
    cue: 'Elbows into your back pockets.',
    why:
      'Vertical pulling is the direct transfer to climbing, and it loads the lats with the ' +
      'spine supported and vertical. No shear, no flexion — which is why it leads the session ' +
      'rather than a bent-over row.',
    animation: 'pull',
    loadTracked: true,
    alternates: ['c-chinups', 'alt-inverted-row'],
  },
  {
    id: 'a-cable-row',
    name: 'Seated cable row',
    block: 'main',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Chest up, slight forward lean from the hips at the stretch — the lower back stays ' +
      'neutral, it does not round to chase range. Pull to the navel, pause, return under control.',
    cue: 'Ribs down. The lower back does not move.',
    why:
      'Horizontal pulling balances all the vertical work climbing already provides. Seated and ' +
      'supported, this gets mid-back volume without the lumbar load of a bent-over row — which is ' +
      'the reason bent-over rows are absent from this programme entirely.',
    animation: 'row',
    loadTracked: true,
    alternates: ['c-chest-supported-row', 'alt-inverted-row'],
  },
  {
    id: 'a-pullups',
    name: 'Pull-ups (assisted or negatives)',
    block: 'main',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Full hang to chin over bar. If twelve clean reps are not there, use the assist machine ' +
      'or do slow negatives — jump to the top and take five seconds down. Keep the legs quiet; ' +
      'no kipping, no swinging.',
    cue: 'Start from a dead hang. No swing.',
    why:
      'The single most specific strength exercise for climbing. Negatives build the same tissue ' +
      'as full reps at a fraction of the technical cost. The no-swing rule is spinal, not aesthetic — ' +
      'a kip is a fast loaded lumbar extension.',
    animation: 'pullup',
    loadTracked: false,
    alternates: ['c-chinups'],
  },
  {
    id: 'a-hammer-wrist',
    name: 'Hammer curls + wrist flexion/extension',
    block: 'main',
    prescription: '3 × 12 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 60,
    execution:
      'Hammer curls with a neutral grip, elbows fixed at the sides. Then, forearm resting on ' +
      'the thigh, twelve wrist curls up and twelve down with a light dumbbell.',
    cue: 'Elbows pinned. No body English.',
    why:
      'Elbow and wrist prehab. Climbers load the finger flexors relentlessly and almost never ' +
      'load the extensors, and that imbalance is where medial and lateral elbow pain comes from.',
    animation: 'curl',
    loadTracked: true,
    alternates: ['c-pinch-block'],
  },
  jeffersonCurl('a-jefferson'),
  {
    id: 'a-deadlift',
    name: 'Deadlift, light (trap bar preferred)',
    block: 'spine',
    prescription: '3 × 12 · light · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Trap bar if the gym has one — it keeps the load in line with the hips and reduces the ' +
      'shear a straight bar creates. Set the back flat, take the slack out of the bar, then push ' +
      'the floor away. Lock out with the glutes, do not lean back. Reset the position every rep.',
    cue: 'Push the floor away. Back stays flat.',
    why:
      'A braced, neutral-spine hinge is the movement that makes the back robust again — the goal ' +
      'is not to avoid loading the spine but to load it in the position it is strongest in. Light and ' +
      'high-rep on purpose: this is a motor-pattern session, not a strength test.',
    animation: 'hinge',
    loadTracked: true,
    alternates: ['b-rdl', 'alt-kb-deadlift'],
  },

  // ── Session B · Push ──────────────────────────────────────────────────────
  cardioWarmup('b-cardio', 'It also loosens the thoracic spine before pressing.'),
  {
    id: 'b-band-pull-aparts',
    name: 'Band pull-aparts',
    block: 'warmup',
    prescription: '2 × 20 · rest 30 sec',
    tracking: 'reps',
    sets: 2,
    repScheme: [20, 20],
    restSeconds: 30,
    execution:
      'Light band at shoulder height, arms straight. Pull the band apart until it touches the ' +
      'chest, squeezing the shoulder blades. Return slowly — the return is half the exercise.',
    cue: 'Slow on the way back.',
    why:
      'Two minutes of rear-delt and mid-trap work before pressing keeps the shoulder centred in ' +
      'the socket. Push sessions without it are how climbers end up with impinged shoulders.',
    animation: 'pullApart',
    loadTracked: false,
    alternates: ['a-shoulder-prep'],
  },
  {
    id: 'b-bench',
    name: 'Bench press',
    block: 'main',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Feet flat, a natural arch only — do not bridge. Shoulder blades pulled down and back into ' +
      'the bench and kept there. Bar to the lower chest, elbows around 45°, press back over the shoulders.',
    cue: 'Blades in your back pocket. Glutes stay down.',
    why:
      'Antagonist strength for a pulling-dominated sport. The no-bridge instruction is the point: ' +
      'a heavy arch turns the bench into a lumbar extension exercise, which is the last thing an ' +
      'irritated L5-S1 needs.',
    animation: 'press',
    loadTracked: true,
    alternates: ['alt-floor-press', 'alt-pushup'],
  },
  {
    id: 'b-dips',
    name: 'Dips (assisted if needed)',
    block: 'main',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Descend until the upper arm is roughly parallel, no deeper. Keep a slight forward lean and ' +
      'the ribs down. Use the assist machine rather than cutting the rep count if twelve is not there.',
    cue: 'Stop at parallel. Ribs down.',
    why:
      'Builds the pressing chain through a long range, and the trunk has to stay braced throughout — ' +
      'useful anti-extension work that happens to look like an upper-body exercise. Depth is capped ' +
      'because below parallel the shoulder pays for very little extra.',
    animation: 'dip',
    loadTracked: false,
    alternates: ['alt-pushup', 'alt-floor-press'],
  },
  {
    id: 'b-shoulder-press',
    name: 'Seated dumbbell shoulder press',
    block: 'main',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Seated with the back supported. Start at ear height, press to just short of lockout. ' +
      'Ribs stay down against the pad — if the lower back arches off the bench, the weight is too heavy.',
    cue: 'Press up, not back. Low back on the pad.',
    why:
      'Seated and supported specifically instead of standing overhead press. Standing, the overhead ' +
      'press becomes an axial-compression exercise with a lumbar extension moment — a bad trade for a ' +
      'protruding disc. The back pad removes both.',
    animation: 'shoulderPress',
    loadTracked: true,
    alternates: ['alt-lateral-raise'],
  },
  {
    id: 'b-external-rotation',
    name: 'Cable external rotation + face pulls',
    block: 'main',
    prescription: '3 × 12 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 60,
    execution:
      'External rotation with the elbow tucked at the side, rotating from the shoulder not the wrist. ' +
      'Then face pulls at eye height — pull to the forehead, hands finishing wide, thumbs back.',
    cue: 'Rotate from the shoulder. Light is correct here.',
    why:
      'Direct rotator-cuff and rear-delt work. Everything else in this programme pulls the shoulders ' +
      'forward and down; this is what pulls them back. It is deliberately the lightest work in the block.',
    animation: 'externalRotation',
    loadTracked: true,
    alternates: ['alt-face-pull'],
  },
  jeffersonCurl('b-jefferson'),
  {
    id: 'b-rdl',
    name: 'Romanian deadlift, light',
    block: 'spine',
    prescription: '3 × 12 · light · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Soft knees, bar close to the legs. Push the hips back and let the bar travel down the thighs — ' +
      'stop the moment the lower back would start to round, which is usually mid-shin, often higher. ' +
      'Drive the hips forward to stand.',
    cue: 'Hips back, not down. Stop before the back rounds.',
    why:
      'Trains the hamstring and glute chain to own the hinge so the lumbar spine does not have to. ' +
      'The stopping rule matters more than the range: an RDL taken past neutral is just a slow ' +
      'loaded flexion with a barbell.',
    animation: 'hinge',
    loadTracked: true,
    alternates: ['a-deadlift', 'alt-kb-deadlift'],
  },

  // ── Session C · Mixed ─────────────────────────────────────────────────────
  cardioWarmup('c-cardio', 'It also gets blood into the forearms before grip work.'),
  {
    id: 'c-wrist-prep',
    name: 'Wrist prep + finger extensions',
    block: 'warmup',
    prescription: '2 × 15 · rest 30 sec',
    tracking: 'reps',
    sets: 2,
    repScheme: [15, 15],
    restSeconds: 30,
    execution:
      'Slow wrist circles both directions, then gentle flexion and extension stretches. Finish with ' +
      'finger extensions against a rubber band — open the hand fully against the resistance.',
    cue: 'Open the hand all the way.',
    why:
      'Prepares the forearms before grip work and, more importantly, trains the extensors that ' +
      'climbing never touches. This is the cheapest elbow-pain insurance available.',
    animation: 'wristRotate',
    loadTracked: false,
    alternates: ['a-shoulder-prep'],
  },
  {
    id: 'c-chinups',
    name: 'Chin-ups, supinated',
    block: 'main',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Underhand grip, shoulder width. Dead hang to chin over the bar. Legs quiet — no kipping. ' +
      'Assist or use negatives if twelve clean reps are not available.',
    cue: 'Dead hang start. Chest to the bar.',
    why:
      'The supinated grip shifts load onto the biceps and brachialis, giving the lats a different ' +
      'stimulus to session A and adding elbow-flexor strength that carries directly to steep climbing.',
    animation: 'pullup',
    loadTracked: false,
    alternates: ['a-pullups', 'a-lat-pulldown'],
  },
  {
    id: 'c-chest-supported-row',
    name: 'Chest-supported dumbbell row',
    block: 'main',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Chest on an inclined bench, dumbbells hanging. Row with the elbows tracking past the ribs, ' +
      'pause at the top, lower fully. The chest never leaves the pad.',
    cue: 'Chest stays glued to the bench.',
    why:
      'All the mid-back benefit of a bent-over row with the bench carrying the load the spine would ' +
      'otherwise carry. This substitution is the entire reason bent-over barbell rows are excluded.',
    animation: 'row',
    loadTracked: true,
    alternates: ['a-cable-row', 'alt-inverted-row'],
  },
  {
    id: 'c-farmers-carry',
    name: "Farmer's carry",
    block: 'main',
    prescription: '3 × 30-40 m · rest 90 sec',
    tracking: 'distance',
    sets: 3,
    repScheme: [1, 1, 1],
    distanceM: 35,
    restSeconds: 90,
    execution:
      'Heavy dumbbells or a trap bar. Stand tall, ribs stacked over the hips, shoulders down. ' +
      'Walk with short, quiet steps and do not let the trunk sway side to side. Set the weight ' +
      'down under control — do not drop and bend to it.',
    cue: 'Tall and quiet. Do not let the ribs flare.',
    why:
      'Loaded carries build grip and, more usefully here, teach the trunk to resist lateral bending ' +
      'under load with the spine in a neutral stack. It is the closest thing to a functional core ' +
      'exercise that never asks the spine to flex.',
    animation: 'carry',
    loadTracked: true,
  },
  {
    id: 'c-pinch-block',
    name: 'Pinch block holds + finger extensions',
    block: 'main',
    prescription: '3 × 5 · 10s holds · rest 90 sec',
    tracking: 'hold',
    sets: 3,
    repScheme: [5, 5, 5],
    holdSeconds: 10,
    restSeconds: 90,
    execution:
      'Pinch the block with the thumb opposed, lift and hold for ten seconds, set down. Five holds ' +
      'per set. Between sets, finger extensions against a band.',
    cue: 'Thumb does the work. Shoulder stays packed.',
    why:
      'Pinch strength is the grip type climbing training most often skips, and it is trained safely ' +
      'in isolation. Pairing it with extensions keeps the flexor/extensor balance honest.',
    animation: 'pinch',
    loadTracked: true,
    alternates: ['a-hammer-wrist'],
  },
  jeffersonCurl('c-jefferson'),
  {
    id: 'c-hip-thrust',
    name: 'Hip thrust',
    block: 'spine',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Upper back on a bench, feet flat and close. Tuck the pelvis slightly, then drive through the ' +
      'heels until the torso is parallel to the floor. Squeeze at the top for a full second. ' +
      'Do not hyperextend the lower back to gain height.',
    cue: 'Glutes finish the rep, not the lower back.',
    why:
      'Direct glute strength with the spine horizontal and unloaded — no compression at all. Strong ' +
      'glutes are what let the hips drive a hinge, which is what keeps load off L5-S1 in every other ' +
      'movement here. The pelvic tuck is what stops it becoming a lumbar extension exercise.',
    animation: 'hipThrust',
    loadTracked: true,
    alternates: ['b-rdl'],
  },

  // ── Daily · Restore (night) ───────────────────────────────────────────────
  {
    id: 'd-cobra',
    name: 'Light cobra / McKenzie',
    block: 'mobility',
    prescription: '1 × 10 · 3s holds',
    tracking: 'hold',
    sets: 1,
    repScheme: [10],
    holdSeconds: 3,
    restSeconds: 30,
    execution:
      'Face down, forearms under the shoulders. Press gently into a small extension, keeping the ' +
      'hips heavy on the floor. Hold three seconds and lower. Start on the forearms; only progress ' +
      'to straight arms over weeks, and never into pain.',
    cue: 'Hips stay on the floor. Small range.',
    why:
      'Extension is the direction that tends to move a posterior disc protrusion back towards centre. ' +
      'Forearms first because the aim is repeated gentle motion, not a maximal stretch — if symptoms ' +
      'move down the leg rather than up towards the back, stop and reduce the range.',
    animation: 'cobra',
    loadTracked: false,
    alternates: ['d-sphinx', 'd-standing-extension'],
  },
  {
    id: 'd-deadbug',
    name: 'Dead bug',
    block: 'mobility',
    prescription: '6 / 4 / 2 per side · 8s holds',
    tracking: 'hold',
    sets: 3,
    repScheme: [6, 4, 2],
    holdSeconds: 8,
    restSeconds: 30,
    bilateral: true,
    execution:
      'On your back, knees and hips at 90°, arms straight up. Press the lower back gently into the ' +
      'floor and keep it there. Extend the opposite arm and leg away, hold, return. Alternate sides.',
    cue: 'Lower back stays pressed into the floor.',
    why:
      "McGill's anti-extension brace. It trains the trunk to stay stiff while the limbs move — the " +
      'exact quality a disc needs — with the spine fully supported and at zero compression.',
    animation: 'deadbug',
    loadTracked: false,
    alternates: ['d-glute-bridge'],
  },
  {
    id: 'd-side-plank',
    name: 'Side plank',
    block: 'mobility',
    prescription: '6 / 4 / 2 per side · 8s holds',
    tracking: 'hold',
    sets: 3,
    repScheme: [6, 4, 2],
    holdSeconds: 8,
    restSeconds: 30,
    bilateral: true,
    execution:
      'On the elbow, knees bent to start or legs straight when ready. Lift the hips into a straight ' +
      'line from shoulder to knee. Hold eight seconds, lower, repeat. Both sides every set.',
    cue: 'Straight line. Do not let the hips sag back.',
    why:
      'Loads quadratus lumborum and the obliques with very little spinal compression, building the ' +
      'lateral stability that keeps the spine stacked under load.',
    animation: 'plank',
    loadTracked: false,
    alternates: ['d-side-plank-knees'],
  },
  {
    id: 'd-bird-dog',
    name: 'Bird dog',
    block: 'mobility',
    prescription: '6 / 4 / 2 per side · 8s holds',
    tracking: 'hold',
    sets: 3,
    repScheme: [6, 4, 2],
    holdSeconds: 8,
    restSeconds: 30,
    bilateral: true,
    execution:
      'On hands and knees, spine neutral. Extend the opposite arm and leg to horizontal without ' +
      'letting the hips rotate. Hold eight seconds. Sweep the elbow and knee together underneath ' +
      'between reps rather than resting.',
    cue: 'Hips stay level. Reach long, not high.',
    why:
      'The third of the Big 3. Trains the back extensors and glutes together in a neutral spine, ' +
      'which is precisely the pattern a deadlift needs — this is the unloaded rehearsal for it.',
    animation: 'birddog',
    loadTracked: false,
    alternates: ['d-bird-dog-single'],
  },
  {
    id: 'd-wall-glides',
    name: 'Wall glides',
    block: 'mobility',
    prescription: '2 × 10 · 3s up / 3s down',
    tracking: 'reps',
    sets: 2,
    repScheme: [10, 10],
    tempo: { down: 3, up: 3 },
    restSeconds: 30,
    execution:
      'Back to the wall, feet a little forward. Arms in a goalpost against the wall. Slide the arms ' +
      'up slowly, keeping the wrists and elbows in contact and the lower back flat against the wall. ' +
      'Slide back down just as slowly.',
    cue: 'Ribs down, low back flat to the wall.',
    why:
      'Reopens a thoracic spine that spends its days closed by climbing and desks. The flat-lower-back ' +
      'constraint forces the movement to come from the upper back rather than being stolen from the ' +
      'lumbar spine — which is the whole point of doing it against a wall.',
    animation: 'wallslide',
    loadTracked: false,
    alternates: ['d-down-dog'],
  },

  // ── Daily · Restore · alternates ──────────────────────────────────────────
  //
  // Added deliberately and with the owner's sign-off, so that substitution is
  // possible without leaving the programme's logic. Every one is unloaded, sits
  // in the mobility block, and is either extension-biased, a regression of a
  // Big 3 lift, or nerve mobility. None introduces loaded flexion or rotation.
  {
    id: 'd-sphinx',
    name: 'Sphinx hold',
    block: 'mobility',
    prescription: '1 × 5 · 10s holds',
    tracking: 'hold',
    sets: 1,
    repScheme: [5],
    holdSeconds: 10,
    restSeconds: 30,
    execution:
      'Face down, forearms flat and parallel, elbows directly under the shoulders. Let the hips and ' +
      'legs go heavy and rest there rather than pressing up. Hold ten seconds and lower the chest ' +
      'fully between reps. If anything travels further down the leg, come out and stop for the day.',
    cue: 'Rest into it. No pressing.',
    why:
      'The same extension direction as the cobra, held rather than repeated and through a smaller ' +
      'range. For days when the cobra feels like too much movement — a sustained low-grade extension ' +
      'is usually better tolerated than a repeated one when things are irritable.',
    animation: 'cobra',
    loadTracked: false,
    alternates: ['d-cobra', 'd-standing-extension'],
  },
  {
    id: 'd-standing-extension',
    name: 'Standing extension',
    block: 'mobility',
    prescription: '1 × 10 · 3s holds',
    tracking: 'hold',
    sets: 1,
    repScheme: [10],
    holdSeconds: 3,
    restSeconds: 30,
    execution:
      'Standing, hands on the back of the hips, feet under the shoulders. Lean back over the hands ' +
      'through a small range, hold three seconds, return upright. Keep the knees straight so the ' +
      'movement comes from the lower back rather than from bending the knees.',
    cue: 'Small range. Hands do the work.',
    why:
      'The cobra direction, standing, so it can be done at a desk or at the base of a route without ' +
      'lying on the floor. Its value is in breaking up a day spent seated, not in replacing the ' +
      'floor work at night.',
    animation: 'standext',
    loadTracked: false,
    alternates: ['d-cobra', 'd-sphinx'],
  },
  {
    id: 'd-down-dog',
    name: 'Downward dog, knees soft',
    block: 'mobility',
    prescription: '3 × 30s holds',
    tracking: 'hold',
    sets: 3,
    repScheme: [1, 1, 1],
    holdSeconds: 30,
    restSeconds: 30,
    execution:
      'From hands and knees, lift the hips back and up. Keep the knees clearly bent and the heels ' +
      'off the floor — the aim is a long spine, not straight legs. Push the floor away to lengthen ' +
      'through the arms and ribs. Straightening the knees is not a progression here.',
    cue: 'Knees bent. Long spine, not long hamstrings.',
    why:
      'Lengthens the posterior chain and decompresses through the arms with no load on the spine. ' +
      'The bent knees are the whole safety of it: with straight legs and tight hamstrings the pelvis ' +
      'tucks under and the lumbar spine rounds, which is the direction being avoided.',
    animation: 'downdog',
    loadTracked: false,
    alternates: ['d-wall-glides'],
  },
  {
    id: 'd-side-plank-knees',
    name: 'Side plank from knees',
    block: 'mobility',
    prescription: '6 / 4 / 2 per side · 8s holds',
    tracking: 'hold',
    sets: 3,
    repScheme: [6, 4, 2],
    holdSeconds: 8,
    restSeconds: 30,
    bilateral: true,
    execution:
      'On the elbow with the knees bent and stacked, lift the hips into a straight line from ' +
      'shoulder to knee. Hold eight seconds, lower under control, repeat. Both sides every set.',
    cue: 'Straight line shoulder to knee.',
    why:
      'The same lateral stability work as the full side plank with roughly half the lever, so the ' +
      'obliques and quadratus lumborum still load while the spine carries less. The version for a ' +
      'flared-up week, instead of skipping the movement altogether.',
    animation: 'plank',
    loadTracked: false,
    alternates: ['d-side-plank'],
  },
  {
    id: 'd-bird-dog-single',
    name: 'Bird dog, one limb',
    block: 'mobility',
    prescription: '6 / 4 / 2 per side · 8s holds',
    tracking: 'hold',
    sets: 3,
    repScheme: [6, 4, 2],
    holdSeconds: 8,
    restSeconds: 30,
    bilateral: true,
    execution:
      'On hands and knees, spine neutral. Extend one leg to horizontal, or one arm, but never both. ' +
      'Hold eight seconds without letting the hips rotate or the back arch. Alternate sides.',
    cue: 'Hips level. One limb only.',
    why:
      'The bird dog with half the destabilising torque. Opposite arm and leg together is the harder ' +
      'version, and performing it badly — hips rotating, back arching to reach further — trains the ' +
      'opposite of what it is for. Use this until the hips stay quiet.',
    animation: 'birddog',
    loadTracked: false,
    alternates: ['d-bird-dog'],
  },
  {
    id: 'd-glute-bridge',
    name: 'Glute bridge',
    block: 'mobility',
    prescription: '2 × 10 · 3s holds',
    tracking: 'hold',
    sets: 2,
    repScheme: [10, 10],
    holdSeconds: 3,
    restSeconds: 30,
    execution:
      'On your back, knees bent, feet flat and close to the hips. Push through the heels and lift ' +
      'the hips until the body is straight from knee to shoulder. Hold three seconds and lower. ' +
      'Finish with the glutes rather than arching the lower back to gain height.',
    cue: 'Glutes lift the hips, not the low back.',
    why:
      'Glute strength with the spine flat on the floor and under no compression at all. Weak glutes ' +
      'are why a hinge turns into a back movement, so this is the unloaded groundwork for every ' +
      'hinge in the gym sessions.',
    animation: 'hipThrust',
    loadTracked: false,
    alternates: ['d-deadbug'],
  },
  {
    id: 'd-nerve-glide',
    name: 'Sciatic nerve glide',
    block: 'mobility',
    prescription: '2 × 10 each side',
    tracking: 'reps',
    sets: 2,
    repScheme: [10, 10],
    restSeconds: 30,
    execution:
      'Sitting, slightly slumped, one leg hanging. Straighten that knee and look up at the same ' +
      'time; then bend the knee back down as you tuck the chin. The two ends move in opposite ' +
      'directions on purpose. Ten each side, continuous and gentle — never push into the symptom, ' +
      'and never hold at the end of the range.',
    cue: 'Oscillate. Never hold at the end.',
    why:
      'A protruding disc can leave the sciatic nerve sensitised and tethered to the tissue around it. ' +
      'Moving the two ends in opposite directions slides the nerve within its sheath while the total ' +
      'tension on it stays roughly constant — that is what settles referred symptoms. Lengthening ' +
      'both ends at once would stretch an already irritated nerve, which reliably makes it worse.',
    animation: 'nerveglide',
    loadTracked: false,
  },

  // ── Gym · shared alternates ───────────────────────────────────────────────
  //
  // Not part of any fixed session — hence the `alt-` prefix rather than a
  // session letter. They exist so that "the machine is taken" has an answer
  // that is not "skip it". Each is a plain, well-established movement chosen
  // for the same pattern as what it replaces, and none introduces loaded
  // flexion, loaded rotation, or overhead axial compression.
  {
    id: 'alt-walk',
    name: 'Brisk walk',
    block: 'warmup',
    prescription: '15 min easy',
    tracking: 'duration',
    sets: 1,
    repScheme: [1],
    durationSeconds: 900,
    restSeconds: 0,
    execution:
      'Outside or on a treadmill at a flat gradient. Quick enough that talking takes a little ' +
      'effort, slow enough that it never becomes jogging. Let the arms swing.',
    cue: 'Brisk, not fast.',
    why:
      'Walking is the most consistently recommended activity for a disc, and the one McGill puts ' +
      'above almost everything else: it loads and unloads the disc rhythmically at very low ' +
      'magnitude. Fully interchangeable with the bike here — use it when the machines are busy.',
    animation: 'walk',
    loadTracked: false,
    alternates: ['a-cardio'],
  },
  {
    id: 'alt-inverted-row',
    name: 'Inverted row',
    block: 'main',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Bar at hip height, heels on the floor, body straight from heel to shoulder. Pull the chest ' +
      'to the bar leading with the elbows, pause, lower under control. Raise the bar to make it ' +
      'easier rather than letting the hips drop.',
    cue: 'One straight line. Hips do not sag.',
    why:
      'A horizontal pull that costs the spine nothing: the trunk is rigid and horizontal, so there ' +
      'is no loaded flexion at any point. The obvious answer when the cable station is taken, and ' +
      'the reason bent-over rows are still not in this programme.',
    animation: 'row',
    loadTracked: false,
    alternates: ['a-cable-row', 'c-chest-supported-row'],
  },
  {
    id: 'alt-pushup',
    name: 'Push-ups',
    block: 'main',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Hands under the shoulders, body straight from heel to head, ribs down. Lower until the ' +
      'chest is a fist off the floor, press back up. Raise the hands onto a bench if the hips ' +
      'start to sag — that sag is lumbar extension under load.',
    cue: 'Straight line. Squeeze the glutes.',
    why:
      'The same pressing pattern as the bench with no external load and no bench to queue for. ' +
      'Holding the plank position while pressing is itself trunk work, which is a bonus here ' +
      'rather than a distraction.',
    animation: 'pushup',
    loadTracked: false,
    alternates: ['b-bench', 'b-dips'],
  },
  {
    id: 'alt-floor-press',
    name: 'Dumbbell floor press',
    block: 'main',
    prescription: '3 × 12 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 90,
    execution:
      'Lying on the floor, knees bent, dumbbells over the chest. Press up and lower until the ' +
      'upper arms touch the floor, then press again. The floor stops the range, which is the point.',
    cue: 'Elbows touch, then press.',
    why:
      'The floor caps the range at the shoulder, which spares a cranky shoulder, and it puts the ' +
      'whole spine flat with no arch at all — a bench press invites one, this does not. Needs two ' +
      'dumbbells and a patch of floor.',
    animation: 'press',
    loadTracked: true,
    alternates: ['b-bench', 'alt-pushup'],
  },
  {
    id: 'alt-lateral-raise',
    name: 'Lateral raise',
    block: 'main',
    prescription: '3 × 12 · light · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [12, 12, 12],
    restSeconds: 60,
    execution:
      'Standing, light dumbbells at the sides, a small bend at the elbows. Raise to shoulder ' +
      'height and no further, lead with the elbows, lower slowly. If the trunk starts swinging to ' +
      'launch the weight, the weight is too heavy.',
    cue: 'To shoulder height. No swing.',
    why:
      'Shoulder volume with the arms below the head, so there is none of the axial compression ' +
      'that keeps the standing overhead press out of this programme. The no-swing rule is spinal: ' +
      'a swing is a fast loaded lumbar extension.',
    animation: 'latraise',
    loadTracked: true,
    alternates: ['b-shoulder-press'],
  },
  {
    id: 'alt-face-pull',
    name: 'Face pull',
    block: 'main',
    prescription: '3 × 15 · rest 60 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [15, 15, 15],
    restSeconds: 60,
    execution:
      'Cable or band at face height. Pull towards the forehead, splitting the hands apart and ' +
      'rotating the knuckles up at the end. Stand tall — do not lean back to move more weight.',
    cue: 'Hands split. Knuckles up.',
    why:
      'External rotation and rear delts under a bit more load than the band work, both of which a ' +
      'climber is chronically short of. The same job as the cable external rotation, in a position ' +
      'most gyms have free.',
    animation: 'pullApart',
    loadTracked: true,
    alternates: ['b-external-rotation'],
  },
  {
    id: 'alt-kb-deadlift',
    name: 'Kettlebell deadlift',
    block: 'spine',
    prescription: '3 × 10 · rest 90 sec',
    tracking: 'reps',
    sets: 3,
    repScheme: [10, 10, 10],
    restSeconds: 90,
    execution:
      'Kettlebell between the feet, hips back, chest proud, shins near vertical. Stand up by ' +
      'pushing the floor away and finish with the glutes. Lower by sending the hips back, and stop ' +
      'the moment the lower back would round.',
    cue: 'Hips back, not down. Stop before the back rounds.',
    why:
      'The same hinge as the trap-bar deadlift with the load closer to the floor and lighter, so ' +
      'the pattern can be trained on a day when the full lift is too much. The handle sits between ' +
      'the feet, which keeps the weight directly under the hips and the shear low.',
    animation: 'hinge',
    loadTracked: true,
    alternates: ['a-deadlift', 'b-rdl'],
  },
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
);
