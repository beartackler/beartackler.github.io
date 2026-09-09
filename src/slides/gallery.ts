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
      stroke: 1,
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

export const SISYPHUS_ART: Art = {
  w: 1000,
  h: 800,
  shapes: [
    { tone: 0.85, stroke: 1.2, open: true, d: SLOPE },
    ...scribble(),
    { tone: 1, stroke: 1.6, d: circle(BOULDER.x, BOULDER.y, BOULDER.r, 44) },
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

const JAR: number[] = [
  244, 152, 218, 236, 164, 330, 132, 444, 140, 572, 184, 690, 252, 792, 302, 842,
  398, 842, 448, 792, 516, 690, 560, 572, 568, 444, 536, 330, 482, 236, 456, 152,
];

/** A circle squashed onto the horizontal, for a rim seen almost edge on. */
const ellipse = (cx: number, cy: number, rx: number, ry: number, segs = 30): number[] =>
  circle(cx, cy, rx, segs).map((v, i) => (i % 2 ? cy + ((v - cy) * ry) / rx : v));

export const PANDORA_ART: Art = {
  w: 700,
  h: 900,
  shapes: [
    { tone: 1, stroke: 1.5, open: true, d: JAR },
    // The rim is the brightest thing here, because it is the edge everything
    // came over.
    { tone: 1, stroke: 1.4, d: ellipse(350, 152, 106, 30) },
    // Two cord bands round the belly. A jar drawn as one closed line reads as
    // a leaf; these are what make it a vessel with a far side.
    { tone: 0.5, stroke: 1, open: true, d: [150, 400, 220, 424, 350, 432, 480, 424, 550, 400] },
    { tone: 0.42, stroke: 1, open: true, d: [148, 540, 220, 566, 350, 574, 480, 566, 552, 540] },
    // The lid, set down beside it and unmistakably off.
    { tone: 0.7, stroke: 1.2, d: ellipse(596, 806, 92, 26) },
    { tone: 0.7, stroke: 1, open: true, d: [578, 790, 596, 764, 614, 790] },
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
  { tone: 1, stroke: 1.3, d: circle(cx, 216, 88, 30) },
  { tone: 1, d: circle(cx, 216, 26, 14) },
];

export const WALLE_ART: Art = {
  w: 760,
  h: 900,
  shapes: [
    // Head: two lenses on one brow, on a stalk.
    ...eye(258),
    ...eye(502),
    { tone: 0.8, stroke: 1.2, open: true, d: [258, 128, 502, 128] },
    { tone: 0.7, stroke: 1.1, open: true, d: [346, 304, 346, 366] },
    { tone: 0.7, stroke: 1.1, open: true, d: [414, 304, 414, 366] },
    // Body: a cube that does not quite close, because his front is a door.
    { tone: 1, stroke: 1.4, d: [166, 366, 594, 366, 594, 606, 166, 606] },
    { tone: 0.55, stroke: 1, open: true, d: [380, 366, 380, 606] },
    { tone: 0.5, stroke: 1, d: [212, 414, 336, 414, 336, 506, 212, 506] },
    // Arms.
    { tone: 0.85, stroke: 1.2, open: true, d: [166, 414, 82, 456, 74, 552] },
    { tone: 0.85, stroke: 1.2, open: true, d: [594, 414, 678, 456, 686, 552] },
    // Treads.
    { tone: 1, stroke: 1.4, d: [110, 636, 650, 636, 650, 846, 110, 846] },
    { tone: 0.5, stroke: 1, d: circle(206, 740, 62, 22) },
    { tone: 0.5, stroke: 1, d: circle(554, 740, 62, 22) },
    { tone: 0.4, stroke: 1, open: true, d: [110, 792, 650, 792] },
    // The sprout. The whole film is about this and it is three strokes.
    { tone: 1, stroke: 1.3, open: true, d: [74, 552, 74, 404] },
    { tone: 1, stroke: 1.2, open: true, d: [74, 452, 22, 412, 12, 356] },
    { tone: 1, stroke: 1.2, open: true, d: [74, 438, 128, 402, 138, 344] },
  ],
};

// ── Dorian Gray ────────────────────────────────────────────────────────────
// An empty frame, which is the joke: the last image on a page about a person
// is a portrait with nobody in it, under a line about the fact that what you
// see in a picture is yourself.

const corner = (x: number, y: number, sx: number, sy: number): Art['shapes'] => [
  { tone: 0.9, stroke: 1.2, open: true, d: [x, y + 64 * sy, x, y, x + 64 * sx, y] },
  { tone: 0.6, stroke: 1, d: circle(x + 32 * sx, y + 32 * sy, 15, 14) },
];

export const DORIAN_ART: Art = {
  w: 640,
  h: 860,
  shapes: [
    // Two mouldings with air between them. Three, at the fifty units apart the
    // first draft used, is under four cells for the lot: they merge into one
    // striped band and the frame stops being carved and starts being a border.
    { tone: 1, stroke: 1.6, d: [40, 40, 600, 40, 600, 820, 40, 820] },
    { tone: 0.6, stroke: 1.2, d: [128, 128, 512, 128, 512, 732, 128, 732] },
    // Nothing inside at all. A "faint wash" does not exist on this grid: the
    // dimmest tone still puts a character in every cell, so it arrives as
    // texture rather than as air and the frame ends up looking like a barcode.
    // The canvas is empty, which is also the joke.
    ...corner(40, 40, 1, 1),
    ...corner(600, 40, -1, 1),
    ...corner(600, 820, -1, -1),
    ...corner(40, 820, 1, -1),
    // The hanging wire.
    { tone: 0.5, stroke: 1, open: true, d: [320, 4, 40, 40] },
    { tone: 0.5, stroke: 1, open: true, d: [320, 4, 600, 40] },
  ],
};

// ── The iron ───────────────────────────────────────────────────────────────
// A loaded bar on the floor, which is the whole argument of the Rollins essay
// in one object: it is exactly as heavy as it says it is, and it does not care
// who is lifting it.

const plate = (cx: number): Art['shapes'] => [
  { tone: 1, stroke: 1.5, d: circle(cx, 250, 186, 44) },
  { tone: 0.6, stroke: 1.1, d: circle(cx, 250, 152, 40) },
  { tone: 0.8, stroke: 1.2, d: circle(cx, 250, 58, 22) },
];

export const IRON_ART: Art = {
  w: 1100,
  h: 500,
  shapes: [
    // The floor, so the weight is on the ground rather than floating.
    { tone: 0.4, stroke: 1, open: true, d: [20, 478, 1080, 478] },
    // The bar as a stroke, not a filled rectangle. Thirty artwork units is
    // under two rows here, and a fill that thin never covers a whole cell, so
    // it comes out as a dashed line — which is not what a bar looks like.
    { tone: 1, stroke: 1.8, open: true, d: [14, 250, 1086, 250] },
    // Knurling, where the hands go.
    ...[500, 528, 556, 584, 612].map((x) => ({
      tone: 0.45,
      stroke: 1,
      open: true,
      d: [x, 234, x, 268],
    })),
    // Collars.
    { tone: 0.85, stroke: 1.6, open: true, d: [424, 196, 424, 304] },
    { tone: 0.85, stroke: 1.6, open: true, d: [676, 196, 676, 304] },
    ...plate(226),
    ...plate(874),
  ],
};

// ── The spectacle ──────────────────────────────────────────────────────────
// A ring under a hard overhead light. Everyone in the building knows the
// result is written down somewhere and forty thousand people stand up anyway,
// which is Barthes' point and a fair description of every product demo ever
// given. Drawn as the room rather than as a prop: a championship belt was the
// first attempt and, hung in the V that a real one hangs in, it came out as a
// moth. The lamp is here because the line is about the lamp.

const post = (x: number): Art['shapes'] => [
  { tone: 1, stroke: 2, open: true, d: [x, 238, x, 536] },
  { tone: 0.8, stroke: 1.4, open: true, d: [x - 28, 232, x + 28, 232] },
];

/**
 * One rope and its two turnbuckles.
 *
 * Spaced ninety units apart rather than seventy. A one-cell stroke that lands
 * across a row boundary is promoted in both rows, so every horizontal rule
 * here is one row or two depending on where it falls — and at the tighter
 * spacing three ropes could arrive as six lines with no daylight between them.
 */
const rope = (y: number): Art['shapes'] => [
  { tone: 0.95, stroke: 1.2, open: true, d: [200, y, 1000, y] },
  { tone: 0.65, stroke: 1.6, open: true, d: [200, y - 16, 200, y + 16] },
  { tone: 0.65, stroke: 1.6, open: true, d: [1000, y - 16, 1000, y + 16] },
];

export const RING_ART: Art = {
  w: 1200,
  h: 780,
  shapes: [
    // The lamp, and its cone. Kept outside the posts so it lights the ring
    // rather than drawing lines across the ropes.
    { tone: 1, stroke: 1.4, d: circle(600, 46, 34, 18) },
    { tone: 1, stroke: 1.2, open: true, d: [600, 0, 600, 12] },
    { tone: 0.3, stroke: 1, open: true, d: [578, 74, 104, 524] },
    { tone: 0.3, stroke: 1, open: true, d: [622, 74, 1096, 524] },
    ...post(200),
    ...post(1000),
    ...rope(284),
    ...rope(374),
    ...rope(464),
    // Mat and apron. The trapezoid's own top edge is the mat, so there is no
    // separate line for it: two rules a row apart is a rail, not a ring.
    { tone: 1, stroke: 1.5, d: [104, 536, 1096, 536, 1046, 720, 154, 720] },
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
