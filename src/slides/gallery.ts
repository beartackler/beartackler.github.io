/**
 * The two slides after the car.
 *
 * Both are built from the same primitive as the R8 — filled polygons and
 * stroked polylines, resolved through the page's density ramp — which is the
 * only reason a boulder on a slope and a black hole belong on the same page.
 * Drawn two different ways they would be two projects stapled together.
 *
 * Each is authored in its own pixel space and fitted at draw time, so none of
 * them care what size the plane is.
 */

import { circle, type Art } from '../art';

/** Deterministic noise, so a sketch is the same sketch on every frame. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An ellipse with its major axis at an angle — a disc seen from off to one side. */
function disc(
  cx: number,
  cy: number,
  ra: number,
  rb: number,
  ang: number,
  segs = 44,
  from = 0,
  to = Math.PI * 2,
): number[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const d: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const th = from + ((to - from) * i) / segs;
    if (to - from >= Math.PI * 2 && i === segs) break;
    const x = Math.cos(th) * ra;
    const y = Math.sin(th) * rb;
    d.push(cx + x * c - y * s, cy + x * s + y * c);
  }
  return d;
}

// ── Sisyphus ───────────────────────────────────────────────────────────────
// Drawn in the black-figure idiom the reference vase uses, because that idiom
// and this renderer want the same thing: mass stated as a dark shape, and
// everything inside it — the boulder's pitting, the folds of a chiton, the
// cracks in a rock face — stated as bright marks on top of it. The one
// inversion is the man himself. On a pot he is black against the clay; here
// the page is black, so he is the bright thing and the rock he is under is
// not.
//
// Tracing the silhouette reference first was the wrong instinct. A silhouette
// of a man, a boulder and a slope is one connected black region, so the trace
// came back as a single blob with a lumpy top edge, and no amount of tone
// work separates a figure from a rock it is welded to.

/** A lumpy closed shape. Rock is not a circle and reads wrong drawn as one. */
function crag(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n: number,
  jitter: number,
  seed: number,
): number[] {
  const rand = rng(seed);
  const d: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - jitter * rand();
    d.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
  }
  return d;
}

/**
 * The boulder's pitting: short arcs following its curvature.
 *
 * Concentric rather than random, which is the whole trick — marks that run
 * *around* a sphere describe one, and the same number of marks scattered at
 * random describe a disc with dirt on it. Thinned toward the lit rim so the
 * stone has a light on it rather than an even rash.
 */
function pitting(cx: number, cy: number, rx: number, ry: number, seed: number): Art['shapes'] {
  const rand = rng(seed);
  const out: Art['shapes'] = [];
  for (let i = 0; i < 34; i++) {
    const a = rand() * Math.PI * 2;
    const t = 0.16 + Math.sqrt(rand()) * 0.76;
    // Bias against the upper left, which is where the light is.
    const lit = 0.5 - 0.5 * Math.cos(a - Math.PI * 1.2);
    if (rand() < lit * 0.55) continue;
    const span = 0.09 + rand() * 0.15;
    const d: number[] = [];
    for (let k = 0; k <= 4; k++) {
      const aa = a + (k / 4 - 0.5) * span;
      d.push(cx + Math.cos(aa) * rx * t, cy + Math.sin(aa) * ry * t);
    }
    out.push({ tone: 0.34 + rand() * 0.34, stroke: 1.2, open: true, d });
  }
  return out;
}

/** The skyline of the slope, left to right, rising the way he is pushing. */
const RIDGE = [
  0, 575, 130, 560, 260, 536, 380, 506, 480, 472, 570, 430,
  660, 382, 750, 326, 850, 264, 960, 196, 1080, 116,
];

/** Height of the ridge at an x, so nothing sits in mid-air above it. */
function ridgeAt(x: number): number {
  for (let i = 2; i < RIDGE.length; i += 2) {
    if (x <= RIDGE[i]) {
      const t = (x - RIDGE[i - 2]) / (RIDGE[i] - RIDGE[i - 2]);
      return RIDGE[i - 1] + (RIDGE[i + 1] - RIDGE[i - 1]) * t;
    }
  }
  return RIDGE[RIDGE.length - 1];
}

/**
 * Grain in the rock face.
 *
 * Specks rather than a fill. A filled slope at any tone low enough to sit
 * behind the figure still puts a character in every one of three thousand
 * cells, and arrives as a grey wedge; scattered marks arrive as scree.
 */
function scree(): Art['shapes'] {
  const rand = rng(19421015);
  const near: number[] = [];
  const far: number[] = [];
  for (let i = 0; i < 1150; i++) {
    const x = rand() * 1080;
    const top = ridgeAt(x);
    const y = top + Math.pow(rand(), 0.7) * (566 - top);
    (rand() < 0.28 ? near : far).push(x, y);
  }
  return [
    { tone: 0.08, specks: true, d: far },
    { tone: 0.19, specks: true, d: near },
  ];
}

/** The long dashed rays the vase paints across its sky. */
function rays(): Art['shapes'] {
  const rand = rng(19551201);
  const pts: number[] = [];
  for (let n = 0; n < 4; n++) {
    const y0 = -130 + n * 168;
    for (let i = 0; i < 150; i++) {
      if (i % 14 > 9) continue;
      const t = i / 150;
      const y = y0 + t * 344 + (rand() - 0.5) * 5;
      // Kept inside the frame. The artwork's own box is what the closing line
      // is placed against, so a ray that runs a hundred units past the bottom
      // edge prints through "one must imagine sisyphus happy".
      if (y < 0 || y > 556) continue;
      pts.push(t * 1140 - 30, y);
    }
  }
  return [{ tone: 0.12, specks: true, d: pts }];
}

const ROCK_X = 810;
const ROCK_Y = 162;
const ROCK_RX = 172;
const ROCK_RY = 150;

/**
 * The boulder's own outline, generated once.
 *
 * Once, because the lit crescent is a slice of these very points and a second
 * call to `crag` would wander off the first by the width of its own jitter.
 */
const ROCK = crag(ROCK_X, ROCK_Y, ROCK_RX, ROCK_RY, 22, 0.11, 7331);

/**
 * Catmull–Rom through a list of widths, so a silhouette curves between the
 * numbers instead of turning a corner at each of them.
 *
 * This is the fix for the lumps. A body has about nine measurements worth
 * stating from seat to neck, and linear interpolation between nine
 * measurements over twenty rows puts a kink in the edge on nearly every row.
 * Nine kinks is a potato. The measurements are the same either way; what
 * changes is that the line between them is now a curve, and a curve is what
 * survives being resampled to characters.
 */
function spline(w: readonly number[], t: number): number {
  const n = w.length - 1;
  const u = Math.max(0, Math.min(n - 1e-9, t * n));
  const i = Math.floor(u);
  const s = u - i;
  const p0 = w[Math.max(0, i - 1)];
  const p1 = w[i];
  const p2 = w[i + 1];
  const p3 = w[Math.min(n, i + 2)];
  return (
    0.5 *
    (2 * p1 +
      (p2 - p0) * s +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s +
      (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s)
  );
}

/**
 * A tapered form with a belly, swept along a bone.
 *
 * Widths are sampled from the start of the bone to its end, `front` on the
 * right-hand side of the direction of travel and `back` on the left. One list
 * makes a symmetric limb; two make a torso, which is not symmetric about its
 * own spine and never was.
 *
 * The concave stretches are the whole point. A straight taper — two widths,
 * four points — is what the first attempts used, and every segment came out a
 * cone. Real legs are not cones: a calf is widest a third of the way down and
 * then closes to an ankle a third its width, and that one inward curve does
 * more for "this is a person" than any amount of interior line work, because
 * it is the only part of a leg you can still see at forty rows.
 */
function limb(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  front: readonly number[],
  back: readonly number[] = front,
): number[] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const a: number[] = [];
  const b: number[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const cx = x0 + dx * t;
    const cy = y0 + dy * t;
    const f = spline(front, t);
    const k = spline(back, t);
    a.push(cx + nx * f, cy + ny * f);
    b.push(cx - nx * k, cy - ny * k);
  }
  for (let i = b.length - 2; i >= 0; i -= 2) a.push(b[i], b[i + 1]);
  return a;
}

/**
 * The man, measured in heads.
 *
 * Every earlier version was drawn by eye and every one of them was a barrel.
 * The numbers are the fix. At eight heads, with a head 67 units tall: seat to
 * neck 3.4, upper arm 1.4, forearm 1.15, thigh 1.9, shin 1.75, foot 1.05, and
 * — the one that was most wrong — a chest 1.1 heads deep against a waist of
 * 0.85. Drawn thicker than that and he is a potato with limbs, which is what
 * he was: the torso was carrying half again the depth a chest has, so there
 * was nothing for the waist to be narrower *than*.
 *
 * He is side-on, and that rules out the obvious way to draw someone strong.
 * There is no shoulder span to show from the side; in profile the mass is all
 * depth, and depth is a thing you can only state by taking it away somewhere
 * else. So the torso is one sweep from seat to neck with nine measurements
 * across it, front and back kept as separate lists because a spine is not a
 * centre line: the glute stands out behind, the chest in front, and the small
 * of the back cuts in between them.
 *
 * Where the arm meets the body is the whole of the top half, and it took
 * four goes. The flat cap at the start of a limb is half its width long, so a
 * shoulder joint set high puts that cap — and the reserved line drawn round
 * it — straight through a neck four cells wide, and the head comes away from
 * the body. Set low, the same cap slices the chest and the widest part of the
 * figure arrives as two six-cell lumps with a gutter between them. It wants
 * to be at four fifths of the way up, which leaves a rung and a half of clear
 * neck above it, and a visible neck is worth more than an accurate one: it is
 * the cue that turns a lump with a bump on top into a head on a body.
 *
 * Everything else is subtraction. Earlier versions had a loincloth, four
 * incised cuts, a hair mass and joint circles, and at eight units to the
 * character every one of those was a lump rather than a feature. What reads at
 * this size is the outline and the gaps: air between the head and the raised
 * arm, air between the thighs, an ankle a third the width of the calf.
 */
const HIP = [390, 420] as const;
const NECK = [514, 206] as const;

/** Every filled part of him, far side first so the near side draws over it. */
const FIGURE: { d: number[]; tone: number; rim?: number }[] = [
  // The far side, dimmer and a touch thinner, which is all the perspective a
  // figure this size can carry.
  { d: limb(402, 388, 297, 461, [29, 32, 27, 22, 18]), tone: 0.5 },
  { d: disc(297, 461, 18, 15, -0.6), tone: 0.5 },
  { d: limb(297, 461, 205, 537, [18, 23, 17, 11, 7]), tone: 0.5 },
  { d: [174, 524, 168, 544, 234, 566, 244, 554, 210, 528], tone: 0.56 },
  { d: limb(486, 252, 580, 232, [23, 25, 22, 18, 15]), tone: 0.52 },
  { d: disc(580, 232, 15, 13, 0.2), tone: 0.52 },
  { d: limb(580, 232, 654, 198, [16, 18, 14, 11, 8]), tone: 0.52 },
  { d: disc(656, 196, 11, 9, -0.2), tone: 0.56 },

  // The torso: seat, pelvis, the small of the back, chest, neck.
  {
    d: limb(
      HIP[0],
      HIP[1],
      NECK[0],
      NECK[1],
      [20, 28, 32, 30, 26, 30, 42, 32, 20],
      [24, 34, 36, 28, 26, 32, 36, 30, 23],
    ),
    tone: 1,
  },

  // The near leg and the near arm, each with a line reserved round it.
  { d: limb(414, 395, 523, 467, [32, 35, 30, 24, 20]), tone: 1, rim: 1 },
  { d: disc(523, 467, 20, 17, 0.6), tone: 1 },
  { d: limb(523, 467, 443, 555, [20, 25, 19, 12, 8]), tone: 1 },
  { d: [414, 546, 410, 566, 472, 552, 482, 536, 442, 532], tone: 1 },
  { d: limb(502, 248, 585, 207, [26, 28, 25, 20, 17]), tone: 1, rim: 1 },
  { d: disc(585, 207, 18, 15, -0.4), tone: 1 },
  { d: limb(585, 207, 649, 157, [18, 20, 16, 12, 9]), tone: 1 },
  { d: disc(651, 155, 13, 10, -0.7), tone: 1 },

  // Taller than it is wide, and only just: a head seen from the side is an
  // egg standing on end, and drawn the other way round — which is what an
  // unrotated ellipse gives you — it reads as a helmet.
  //
  // No line of its own. Two parts have one: the near thigh, which lies over
  // the torso and the far thigh, and the near upper arm, which lies over the
  // chest and passes under the jaw. Everything else is separated by one of
  // those two or by tone, and a reserved line drawn where nothing needed
  // separating is not a line, it is a hole — the head with one came away from
  // its own neck, and the ankle with one came away from its own foot.
  { d: disc(522, 180, 34, 29, -1.25), tone: 1 },
];

function pusher(): Art['shapes'] {
  // A halo of nothing, first, and for the whole figure before any of it is
  // filled. He stands against the boulder's lit rim, and two bright shapes
  // touching on a grid this coarse are one shape. Drawing the same geometry at
  // tone zero with a fatter pen erases what is behind him, so the rock ends
  // where he begins — which is what a pot gets for free by painting the man in
  // the other colour.
  //
  // Then a second, thinner reserved line, but only around the parts marked
  // `rim`: the head, the near arm, the near leg. A vase draws one of these
  // round every limb and that is why you can count four wrestlers on one; it
  // also has a foot of clay to do it in. Here the rule is that a part earns a
  // line when it lies over something at its own tone — otherwise the ramp's
  // top rung is wide enough that the two arrive as one shape, and no amount of
  // tone will separate them, because tone is what picks the glyph.
  return [
    ...FIGURE.map(({ d }) => ({ tone: 0, stroke: 3, d })),
    ...FIGURE.flatMap(({ d, tone, rim }) =>
      rim ? [{ tone: 0, stroke: rim, d }, { tone, d }] : [{ tone, d }],
    ),
  ];
}
export const SISYPHUS_ART: Art = {
  w: 1080,
  // Landscape, and that is a scale decision rather than a compositional one.
  // `band` gives a slide four fifths of the plane's width and whatever rows
  // are left after the caption, and takes the smaller of the two — so a nearly
  // square artwork is height-limited and never claims the width it was
  // offered. At 1080x848 this one resolved to ninety columns of a hundred and
  // twenty-eight available, and a man drawn across a third of ninety columns
  // has a head three rows tall. Cut to 1080x620 the two limits meet, the
  // picture takes the whole width, and everything in it is drawn a third
  // larger. Nothing about the drawing changed; it was being printed small.
  h: 620,
  shapes: [
    ...rays(),
    ...scree(),
    // The ridge over the grain, so the slope has an edge to it.
    { tone: 0.6, stroke: 1.8, open: true, d: RIDGE },
    // Cracks in the face, which is where the vase puts its lightning marks.
    { tone: 0.42, stroke: 1.4, open: true, d: [664, 418, 702, 468, 680, 504, 718, 558] },
    { tone: 0.38, stroke: 1.3, open: true, d: [846, 298, 880, 350, 854, 384, 890, 444] },
    { tone: 0.34, stroke: 1.2, open: true, d: [540, 484, 572, 532, 546, 564] },
    { tone: 0.3, stroke: 1.2, open: true, d: [300, 538, 348, 564] },
    { tone: 0.28, stroke: 1.1, open: true, d: [96, 556, 144, 576] },
    { tone: 0.32, stroke: 1.2, open: true, d: [418, 522, 468, 552] },
    { tone: 0.26, stroke: 1.1, open: true, d: [604, 544, 648, 570] },
    // The boulder: a dark mass, then the pitting, then a thin rim all round
    // and a bright one only where the light is.
    { tone: 0.15, d: ROCK },
    { tone: 0.26, d: crag(ROCK_X - 42, ROCK_Y - 36, ROCK_RX * 0.68, ROCK_RY * 0.68, 18, 0.16, 991) },
    ...pitting(ROCK_X, ROCK_Y, ROCK_RX, ROCK_RY, 4242),
    // A dim boundary the whole way round, so the stone has an edge against the
    // sky, and never more than that. Lit at full strength all the way round it
    // is not a boulder, it is a ring — the eye reads a closed bright curve as
    // an outline of nothing rather than the rim of something.
    { tone: 0.4, edge: 'outer' as const, stroke: 1.1, d: ROCK },
    // And the light itself, on the eight facets the rays fall on. Not full
    // tone: the rim and the man would otherwise resolve to the same glyph on
    // the same sheet, and where they touch — which is the whole subject — the
    // picture loses which of them is which.
    { tone: 0.8, stroke: 2, open: true, d: ROCK.slice(20, 36) },
    // Him last, in front of the rock he is under.
    ...pusher(),
  ],
};

// ── The black hole ─────────────────────────────────────────────────────────
// The closing image, and the one thing on the page that never stops moving.
//
// It is here for the physics rather than the spectacle. A black hole is the
// most extreme object anyone has ever described and the description is three
// numbers long — mass, spin, charge, and nothing else survives falling in.
// That is what the line under it is about, and it is why this is the last
// picture instead of the flashiest one.
//
// Everything you can see of one is bent light. The disc is a flat ring around
// the equator, and it looks like a lens because the far half of it is lifted
// over the top of the shadow by the hole's own gravity — you are seeing the
// underside of the orbit behind it, folded up into view. The near half stays
// flat and crosses in front. Both are drawn here, and the fold is the whole
// reason the thing is recognisable.

const HX = 540;
const HY = 300;
/** Radius of the shadow, and of the ring of light grazing it. */
const H_SHADOW = 130;
const H_RING = 118;
/** Inner and outer edge of the disc, as distances in the orbital plane. */
const DISC_IN = 205;
const DISC_OUT = 400;

/**
 * Where a point orbiting at distance `a` and phase `ph` appears on the page.
 *
 * The two halves obey different rules, and that asymmetry is the picture. The
 * near half — swinging toward the viewer — just flattens, because the disc is
 * seen from twenty-odd degrees above its own plane; it opens into a wide
 * ellipse whose front edge crosses the shadow low down.
 *
 * The far half does not recede. Light leaving the back of the disc is bent up
 * and over the hole and arrives from above it, so the whole of the far side —
 * every radius of it — folds into one narrow band standing just clear of the
 * shadow's top. That is why apparent height barely grows with distance here:
 * the outer orbits are not higher up the page, they are stacked into the same
 * arc. Everything you can see of a black hole is bent light, and this is the
 * piece of bending that makes one recognisable.
 */
function orbit(a: number, ph: number): [number, number] {
  const s = Math.sin(ph);
  const rise = s > 0 ? a * 0.5 : 150 + (a - DISC_IN) * 0.13;
  return [HX + a * Math.cos(ph), HY + rise * s];
}

/**
 * Doppler beaming: the side of the disc rotating toward you is brighter.
 *
 * Not a stylistic choice, and not a small effect either — in the real thing
 * one side outshines the other by a factor that puts them on different rungs
 * of any ramp you like. Pulled in hard here all the same, because a ramp with
 * eight rungs spends five of them before the far side disappears, and half a
 * black hole is not a black hole.
 */
function beam(ph: number): number {
  return 0.56 + 0.44 * (0.5 - 0.5 * Math.cos(ph));
}

/** One segment of one orbit: fixed radius and fixed place in the queue. */
type Arc = { a: number; ph0: number; span: number; heat: number; rate: number };

/**
 * The disc, as eight concentric orbits cut into dashes.
 *
 * The first version scattered ninety short strokes at random radii, and it
 * came out as confetti — the same failure the boulder had before its pitting
 * was made concentric. Marks that run *around* something describe it; the
 * same marks at random describe dirt. So these are laid out one orbit at a
 * time, every segment on an orbit joining the next, with about a quarter of
 * them dropped to leave gaps. The gaps are load-bearing: a complete circle
 * turned about its own centre is indistinguishable from a complete circle
 * standing still, so without them the spin would be invisible.
 */
const ARCS: Arc[] = (() => {
  const rand = rng(19151125);
  const out: Arc[] = [];
  const RINGS = 7;
  for (let i = 0; i < RINGS; i++) {
    const u = i / (RINGS - 1);
    const a = DISC_IN + (DISC_OUT - DISC_IN) * Math.pow(u, 1.25);
    const steps = 26;
    const step = (Math.PI * 2) / steps;
    const phase = rand() * Math.PI * 2;
    for (let k = 0; k < steps; k++) {
      if (rand() < 0.26) continue;
      out.push({
        a,
        ph0: phase + k * step,
        // A shade over one step, so neighbours meet rather than nearly meet.
        span: step * 1.08,
        heat: 1 - 0.28 * u,
        // Kepler: the inner edge laps the outer one three times over. Drawn as
        // one rigid wheel it looks like a wheel; sheared, it looks like
        // something falling in.
        rate: Math.pow(a / DISC_IN, -1.5),
      });
    }
  }
  return out;
})();

/**
 * The disc, redrawn each frame, turning. Innermost orbit comes round in about
 * nine seconds and the outermost takes half a minute.
 *
 * Ordered here rather than in `shapes`, because the order is the picture: the
 * far half of the disc, then the shadow punched out of it, then the ring of
 * light around the shadow, then the near half over the top of all three.
 * Drawn in any other order the hole stops being in front of anything.
 */
function accretion(t: number): Art['shapes'] {
  const far: Art['shapes'] = [];
  const near: Art['shapes'] = [];
  const turn = (t / 9000) * Math.PI * 2;
  for (const arc of ARCS) {
    const ph = arc.ph0 + turn * arc.rate;
    const d: number[] = [];
    for (let k = 0; k <= 4; k++) d.push(...orbit(arc.a, ph + (k / 4) * arc.span));
    const shape = {
      tone: beam(ph + arc.span * 0.5) * arc.heat,
      stroke: 1.1,
      open: true,
      d,
    };
    (Math.sin(ph + arc.span * 0.5) > 0 ? near : far).push(shape);
  }
  return [
    ...far,
    // The shadow. Not a dark fill — a hole. Drawing the same geometry at tone
    // zero takes those cells back to the page, which is the only black on this
    // grid that is actually black.
    { tone: 0, d: circle(HX, HY, H_SHADOW) },
    // The ring of light grazing the horizon: photons that have gone most of
    // the way round the hole and come back out toward us. Dim all the way and
    // full strength on the side turning our way, the same beaming as the disc.
    { tone: 0.78, stroke: 1.8, d: circle(HX, HY, H_RING) },
    {
      tone: 1,
      stroke: 2.2,
      open: true,
      d: circle(HX, HY, H_RING, 26, Math.PI * 0.5, Math.PI * 1.5),
    },
    ...near,
  ];
}

/**
 * Stars, thinned toward the hole.
 *
 * Not because they are not there. Light passing close is swept aside, so the
 * sky immediately around a black hole is emptier than the sky anywhere else,
 * and the missing stars pile up into the ring further out. Two densities, and
 * a handful of tangential dashes where they pile up.
 */
function stars(): Art['shapes'] {
  const rand = rng(19160302);
  const far: number[] = [];
  const near: number[] = [];
  for (let i = 0; i < 620; i++) {
    const x = rand() * 1080;
    const y = rand() * 620;
    const r = Math.hypot(x - HX, (y - HY) * 1.9);
    if (r < 190 || rand() > Math.min(1, r / 420)) continue;
    (rand() < 0.24 ? near : far).push(x, y);
  }
  const arcs: Art['shapes'] = [];
  for (let i = 0; i < 16; i++) {
    const a = 420 + rand() * 120;
    const ph = rand() * Math.PI * 2;
    const d: number[] = [];
    for (let k = 0; k <= 3; k++) {
      const p = ph + (k / 3 - 0.5) * 0.13;
      d.push(HX + Math.cos(p) * a, HY + Math.sin(p) * a * 0.62);
    }
    arcs.push({ tone: 0.16, stroke: 1, open: true, d });
  }
  return [{ tone: 0.09, specks: true, d: far }, { tone: 0.2, specks: true, d: near }, ...arcs];
}

export const HOLE_ART: Art = {
  w: 1080,
  h: 620,
  shapes: stars(),
  live: accretion,
};

export const GALLERY: Record<string, Art> = {
  sisyphus: SISYPHUS_ART,
  hole: HOLE_ART,
};
