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

// ── Sisyphus ───────────────────────────────────────────────────────────────
// The reference is a biro sketch: a boulder scribbled in with a hundred
// overlapping strokes, a bent figure, a slope. The scribble reads as shading
// on paper because a pen stroke is thinner than the paper's grain; here every
// stroke is a whole character wide, so a hundred of them is not shading, it is
// a filled circle. Sixteen at a quarter brightness is as close as this grid
// gets to the idea, and the rest of the weight goes into the two things that
// have to be legible at forty cells: the ball, and the man under it.

const SLOPE: number[] = [0, 800, 1000, 250];
const BOULDER = { x: 690, y: 211, r: 210 };

function scribble(): Art['shapes'] {
  const rand = rng(20260909);
  const out: Art['shapes'] = [];
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2;
    const b = a + Math.PI * (0.5 + rand() * 0.6);
    // Kept well inside the rim: a chord that reaches the edge reads as another
    // limb sticking out of the man behind it.
    const ra = BOULDER.r * (0.4 + rand() * 0.34);
    const rb = BOULDER.r * (0.4 + rand() * 0.34);
    out.push({
      tone: 0.22 + rand() * 0.12,
      stroke: 1.3,
      open: true,
      d: [
        BOULDER.x + Math.cos(a) * ra, BOULDER.y + Math.sin(a) * ra,
        BOULDER.x + Math.cos(b) * rb, BOULDER.y + Math.sin(b) * rb,
      ],
    });
  }
  return out;
}

/**
 * The man: braced below and behind the stone, both hands on it, both feet on
 * the hill, at four fifths its radius from head to heel.
 *
 * A silhouette rather than a stick figure. The sketch draws him in lines and
 * that is what I built first, but a limb at this size is one cell wide, and a
 * one-cell arm beside a one-cell forearm beside the rim of the boulder is
 * three parallel lines in four cells — which arrives as gravel, not as a man.
 * Filled, he is unmistakable at sixteen rows, and the contrast is worth having
 * anyway: the stone is drawn, the man is solid, and the two never merge.
 */
const PUSHER: Art['shapes'] = [
  { tone: 1, d: circle(268, 322, 48, 20) },
  {
    tone: 1,
    d: [
      242, 372, 318, 396, 420, 372, 496, 348, 512, 382, 424, 412, 352, 448,
      344, 506, 388, 560, 410, 620, 438, 634, 392, 644, 354, 572, 306, 520,
      258, 592, 204, 668, 178, 692, 166, 664, 222, 588, 244, 500, 238, 424,
    ],
  },
];

/**
 * Scree on the hill and dust off his heels.
 *
 * The one slide on this page that already worked is the one with a branch
 * shedding petals across the whole frame, and most of what it had that the
 * others lacked was something in the empty parts of the picture. A hill with
 * nothing on it is a diagonal line; a hill with stones on it is a hill.
 */
function scree(): Art['shapes'] {
  const rand = rng(19421015);
  const on: number[] = [];
  const dust: number[] = [];
  for (let i = 0; i < 190; i++) {
    const x = rand() * 1000;
    const ground = 800 - (x / 1000) * 550;
    // Hugging the line rather than filling the hillside: scattered wide they
    // read as dirt on the lens, and in a band they read as loose ground.
    on.push(x, ground + 5 + rand() * rand() * 62);
  }
  for (let i = 0; i < 44; i++) {
    const x = 60 + rand() * 240;
    const ground = 800 - (x / 1000) * 550;
    dust.push(x, ground - rand() * rand() * 150);
  }
  return [
    { tone: 0.1, specks: true, d: on },
    { tone: 0.16, specks: true, d: dust },
  ];
}

export const SISYPHUS_ART: Art = {
  w: 1000,
  h: 800,
  shapes: [
    // A low sun over the crest. Camus' Sisyphus is a Mediterranean one, and it
    // gives the slide the second colour every other slide on this page has.
    { tone: 0.95, hue: 'plum', d: circle(178, 122, 58, 26) },
    { tone: 0.26, hue: 'plum', stroke: 1.2, d: circle(178, 122, 102, 30) },
    ...scree(),
    { tone: 1, stroke: 2, open: true, d: SLOPE },
    ...scribble(),
    { tone: 1, stroke: 2.6, d: circle(BOULDER.x, BOULDER.y, BOULDER.r, 44) },
    ...PUSHER,
  ],
};

// ── Pandora ────────────────────────────────────────────────────────────────
// A pithos, not a box: the "box" is a mistranslation of Erasmus's, and the
// storage jar is the better shape anyway — tall, open, and impossible to
// re-seal in a hurry. What escapes is drawn at runtime by the same particle
// plume as the R8's exhaust, a rhyme worth having two slides apart, and the
// reason this one is about AI without having to say so.
//
// Outline only. Filled even at a tenth brightness the jar came out as a lump
// with a texture on it: a dim fill still puts a character in every cell, and
// two thousand of them is a wall, not a shadow.

/**
 * The profile of a pithos: a narrow neck, a shoulder that turns hard, a belly,
 * and a base too small to stand on without a stone ring.
 *
 * Drawn with the shoulder high and the taper long. The first attempt put the
 * widest point in the middle, which is an urn — or, filled with a plume coming
 * out of the top, a light bulb.
 */
const JAR: number[] = [
  250, 150, 226, 214, 188, 268, 152, 350, 140, 438, 152, 530, 186, 626, 244, 726,
  306, 800, 394, 800, 456, 726, 514, 626, 548, 530, 560, 438, 548, 350, 512, 268,
  474, 214, 450, 150,
];

/** A circle squashed onto the horizontal, for a rim seen almost edge on. */
const ellipse = (cx: number, cy: number, rx: number, ry: number, segs = 30): number[] =>
  circle(cx, cy, rx, segs).map((v, i) => (i % 2 ? cy + ((v - cy) * ry) / rx : v));

/**
 * What is already out and gone. The plume at the mouth is drawn at runtime and
 * only reaches a fraction of the plane; these are the ones that left first.
 */
function escaped(): Art['shapes'] {
  const rand = rng(-700);
  const pts: number[] = [];
  for (let i = 0; i < 120; i++) {
    const t = rand();
    pts.push(350 + (rand() * 2 - 1) * (90 + t * 330), 120 - t * 130 + rand() * 80);
  }
  return [{ tone: 0.13, hue: 'plum', specks: true, d: pts }];
}

export const PANDORA_ART: Art = {
  w: 700,
  h: 900,
  shapes: [
    ...escaped(),
    { tone: 1, stroke: 2.6, open: true, d: JAR },
    // The rim is the brightest thing here, because it is the edge everything
    // came over.
    { tone: 1, stroke: 2.2, d: ellipse(350, 150, 100, 28) },
    { tone: 0.34, stroke: 1.3, d: ellipse(350, 150, 68, 19) },
    // Two cord bands round the belly. A jar drawn as one closed line reads as
    // a leaf; these are what make it a vessel with a far side.
    { tone: 0.42, stroke: 1.5, open: true, d: [146, 386, 220, 414, 350, 422, 480, 414, 554, 386] },
    { tone: 0.32, stroke: 1.4, open: true, d: [150, 512, 222, 540, 350, 548, 478, 540, 550, 512] },
    // The lid, off, lying face up beside it. Drawn as one arc and a knob
    // rather than as a closed ellipse: a rim twenty-six units deep is barely a
    // row here, so the near and far edges land in the same cells and the lid
    // comes out as a solid bar.
    { tone: 0.72, stroke: 1.6, open: true, d: [516, 818, 560, 800, 604, 796, 650, 802, 684, 818] },
    { tone: 0.6, stroke: 1.5, open: true, d: [604, 796, 604, 762] },
    { tone: 0.6, stroke: 1.4, open: true, d: [588, 762, 620, 762] },
  ],
};

/** Where the plume leaves the jar, in artwork pixels. */
export const PANDORA_MOUTH: [number, number] = [350, 130];

// ── Wall·E ─────────────────────────────────────────────────────────────────
// Boxy enough to survive being made of characters, which is why he works here
// and a rounder robot would not. Line work only, and lightly: he is four
// rectangles and two circles, and the first version drew all of them at a
// heavy weight over a dim fill, which welded them into one slab with eyes.

const eye = (cx: number): Art['shapes'] => [
  { tone: 1, stroke: 2.2, d: circle(cx, 216, 88, 30) },
  { tone: 1, d: circle(cx, 216, 26, 14) },
];

/**
 * The ground he is standing on, which in the film is the whole of Earth: the
 * cubes he has already made, and the dust that is left.
 */
function rubble(): Art['shapes'] {
  const rand = rng(20080627);
  const grit: number[] = [];
  for (let i = 0; i < 165; i++) grit.push(rand() * 860, 850 + rand() * 70);
  const cubes: Art['shapes'] = [
    { tone: 0.6, stroke: 1.6, d: [10, 778, 98, 778, 98, 866, 10, 866] },
    { tone: 0.42, stroke: 1.4, d: [24, 692, 98, 692, 98, 772, 24, 772] },
  ];
  return [{ tone: 0.12, specks: true, d: grit }, ...cubes];
}

export const WALLE_ART: Art = {
  // Wider than the robot, so the boot beside him stands clear of his treads
  // rather than growing out of them.
  w: 860,
  // Taller than he is, so the ground he stands on is inside the picture and
  // does not print under the closing line.
  h: 952,
  shapes: [
    ...rubble(),
    // Head: two lenses on one brow, on a stalk.
    ...eye(258),
    ...eye(502),
    { tone: 0.8, stroke: 1.8, open: true, d: [258, 128, 502, 128] },
    { tone: 0.7, stroke: 1.6, open: true, d: [346, 304, 346, 366] },
    { tone: 0.7, stroke: 1.6, open: true, d: [414, 304, 414, 366] },
    // Body: a cube that does not quite close, because his front is a door.
    { tone: 1, stroke: 2.4, d: [166, 366, 594, 366, 594, 606, 166, 606] },
    { tone: 0.55, stroke: 1.5, open: true, d: [380, 366, 380, 606] },
    { tone: 0.5, stroke: 1.5, d: [212, 414, 336, 414, 336, 506, 212, 506] },
    // Arms.
    { tone: 0.85, stroke: 1.9, open: true, d: [166, 414, 66, 462, 50, 558] },
    { tone: 0.85, stroke: 1.9, open: true, d: [594, 414, 678, 456, 686, 552] },
    // Treads.
    { tone: 1, stroke: 2.4, d: [110, 636, 650, 636, 650, 846, 110, 846] },
    { tone: 0.5, stroke: 1.6, d: circle(206, 740, 62, 22) },
    { tone: 0.5, stroke: 1.6, d: circle(554, 740, 62, 22) },
    { tone: 0.4, stroke: 1.5, open: true, d: [110, 792, 650, 792] },
    // The plant, in the boot he keeps it in, standing on the ground beside
    // him. Held up in his hand it lay along the forearm's own last segment and
    // the two arrived as one plum smear; on the ground it is unmistakably a
    // separate thing, which is the whole point of it. The only living thing in
    // the picture, so the only thing in it that is not bone.
    // A tub, not the boot from the film. A boot is a silhouette with a heel,
    // an ankle and a toe, and at five rows tall none of the three survive —
    // what arrives is a smudge that raises a question the picture cannot
    // answer. A tapered pot reads first time.
    { tone: 0.72, stroke: 1.6, open: true, d: [704, 866, 716, 798, 806, 798, 818, 866] },
    { tone: 0.8, stroke: 1.5, open: true, d: [696, 792, 826, 792] },
    { tone: 1, hue: 'plum', stroke: 1.5, open: true, d: [740, 790, 736, 704, 730, 624] },
    { tone: 0.85, hue: 'plum', stroke: 1.3, open: true, d: [734, 690, 684, 660, 672, 602] },
    { tone: 0.85, hue: 'plum', stroke: 1.3, open: true, d: [732, 662, 790, 636, 802, 580] },
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

const plate = (cx: number): Art['shapes'] => [
  { tone: 1, stroke: 2.6, d: circle(cx, 250, 186, 44) },
  { tone: 0.6, stroke: 1.6, d: circle(cx, 250, 152, 40) },
  { tone: 0.8, stroke: 1.8, d: circle(cx, 250, 58, 22) },
];

/** Chalk, hanging where his hands were. Nothing else in the room. */
function chalk(): Art['shapes'] {
  const rand = rng(19940201);
  const near: number[] = [];
  const far: number[] = [];
  for (let i = 0; i < 210; i++) {
    // Rising and drifting one way, so the picture is not perfectly symmetric.
    // A barbell drawn straight on is two circles and a rule; the only thing
    // that tells you a person was just here is the air above it.
    const t = Math.pow(rand(), 1.5);
    const x = 470 + t * 190 + (rand() - 0.5) * (80 + t * 300);
    (rand() < 0.32 ? near : far).push(x, 226 - t * 214);
  }
  return [
    { tone: 0.07, specks: true, d: far },
    { tone: 0.15, specks: true, d: near },
  ];
}

export const IRON_ART: Art = {
  w: 1100,
  h: 500,
  shapes: [
    ...chalk(),
    // The floor, so the weight is on the ground rather than floating.
    { tone: 0.5, stroke: 1.4, open: true, d: [20, 462, 1080, 462] },
    // The bar as a stroke, not a filled rectangle. Thirty artwork units is
    // under two rows here, and a fill that thin never covers a whole cell, so
    // it comes out as a dashed line — which is not what a bar looks like.
    { tone: 1, stroke: 2.8, open: true, d: [14, 250, 1086, 250] },
    // Collars.
    { tone: 0.85, stroke: 2.2, open: true, d: [424, 196, 424, 304] },
    { tone: 0.85, stroke: 2.2, open: true, d: [676, 196, 676, 304] },
    ...plate(226),
    ...plate(874),
  ],
};

// ── The spectacle ──────────────────────────────────────────────────────────
// Two men in a collar-and-elbow tie-up under a hard overhead light. Everyone
// in the building knows the result is written down somewhere and forty
// thousand people stand up anyway, which is Barthes' point and a fair
// description of every product demo ever given.
//
// The subject is the men, not the ring. Three attempts drew the ring: a
// championship belt hung in the V a real one hangs in came out as a moth, a
// square-on elevation came out as a lamp over a table, and a full ring in
// three-quarter perspective came out as the same table with more legs on it. A
// ring is furniture, and furniture drawn accurately is furniture. One corner
// post at the edge of the frame and three ropes running out of it say ring
// with four lines and leave the picture to the people in it.

/** The mat, and the height everything stands on. */
const MAT = 672;
/** The near corner post, at the left edge of the frame. */
const POST_X = 148;

/**
 * A wrestler, solid.
 *
 * Filled rather than drawn, for the same reason Sisyphus is: a limb at this
 * size is one cell wide, and an outlined figure with three ropes behind it is
 * a dozen parallel lines in as many cells.
 */
function wrestler(cx: number, dir: number): Art['shapes'] {
  const x = (v: number) => cx + v * dir;
  return [
    // Head down and turned in, with daylight at the neck. A disc sitting flat
    // on the shoulders is a lump; the gap is what makes it a head.
    { tone: 1, d: circle(x(30), 234, 50, 24) },
    {
      tone: 1,
      d: [
        x(-48), 298, x(56), 282, x(112), 308, x(176), 328,
        x(174), 366, x(106), 344, x(56), 372,
        x(58), 462, x(88), 540, x(102), 638,
        x(134), 660, x(58), 664, x(36), 550, x(2), 478,
        x(-26), 552, x(-48), 640,
        x(-24), 664, x(-90), 660, x(-72), 548, x(-48), 428, x(-58), 344,
      ],
    },
  ];
}

/** One rope, running from the near post out of frame and slightly away. */
const rope = (y: number, drop: number): Art['shapes'] => [
  { tone: 0.6, stroke: 1.3, open: true, d: [POST_X, y, 1200, y - drop] },
  { tone: 0.8, d: [POST_X - 30, y - 17, POST_X + 30, y - 17, POST_X + 30, y + 17, POST_X - 30, y + 17] },
];

/** The crowd: a dark bank of small marks below the apron, and nothing else. */
function crowd(): Art['shapes'] {
  const rand = rng(19870329);
  const near: number[] = [];
  const far: number[] = [];
  for (let i = 0; i < 420; i++) {
    const x = rand() * 1200;
    const y = 742 + Math.pow(rand(), 0.7) * 58;
    (rand() < 0.4 ? near : far).push(x, y);
  }
  return [
    { tone: 0.08, specks: true, d: far },
    { tone: 0.17, specks: true, d: near },
  ];
}

/** Motes in the beam, so the light has a volume rather than an outline. */
function beam(): Art['shapes'] {
  const rand = rng(19570101);
  const bright: number[] = [];
  const faint: number[] = [];
  for (let i = 0; i < 340; i++) {
    // Biased up the cone, so the beam is dense at the lamp and thins as it
    // spreads — which is what makes it read as light rather than as confetti.
    const t = Math.pow(rand(), 1.7);
    const half = 26 + t * 540;
    (rand() < 0.3 ? bright : faint).push(620 + (rand() * 2 - 1) * half, 58 + t * 620);
  }
  return [
    { tone: 0.1, hue: 'plum', specks: true, d: faint },
    { tone: 0.26, hue: 'plum', specks: true, d: bright },
  ];
}

export const RING_ART: Art = {
  w: 1200,
  h: 800,
  shapes: [
    ...crowd(),
    // The lamp. The one plum thing in the picture, because the line is about
    // the light and not about the wrestling. No hard cone edges: two lines
    // from a lamp to the floor draw a triangle, and a triangle over a
    // rectangle is a tent.
    { tone: 1, hue: 'plum', stroke: 2.2, d: circle(620, 42, 30, 18) },
    { tone: 0.8, hue: 'plum', stroke: 1.6, open: true, d: [620, 0, 620, 12] },
    ...beam(),
    // Clear of the wrestlers' heads: a rope at head height and a head are the
    // same two rows, and the figure loses its top.
    ...rope(398, 30),
    ...rope(500, 20),
    ...rope(602, 8),
    // The post last of the furniture, so the ropes end behind it.
    { tone: 0.78, stroke: 3.2, open: true, d: [POST_X, MAT, POST_X, 320] },
    { tone: 0.78, stroke: 2.6, open: true, d: [POST_X - 34, 314, POST_X + 34, 314] },
    { tone: 0.62, stroke: 1.6, open: true, d: [0, MAT, 1200, MAT] },
    { tone: 0.34, stroke: 1.4, open: true, d: [0, 734, 1200, 734] },
    // The men in front of all of it. A photograph from the crowd has the near
    // ropes crossing them, and drawn that way it is true and illegible: three
    // rules through a figure twenty rows tall leave four disconnected lumps.
    ...wrestler(596, 1),
    ...wrestler(984, -1),
  ],
};

export const GALLERY: Record<string, Art> = {
  sisyphus: SISYPHUS_ART,
  iron: IRON_ART,
  spectacle: RING_ART,
  pandora: PANDORA_ART,
  walle: WALLE_ART,
  dorian: DORIAN_ART,
};
