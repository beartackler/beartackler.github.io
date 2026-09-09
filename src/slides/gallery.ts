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
// overlapping strokes, a bent figure, a slope. The scribble is the character
// of it, so the boulder is drawn the same way rather than filled — chords
// across a circle, which is what a hand does when it shades one in.

const SLOPE: [number, number] = [20, 620];
const SLOPE_END: [number, number] = [980, 300];
const BOULDER = { x: 620, y: 220, r: 200 };

function scribble(): Art['shapes'] {
  const rand = rng(20260909);
  const out: Art['shapes'] = [];
  for (let i = 0; i < 78; i++) {
    const a = rand() * Math.PI * 2;
    const b = a + Math.PI * (0.45 + rand() * 0.85);
    // Pulled inside the rim so the scribble reads as shading rather than as a
    // cage drawn over the top of the ball.
    const ra = BOULDER.r * (0.72 + rand() * 0.26);
    const rb = BOULDER.r * (0.72 + rand() * 0.26);
    out.push({
      tone: 0.42 + rand() * 0.4,
      stroke: 0.9,
      open: true,
      d: [
        BOULDER.x + Math.cos(a) * ra, BOULDER.y + Math.sin(a) * ra,
        BOULDER.x + Math.cos(b) * rb, BOULDER.y + Math.sin(b) * rb,
      ],
    });
  }
  return out;
}

export const SISYPHUS_ART: Art = {
  w: 1000,
  h: 660,
  shapes: [
    { tone: 0.1, d: circle(BOULDER.x, BOULDER.y, BOULDER.r, 48) },
    ...scribble(),
    { tone: 1, stroke: 1.5, d: circle(BOULDER.x, BOULDER.y, BOULDER.r, 48) },
    // The slope, and the figure leaning into it.
    //
    // Scaled against the boulder rather than drawn small: in the sketch the
    // man is about half the stone's diameter, and at a third of it he stopped
    // reading as a man at all and became a scuff mark on the hill.
    { tone: 0.8, stroke: 1.4, open: true, d: [...SLOPE, ...SLOPE_END] },
    { tone: 1, stroke: 1.4, d: circle(418, 318, 30, 18) },
    { tone: 1, stroke: 1.7, open: true, d: [404, 346, 372, 402, 366, 424] },
    { tone: 1, stroke: 1.4, open: true, d: [398, 352, 438, 316, 452, 300] },
    { tone: 1, stroke: 1.4, open: true, d: [386, 372, 432, 344, 450, 330] },
    { tone: 1, stroke: 1.5, open: true, d: [366, 424, 352, 470, 344, 506] },
    { tone: 1, stroke: 1.5, open: true, d: [366, 424, 318, 462, 300, 512] },
  ],
};

// ── Pandora ────────────────────────────────────────────────────────────────
// A pithos, not a box: the "box" is a mistranslation, and the jar is the more
// interesting shape anyway. What escapes is drawn at runtime by the same
// particle plume as the R8's exhaust — a rhyme worth having two slides apart,
// and the reason this one is about AI without having to say so.

export const PANDORA_ART: Art = {
  w: 780,
  h: 640,
  shapes: [
    {
      tone: 0.16,
      d: [295, 250, 250, 330, 236, 430, 278, 520, 390, 552, 502, 520, 544, 430, 530, 330, 485, 250],
    },
    {
      tone: 1,
      stroke: 1.5,
      d: [295, 250, 250, 330, 236, 430, 278, 520, 390, 552, 502, 520, 544, 430, 530, 330, 485, 250],
    },
    // Mouth, open. The rim is the brightest thing here, because it is the
    // edge everything came over.
    { tone: 1, stroke: 1.6, d: circle(390, 250, 100, 32).map((v, i) => (i % 2 ? 250 + (v - 250) * 0.28 : v)) },
    { tone: 0.62, stroke: 1.1, d: circle(390, 332, 142, 32).map((v, i) => (i % 2 ? 332 + (v - 332) * 0.22 : v)) },
    // The lid, set down beside it.
    { tone: 0.8, stroke: 1.2, d: circle(650, 470, 86, 24).map((v, i) => (i % 2 ? 470 + (v - 470) * 0.3 : v)) },
  ],
};

/** Where the plume leaves the jar, in artwork pixels. */
export const PANDORA_MOUTH: [number, number] = [390, 236];

// ── Wall·E ─────────────────────────────────────────────────────────────────
// Boxy enough to survive being made of characters, which is why he works here
// and a more detailed robot would not.

const eye = (cx: number): Art['shapes'] => [
  { tone: 0.08, d: circle(cx, 250, 86, 28) },
  { tone: 1, stroke: 1.6, d: circle(cx, 250, 86, 28) },
  { tone: 1, d: circle(cx, 250, 30, 18) },
  { tone: 0.7, stroke: 1.1, d: circle(cx, 250, 56, 22) },
];

export const WALLE_ART: Art = {
  w: 760,
  h: 820,
  shapes: [
    // Treads.
    { tone: 0.12, d: [96, 600, 664, 600, 664, 780, 96, 780] },
    { tone: 1, stroke: 1.5, d: [96, 600, 664, 600, 664, 780, 96, 780] },
    { tone: 0.75, stroke: 1.2, d: circle(180, 690, 62, 20) },
    { tone: 0.75, stroke: 1.2, d: circle(580, 690, 62, 20) },
    { tone: 0.5, stroke: 1, open: true, d: [96, 640, 664, 640] },
    { tone: 0.5, stroke: 1, open: true, d: [96, 740, 664, 740] },
    // Body: a cube that does not quite close, because his front is a door.
    { tone: 0.14, d: [150, 380, 610, 380, 610, 600, 150, 600] },
    { tone: 1, stroke: 1.6, d: [150, 380, 610, 380, 610, 600, 150, 600] },
    { tone: 0.6, stroke: 1.1, open: true, d: [380, 380, 380, 600] },
    { tone: 0.6, stroke: 1.1, d: [206, 430, 330, 430, 330, 520, 206, 520] },
    // Arms.
    { tone: 0.9, stroke: 1.3, open: true, d: [150, 430, 70, 470, 62, 560] },
    { tone: 0.9, stroke: 1.3, open: true, d: [610, 430, 690, 470, 698, 560] },
    // Neck and head.
    { tone: 0.8, stroke: 1.2, open: true, d: [330, 380, 330, 320] },
    { tone: 0.8, stroke: 1.2, open: true, d: [430, 380, 430, 320] },
    { tone: 0.9, stroke: 1.4, open: true, d: [214, 300, 546, 300] },
    ...eye(268),
    ...eye(492),
    // The sprout. The whole film is about this and it is four strokes.
    { tone: 1, stroke: 1.3, open: true, d: [62, 560, 62, 500] },
    { tone: 1, stroke: 1.2, open: true, d: [62, 512, 30, 486, 24, 452] },
    { tone: 1, stroke: 1.2, open: true, d: [62, 506, 96, 482, 104, 448] },
  ],
};

// ── Dorian Gray ────────────────────────────────────────────────────────────
// An empty frame, which is the joke: the last image on a page about a person
// is a portrait with nobody in it, under a line about the fact that what you
// see in a picture is yourself.

const corner = (x: number, y: number, sx: number, sy: number): Art['shapes'] => [
  { tone: 0.85, stroke: 1.2, open: true, d: [x, y + 54 * sy, x, y, x + 54 * sx, y] },
  { tone: 0.7, stroke: 1, d: circle(x + 26 * sx, y + 26 * sy, 14, 14) },
];

export const DORIAN_ART: Art = {
  w: 640,
  h: 860,
  shapes: [
    { tone: 0.95, stroke: 1.7, d: [40, 40, 600, 40, 600, 820, 40, 820] },
    { tone: 0.55, stroke: 1.1, d: [88, 88, 552, 88, 552, 772, 88, 772] },
    { tone: 1, stroke: 1.5, d: [140, 140, 500, 140, 500, 720, 140, 720] },
    // Nothing inside at all. A "faint wash" does not exist here: the dimmest
    // tone still puts a character in every cell, so it comes out as texture
    // rather than as air, and the frame ends up looking like a barcode. The
    // canvas is empty, which is also the joke.
    ...corner(40, 40, 1, 1),
    ...corner(600, 40, -1, 1),
    ...corner(600, 820, -1, -1),
    ...corner(40, 820, 1, -1),
    // The hanging wire.
    { tone: 0.55, stroke: 1, open: true, d: [320, 6, 40, 40] },
    { tone: 0.55, stroke: 1, open: true, d: [320, 6, 600, 40] },
  ],
};

export const GALLERY: Record<string, Art> = {
  sisyphus: SISYPHUS_ART,
  pandora: PANDORA_ART,
  walle: WALLE_ART,
  dorian: DORIAN_ART,
};
