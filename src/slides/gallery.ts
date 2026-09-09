/**
 * The four slides after the car.
 *
 * All of them are built from the same primitive as the R8 — filled polygons
 * and stroked polylines, resolved through the page's density ramp — which is
 * the only reason a boulder, a Greek jar, a Pixar robot and a picture frame
 * belong on the same page. Drawn six different ways they would be six
 * different projects stapled together.
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
  for (let i = 0; i < 54; i++) {
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
    out.push({ tone: 0.5 + rand() * 0.5, stroke: 1.3, open: true, d });
  }
  return out;
}

/** The skyline of the slope, left to right, rising the way he is pushing. */
const RIDGE = [
  0, 742, 120, 726, 240, 700, 360, 672, 450, 644, 540, 596,
  620, 540, 700, 474, 780, 406, 870, 328, 960, 246, 1050, 160, 1080, 132,
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
    const y = top + Math.pow(rand(), 0.7) * (812 - top);
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
    const y0 = -150 + n * 210;
    for (let i = 0; i < 150; i++) {
      if (i % 14 > 9) continue;
      const t = i / 150;
      const y = y0 + t * 430 + (rand() - 0.5) * 5;
      // Kept inside the frame. The artwork's own box is what the closing line
      // is placed against, so a ray that runs a hundred units past the bottom
      // edge prints through "one must imagine sisyphus happy".
      if (y < 0 || y > 800) continue;
      pts.push(t * 1140 - 30, y);
    }
  }
  return [{ tone: 0.12, specks: true, d: pts }];
}

const ROCK_X = 790;
const ROCK_Y = 200;
const ROCK_RX = 210;
const ROCK_RY = 196;

/**
 * A tapered segment — a limb thicker at one end than the other.
 *
 * Constant-width strokes are what made the first figure a stick man, and no
 * amount of extra line work fixes that: a thigh and a shin drawn at the same
 * weight are a hinge, not a leg. Two quads that narrow toward the joint, with
 * a disc at the joint itself to fill the notch, cost the same four points and
 * come out human.
 */
function bone(x0: number, y0: number, w0: number, x1: number, y1: number, w1: number): number[] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return [
    x0 + nx * w0, y0 + ny * w0,
    x1 + nx * w1, y1 + ny * w1,
    x1 - nx * w1, y1 - ny * w1,
    x0 - nx * w0, y0 - ny * w0,
  ];
}

/**
 * The man, built out of eighteen filled parts rather than four strokes.
 *
 * He is small — about thirty-seven rows — but thirty-seven rows is a sprite,
 * not a pictogram, and there is room in it for a body that tapers to a waist,
 * a thigh heavier than its calf, an elbow, feet, and a head turned up at the
 * thing he is under. The earlier version spent that room on nothing: four
 * strokes of even width, which is the anatomy of a road sign.
 *
 * The stance is the reference vase's rather than a textbook push: both feet
 * low and behind on the shallow part of the slope, the body laid along the
 * diagonal, both arms up into the overhang. Standing square underneath makes a
 * caryatid, which is a different story about a different man.
 *
 * The arms run at about thirty degrees above horizontal, which looks shallow
 * written down and is right: the rock is ahead of him as much as above him, so
 * he is pushing along it. Arms raised to the vertical is a man holding
 * something up, and holding it up is the one thing Sisyphus never gets to do.
 */
const TORSO = [
  // Left side, shoulder to seat, then the right side back up. Stations at the
  // shoulders, chest, waist and hips, so it has a waist to taper to.
  450, 346, 444, 376, 437, 425, 418, 465, 405, 511,
  459, 529, 476, 485, 485, 441, 508, 398, 522, 370,
];
const LOINCLOTH = [404, 498, 468, 514, 458, 570, 398, 552];
// Seven heads to the figure, not five. The first pass gave him a head as wide
// as his own shoulders, which is a child's proportion and reads as a doll.
const HEAD = disc(458, 286, 27, 23, -0.4);
const HAIR = disc(438, 292, 15, 13, -0.35);

/** Every filled part of him, far side first so the near side draws over it. */
const FIGURE: { d: number[]; tone: number }[] = [
  { d: bone(476, 356, 17, 520, 318, 13), tone: 0.55 },
  { d: circle(520, 318, 13, 14), tone: 0.55 },
  { d: bone(520, 318, 13, 600, 288, 9), tone: 0.55 },
  { d: circle(602, 288, 12, 14), tone: 0.6 },
  { d: bone(412, 512, 27, 326, 584, 19), tone: 0.55 },
  { d: circle(326, 584, 18, 16), tone: 0.55 },
  { d: bone(326, 584, 19, 222, 692, 12), tone: 0.55 },
  { d: [200, 684, 248, 690, 250, 704, 196, 700], tone: 0.6 },
  { d: TORSO, tone: 1 },
  { d: LOINCLOTH, tone: 0.62 },
  { d: bone(466, 314, 11, 486, 358, 16), tone: 0.95 },
  { d: HAIR, tone: 0.78 },
  { d: HEAD, tone: 1 },
  { d: circle(452, 522, 24, 18), tone: 1 },
  { d: bone(452, 522, 28, 534, 578, 21), tone: 1 },
  { d: circle(534, 578, 19, 16), tone: 1 },
  { d: bone(534, 578, 21, 472, 640, 13), tone: 1 },
  { d: [442, 634, 494, 642, 496, 656, 438, 652], tone: 1 },
  { d: circle(510, 376, 19, 16), tone: 1 },
  { d: bone(510, 376, 20, 556, 330, 15), tone: 1 },
  { d: circle(556, 330, 14, 14), tone: 1 },
  { d: bone(556, 330, 15, 614, 258, 10), tone: 1 },
  { d: circle(616, 256, 13, 14), tone: 1 },
];

/**
 * The cuts. Dark strokes over the fill, and the whole interior of the figure.
 *
 * Four, and four is the ceiling. Six turns the torso into a barcode: a chest
 * six cells wide cannot hold three fold lines and still be a chest. These are
 * the four that do structural work — a neck, a pectoral, the near arm passing
 * in front of the ribs, and daylight between the legs.
 */
const CUTS: [number, number, ...number[]][] = [
  [1.1, 0.1, 466, 320, 492, 336],
  [0.9, 0.2, 462, 388, 502, 402],
  [1, 0.14, 506, 388, 492, 420],
  [1, 0.14, 436, 526, 448, 552],
];

function pusher(): Art['shapes'] {
  // A halo of nothing, first, and for the whole figure before any of it is
  // filled. He stands against the boulder's lit rim, and two bright shapes
  // touching on a grid this coarse are one shape. Drawing the same geometry at
  // tone zero with a fatter pen erases what is behind him, so the rock ends
  // where he begins — which is what a pot gets for free by painting the man in
  // the other colour.
  return [
    ...FIGURE.map(({ d }) => ({ tone: 0, stroke: 3, d })),
    ...FIGURE.map(({ d, tone }) => ({ tone, d })),
    ...CUTS.map(([w, tone, ...d]) => ({ tone, stroke: w, open: true, d })),
  ];
}

export const SISYPHUS_ART: Art = {
  w: 1080,
  // Taller than anything drawn in it. The artwork's own box is what the
  // closing line is placed against, so scree that runs to the bottom edge
  // arrives in the same rows as "one must imagine sisyphus happy".
  h: 848,
  shapes: [
    ...rays(),
    ...scree(),
    // The ridge over the grain, so the slope has an edge to it.
    { tone: 0.6, stroke: 1.8, open: true, d: RIDGE },
    // Cracks in the face, which is where the vase puts its lightning marks.
    { tone: 0.42, stroke: 1.4, open: true, d: [700, 540, 744, 598, 720, 642, 770, 714] },
    { tone: 0.38, stroke: 1.3, open: true, d: [880, 386, 920, 450, 890, 484, 932, 562] },
    { tone: 0.34, stroke: 1.2, open: true, d: [566, 630, 602, 686, 574, 720] },
    { tone: 0.3, stroke: 1.2, open: true, d: [316, 730, 372, 762, 344, 790] },
    { tone: 0.28, stroke: 1.1, open: true, d: [120, 764, 176, 792, 150, 806] },
    { tone: 0.32, stroke: 1.2, open: true, d: [430, 700, 486, 736, 462, 774, 520, 806] },
    { tone: 0.26, stroke: 1.1, open: true, d: [640, 742, 690, 776, 668, 806] },
    // The boulder: a dark mass, a lit crescent on the side the rays come from,
    // then the pitting, then a bright rim over all of it.
    { tone: 0.15, d: crag(ROCK_X, ROCK_Y, ROCK_RX, ROCK_RY, 22, 0.11, 7331) },
    { tone: 0.3, d: crag(ROCK_X - 48, ROCK_Y - 42, ROCK_RX * 0.7, ROCK_RY * 0.7, 18, 0.16, 991) },
    ...pitting(ROCK_X, ROCK_Y, ROCK_RX, ROCK_RY, 4242),
    {
      // Not full tone. The rim and the man would otherwise resolve to the same
      // glyph on the same sheet, and where they touch — which is the whole
      // subject — the picture loses which of them is which.
      tone: 0.72,
      edge: 'outer' as const,
      stroke: 1.6,
      d: crag(ROCK_X, ROCK_Y, ROCK_RX, ROCK_RY, 22, 0.11, 7331),
    },
    // Him last, in front of the rock he is under.
    ...pusher(),
  ],
};

// ── Wall·E ─────────────────────────────────────────────────────────────────
// Three-quarter, from a pen sketch, and built rather than traced. Tracing was
// tried first and failed for a reason worth writing down: a hatched drawing is
// tonally almost uniform — the information is in its edges, not in its
// values — so posterising it returns one textured lump at every setting.
//
// Assembled from boxes it also failed, four times, and always the same way:
// recognisably a robot, recognisably not Wall·E. What identifies him is a
// short list, and none of it is the box. It is two binocular eyes on a yoke,
// mounted forward on a thin neck; treads that splay wider than the body; and
// the fact that he is holding something up. Everything else can be crude.
//
// Drawn by erasing before outlining. Each mass takes its own cells back to
// black first and is then drawn as line work, so overlapping parts have real
// edges instead of merging into one bright field — which is the failure mode
// of every dense drawing on this page.

/** A rounded slab: the shape of a tank tread, and of a lens housing. */
function stadium(x0: number, y0: number, x1: number, y1: number, w: number): number[] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const a = Math.atan2(uy, ux);
  const d: number[] = [];
  for (let i = 0; i <= 12; i++) {
    const th = a - Math.PI / 2 + (i / 12) * Math.PI;
    d.push(x1 + Math.cos(th) * w, y1 + Math.sin(th) * w);
  }
  for (let i = 0; i <= 12; i++) {
    const th = a + Math.PI / 2 + (i / 12) * Math.PI;
    d.push(x0 + Math.cos(th) * w, y0 + Math.sin(th) * w);
  }
  return d;
}

/** A panel: its own cells back to black, then an edge round them. */
function panel(d: number[], tone: number, weight = 2): Art['shapes'] {
  return [
    { tone: 0, d },
    { tone, stroke: weight, d },
  ];
}

/**
 * One tread.
 *
 * Wider than the body and canted out, which is the silhouette people actually
 * remember — he is a box on two splayed tracks, and a box on two tidy tucked-in
 * ones is a filing cabinet.
 */
function tread(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  tone: number,
  links: number,
): Art['shapes'] {
  const out: Art['shapes'] = [...panel(stadium(x0, y0, x1, y1, w), tone, 2.2)];
  // The two road wheels, which are what says track rather than shoe.
  out.push({ tone: tone * 0.75, stroke: 1.6, d: circle(x0, y0, w * 0.58, 24) });
  out.push({ tone: tone * 0.75, stroke: 1.6, d: circle(x1, y1, w * 0.58, 24) });
  out.push({ tone: tone * 0.5, d: circle(x0, y0, w * 0.16, 12) });
  out.push({ tone: tone * 0.5, d: circle(x1, y1, w * 0.16, 12) });
  // Track links along the top and bottom runs.
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < links; i++) {
    const t = i / links;
    const cx = x0 + dx * t;
    const cy = y0 + dy * t;
    out.push({
      tone: tone * 0.52,
      stroke: 1.2,
      open: true,
      d: [cx + nx * w * 0.62, cy + ny * w * 0.62, cx + nx * w, cy + ny * w],
    });
    out.push({
      tone: tone * 0.52,
      stroke: 1.2,
      open: true,
      d: [cx - nx * w * 0.62, cy - ny * w * 0.62, cx - nx * w, cy - ny * w],
    });
  }
  return out;
}

/**
 * An eye.
 *
 * The whole character is in these. They are binoculars — two housings side by
 * side, the near one larger — and the lens inside each has to be *dark*, which
 * on this page means erased rather than shaded. A bright disc with a ring round
 * it is a headlamp.
 */
function eye(cx: number, cy: number, r: number): Art['shapes'] {
  return [
    { tone: 0, d: circle(cx, cy, r * 1.18, 30) },
    { tone: 1, stroke: 2.2, d: circle(cx, cy, r, 30) },
    // A pupil and nothing between it and the housing. An iris ring as well is
    // what the eye really has, and at thirteen cells across it lands against
    // the housing and the lens fills in solid.
    { tone: 0.85, d: circle(cx + r * 0.14, cy - r * 0.1, r * 0.3, 16) },
  ];
}

/** The body, as a parallelepiped: front face, left face, top. */
const FTL = [432, 442];
const FTR = [672, 486];
const FBR = [672, 702];
const FBL = [432, 660];
const BACK = [-108, -48];
const off = (p: number[]): number[] => [p[0] + BACK[0], p[1] + BACK[1]];
const FRONT = [...FTL, ...FTR, ...FBR, ...FBL];
const SIDE = [...off(FTL), ...FTL, ...FBL, ...off(FBL)];
const TOP = [...off(FTL), ...off(FTR), ...FTR, ...FTL];

/** A point some way across the front face, in face coordinates 0..1. */
function on(u: number, v: number): [number, number] {
  const ax = FTL[0] + (FTR[0] - FTL[0]) * u;
  const ay = FTL[1] + (FTR[1] - FTL[1]) * u;
  const bx = FBL[0] + (FBR[0] - FBL[0]) * u;
  const by = FBL[1] + (FBR[1] - FBL[1]) * u;
  return [ax + (bx - ax) * v, ay + (by - ay) * v];
}

/** The boot, side on: shaft at the left, toe out to the right. */
const BOOT = [
  788, 300, 964, 294, 970, 262, 878, 244, 874, 168, 804, 164, 798, 248, 784, 268,
];

/** Grit, and the tracks he has left in it. */
function ground(): Art['shapes'] {
  const rand = rng(20080627);
  const far: number[] = [];
  const near: number[] = [];
  for (let i = 0; i < 430; i++) {
    const t = Math.pow(rand(), 0.6);
    (rand() < 0.3 ? near : far).push(rand() * 1000, 700 + t * 120);
  }
  return [
    { tone: 0.07, specks: true, d: far },
    { tone: 0.16, specks: true, d: near },
  ];
}

/**
 * The sprout, redrawn each frame.
 *
 * The one thing in the picture that is alive, under a line about the difference
 * between surviving and living, and in the first version it sat as still as the
 * robot. It leans about two degrees either way over eleven seconds — slow
 * enough that a still capture of the hold is indistinguishable from any other,
 * and quick enough to notice while reading two lines of Wall·E.
 */
function sprout(t: number): Art['shapes'] {
  const sway = Math.sin(t / 1750) * 0.055 + Math.sin(t / 830) * 0.016;
  const bx = 840;
  const by = 168;
  const p = (h: number, k: number): [number, number] => {
    // Bending, not pivoting: the top of a stem travels further than its middle.
    const a = sway * h * h;
    return [bx + Math.sin(a) * h * 96 + k * Math.cos(a), by - Math.cos(a) * h * 96 + k * Math.sin(a)];
  };
  const stem: number[] = [];
  for (let i = 0; i <= 6; i++) stem.push(...p(i / 6, 0));
  const leaf = (h: number, dir: number, len: number): number[] => {
    const [x, y] = p(h, 0);
    const [tx, ty] = p(Math.min(1, h + 0.16), 0);
    const ux = (tx - x) / Math.hypot(tx - x, ty - y);
    const uy = (ty - y) / Math.hypot(tx - x, ty - y);
    // Out along the stem's own normal, then curled back toward the tip.
    const nx = -uy * dir;
    const ny = ux * dir;
    return [
      x, y,
      x + nx * len * 0.55 + ux * len * 0.22, y + ny * len * 0.55 + uy * len * 0.22,
      x + nx * len + ux * len * 0.62, y + ny * len + uy * len * 0.62,
      x + nx * len * 0.42 + ux * len * 0.78, y + ny * len * 0.42 + uy * len * 0.78,
    ];
  };
  return [
    { tone: 0.95, hue: 'plum', stroke: 1.8, open: true, d: stem },
    { tone: 0.8, hue: 'plum', d: leaf(0.52, -1, 62) },
    { tone: 0.9, hue: 'plum', d: leaf(0.74, 1, 68) },
    { tone: 0.7, hue: 'plum', d: leaf(0.98, -1, 44) },
  ];
}

export const WALLE_ART: Art = {
  w: 1000,
  h: 856,
  live: sprout,
  shapes: [
    ...ground(),
    // Far tread first: the part of it behind the body gets covered.
    ...tread(636, 600, 848, 690, 44, 0.55, 5),
    // The body. Front bright, the two faces turning away much dimmer — a box
    // whose three faces are all drawn at the same weight is a wireframe.
    ...panel(SIDE, 0.5, 1.6),
    ...panel(TOP, 0.55, 1.6),
    ...panel(FRONT, 0.85, 2.4),
    // The lid seam and the hatch. Wall·E's front is a door with a smaller door
    // in it, which is what makes the box read as a container and not a crate.
    // An earlier pass also had a badge plate and three louvres on it: true to
    // the sketch, and eleven lines inside twenty rows, which is a scribble.
    { tone: 0.4, stroke: 1.4, open: true, d: [...on(0, 0.34), ...on(1, 0.34)] },
    { tone: 0.5, stroke: 1.4, d: [...on(0.14, 0.48), ...on(0.86, 0.48), ...on(0.86, 0.88), ...on(0.14, 0.88)] },
    { tone: 0.38, stroke: 1.3, open: true, d: [...off(FTL), ...off(FBL)] },
    // Near tread, in front of the body's bottom corner.
    ...tread(250, 644, 486, 746, 54, 0.8, 6),
    // Neck and yoke. Thin, and set forward: the eyes cantilever out in front
    // of the body, which is the line of him.
    { tone: 0.8, stroke: 4, open: true, d: [476, 430, 468, 372, 498, 344] },
    { tone: 0.55, stroke: 1.5, d: circle(474, 402, 22, 16) },
    ...panel(stadium(448, 278, 568, 298, 50), 0.7, 1.8),
    ...eye(436, 268, 68),
    ...eye(576, 292, 54),
    // The near arm, folded down the left side, and its claw.
    { tone: 0.6, stroke: 2.8, open: true, d: [430, 498, 388, 566, 396, 628] },
    ...panel([376, 624, 420, 636, 414, 668, 370, 656], 0.6, 1.6),
    // The raised arm. Two straight rods and a boxy elbow, held out and up,
    // because holding something up is half of what he is doing here.
    { tone: 0.72, stroke: 3.2, open: true, d: [670, 506, 780, 436, 818, 336] },
    ...panel([760, 410, 804, 424, 794, 458, 750, 444], 0.7, 1.6),
    ...panel([798, 298, 848, 314, 838, 348, 788, 332], 0.8, 1.8),
    // The boot. It is a boot in the film and it has to be a boot here: a plant
    // in a pot is a houseplant, and the whole point is that it was found.
    ...panel(BOOT, 1, 2.4),
    // The welt above the sole, and three laces up the shaft.
    { tone: 0.55, stroke: 1.4, open: true, d: [792, 276, 950, 272] },
    ...[0.3, 0.64].map((v) => ({
      tone: 0.45,
      stroke: 1.2,
      open: true,
      d: [806 + v * 8, 176 + v * 62, 874 - v * 4, 180 + v * 58],
    })),
    // Soil in the boot, so the sprout is planted in something.
    { tone: 0.5, stroke: 1.5, open: true, d: [808, 176, 840, 168, 872, 178] },
  ],
};

// ── Dorian Gray ────────────────────────────────────────────────────────────
// An empty frame, which is the joke: the last image on a page about a person
// is a portrait with nobody in it, under a line about the fact that what you
// see in a picture is yourself.

const corner = (x: number, y: number, sx: number, sy: number): Art['shapes'] => [
  { tone: 0.9, stroke: 1.8, open: true, d: [x, y + 72 * sy, x, y, x + 72 * sx, y] },
  { tone: 0.6, stroke: 1.5, d: circle(x + 34 * sx, y + 34 * sy, 17, 14) },
];

/** Dust in the air of a room nobody comes into. */
function motes(): Art['shapes'] {
  const rand = rng(18910620);
  const pts: number[] = [];
  for (let i = 0; i < 110; i++) pts.push(rand() * 640, rand() * 900);
  return [{ tone: 0.09, specks: true, d: pts }];
}

export const DORIAN_ART: Art = {
  w: 640,
  h: 900,
  shapes: [
    ...motes(),
    // A skirting line, so the frame is hanging in a room rather than floating
    // in space. The one thing the picture needed was somewhere to be.
    { tone: 0.3, stroke: 1.4, open: true, d: [0, 884, 640, 884] },
    // Two mouldings with air between them. Three, at the fifty units apart the
    // first draft used, is under four cells for the lot: they merge into one
    // striped band and the frame stops being carved and starts being a border.
    { tone: 1, stroke: 2.8, d: [40, 40, 600, 40, 600, 820, 40, 820] },
    { tone: 0.6, stroke: 1.8, d: [128, 128, 512, 128, 512, 732, 128, 732] },
    // Nothing inside at all. A "faint wash" does not exist on this grid: the
    // dimmest tone still puts a character in every cell, so it arrives as
    // texture rather than as air and the frame ends up looking like a barcode.
    // The canvas is empty, which is also the joke.
    ...corner(40, 40, 1, 1),
    ...corner(600, 40, -1, 1),
    ...corner(600, 820, -1, -1),
    ...corner(40, 820, 1, -1),
    // The hanging wire.
    { tone: 0.5, stroke: 1.5, open: true, d: [320, 4, 40, 40] },
    { tone: 0.5, stroke: 1.5, open: true, d: [320, 4, 600, 40] },
  ],
};

// ── The iron ───────────────────────────────────────────────────────────────
// A loaded bar on the floor, which is the whole argument of the Rollins essay
// in one object: it is exactly as heavy as it says it is, and it does not care
// who is lifting it.
//
// Seen down its own length rather than side-on. Drawn square to the page, a
// barbell is two circles and a rule — symmetric, centred, and completely
// inert, which is a strange thing for a picture whose subject is effort. From
// one end it is a diagonal: a stack of plates as tall as the frame in the near
// corner, the shaft running away, and three much smaller plates at the far
// end. Same object, and now it has a near and a far.

/** The near end of the bar, and the far end. Everything else is measured off these. */
const BAR_N = [270, 500];
const BAR_F = [980, 300];
const BAR_LEN = Math.hypot(BAR_F[0] - BAR_N[0], BAR_F[1] - BAR_N[1]);
/** Unit vector down the bar, away from the viewer. */
const AX = (BAR_F[0] - BAR_N[0]) / BAR_LEN;
const AY = (BAR_F[1] - BAR_N[1]) / BAR_LEN;
/** The angle a plate's face presents: square across the bar. */
const FACE = Math.atan2(AX, -AY);
/**
 * How flat a disc goes at this viewing angle.
 *
 * Set by what has to fit inside it rather than by the geometry. A hard
 * three-quarter view — squash around 0.3 — is a far more convincing
 * foreshortened disc, and thirteen cells across: not enough room for a rim, a
 * lip, a hub and six grip holes, which collapse into one another and leave a
 * bright lozenge. Nearly face-on, a plate is a plate, and the picture gets its
 * movement from the diagonal and from the far end being two-thirds the size of
 * the near one instead.
 */
const SQUASH = 0.86;

const along = (t: number): [number, number] => [BAR_N[0] + AX * t, BAR_N[1] + AY * t];
/** The perpendicular offset that gives the shaft its thickness. */
const across = (t: number, w: number): [number, number] => [
  BAR_N[0] + AX * t - AY * w,
  BAR_N[1] + AY * t + AX * w,
];

/**
 * One forty-five: rim, lip, hub, six grip cut-outs and a light on the top edge.
 *
 * The cut-outs are what make it read as iron rather than as a coin. A plain
 * annulus at this size is a washer; the six holes are the thing everyone has
 * actually looked at while resting between sets.
 */
function plate(t: number, r: number, tone: number, lit: number): Art['shapes'] {
  const [cx, cy] = along(t);
  const e = (k: number, segs = 44, from = 0, to = Math.PI * 2) =>
    disc(cx, cy, r * k, r * k * SQUASH, FACE, segs, from, to);
  return [
    // The face at tone zero: not dark, *erased*. A dim fill is still a
    // character in every one of thirteen hundred cells, and the plate arrives
    // as a grey coin with a bright edge. Zero takes the cells back, so the
    // plate behind is properly hidden and a stack reads as three rings
    // overlapping instead of one thick smear.
    { tone: 0, d: e(1) },
    { tone: lit * 0.82, stroke: 2, d: e(1) },
    // The light, on the shoulder everything else on this page is lit from.
    { tone: lit, stroke: 2.4, open: true, d: e(1, 26, Math.PI * 0.6, Math.PI * 1.46) },
    // A hub and nothing else. The first version had a raised lip, six grip
    // cut-outs and a collar hole as well; all of it is true of a real
    // forty-five and all of it lands inside the same eight cells, which is how
    // an iron plate becomes a smudge.
    { tone: tone * 0.66, stroke: 1.4, d: e(0.26, 26) },
  ];
}

/** Chalk, hanging where his hands were. Nothing else in the room. */
function chalk(): Art['shapes'] {
  const rand = rng(19940201);
  const near: number[] = [];
  const far: number[] = [];
  for (let i = 0; i < 170; i++) {
    // Rising off the knurl and drifting one way, so the air is not symmetric.
    // A barbell is an object; the only thing that says a person was just here
    // is what is still moving above it.
    const t = Math.pow(rand(), 1.5);
    const [bx, by] = along(280 + rand() * 240);
    (rand() < 0.32 ? near : far).push(bx - t * 120 + (rand() - 0.5) * (56 + t * 190), by - t * 250 - 34);
  }
  return [
    { tone: 0.07, specks: true, d: far },
    { tone: 0.16, specks: true, d: near },
  ];
}

/** Where the plates meet the floor, and the chalk that got walked into it. */
function floor(): Art['shapes'] {
  const rand = rng(19610213);
  const pool: number[] = [];
  const dust: number[] = [];
  for (let i = 0; i < 300; i++) {
    const t = rand();
    const [bx, by] = along(t * BAR_LEN);
    const r = 150 - t * 96;
    pool.push(bx + (rand() - 0.5) * r * 2.6, by + 168 - t * 84 + (rand() - 0.5) * r * 0.42);
  }
  for (let i = 0; i < 220; i++) dust.push(rand() * 1180, 400 + Math.pow(rand(), 0.5) * 244);
  return [
    { tone: 0.06, specks: true, d: dust },
    { tone: 0.13, specks: true, d: pool },
  ];
}

export const IRON_ART: Art = {
  w: 1180,
  h: 720,
  shapes: [
    ...floor(),
    ...chalk(),
    // The shaft, tapering, as a filled band rather than two rules. Two rules is
    // what it was, and on a diagonal this shallow each of them stair-steps on
    // its own: seven cells across, drop a row, seven more. Two staircases a
    // couple of rows apart with knurling between them read as a ribbon of two
    // different materials, not as a bar. Filled, the steps belong to one edge
    // of one object, which is what they are.
    {
      tone: 0.5,
      d: [
        ...across(BAR_LEN - 30, 9),
        ...across(140, 16),
        ...across(140, -16),
        ...across(BAR_LEN - 30, -9),
      ],
    },
    // The lit top edge, which is the only thing that gives a cylinder any
    // roundness at this size.
    { tone: 0.9, stroke: 1.2, open: true, d: [...across(140, -15), ...across(BAR_LEN - 30, -8)] },
    // Knurling: ticks across the shaft, closing up as it goes away.
    ...Array.from({ length: 11 }, (_, i) => {
      const t = 200 + Math.pow(i / 10, 0.8) * 380;
      const w = 15 - (t / BAR_LEN) * 6;
      return { tone: 0.72, stroke: 1, open: true, d: [...across(t, w), ...across(t, -w)] };
    }),
    // Far end: three plates, outermost first, since out there it is the one
    // furthest away and everything nearer covers it.
    ...plate(BAR_LEN + 78, 102, 0.66, 0.56),
    ...plate(BAR_LEN + 39, 104, 0.74, 0.64),
    ...plate(BAR_LEN, 106, 0.82, 0.74),
    { tone: 0.5, stroke: 1.5, d: disc(...along(BAR_LEN - 46), 30, 30 * SQUASH, FACE, 22) },
    // Near end, in the other order, and half as big again. The three crescents
    // are the count — three a side, which is what the line under the picture
    // is doing arithmetic about.
    ...plate(150, 146, 0.78, 0.62),
    ...plate(75, 148, 0.9, 0.8),
    ...plate(0, 150, 1, 1),
    // The collar that holds them on, and the sleeve poking out past the last
    // plate. Without the stub the bar looks like it was pushed through a hole.
    { tone: 0.66, stroke: 1.7, d: disc(...along(208), 46, 46 * SQUASH, FACE, 26) },
    { tone: 0.8, stroke: 1.5, d: disc(...along(-40), 26, 26 * SQUASH, FACE, 22) },
    { tone: 0.7, stroke: 1.3, open: true, d: [...across(-40, 25), ...across(-4, 25)] },
    { tone: 0.7, stroke: 1.3, open: true, d: [...across(-40, -25), ...across(-4, -25)] },
  ],
};

export const GALLERY: Record<string, Art> = {
  sisyphus: SISYPHUS_ART,
  iron: IRON_ART,
  walle: WALLE_ART,
  dorian: DORIAN_ART,
};
