/**
 * The R8 slide: a stationary side elevation, its exhaust alight.
 *
 * The previous version was a rotating 3D loft, which was the wrong trade. It
 * spent its whole fidelity budget on being *turnable* rather than on being an
 * R8, and bought a camera move nobody wanted. A fixed side view can be traced
 * from a dimensioned drawing instead of sculpted by hand, so it is both less
 * code and a far better car.
 *
 * Drawn as line work, with no body fill at all. Two attempts got this wrong in
 * opposite directions. Filling the body bright and darkening the details is how
 * you render a photograph, and on a black page it deletes exactly the parts
 * that identify the car — a tyre is black and glass is nearly black, so both
 * become holes and the R8 arrives with no wheels. Filling it dim instead is
 * worse in a subtler way: tone picks the *glyph*, not the opacity, so a
 * tone-0.13 flank is still a fully opaque character in every one of two
 * thousand cells. It reads as a grey brick with a car-shaped edge.
 *
 * The reference is a line elevation and so is this. Black between the lines is
 * not missing information, it is the drawing.
 */

import { circle, type Art, type Shape } from '../art';

/** Deterministic noise, so the road under the car is the same road each frame. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
import { BONNET, DECK, FLANK, GLASS, HEAD_LAMP, OUTLINE, TAIL_LAMP, VALANCE } from './r8-paths';

const W = 955;
/**
 * Taller than the drawing, so the road under the car is inside the picture.
 *
 * The artwork's own box is what the caption is placed against, so anything
 * drawn past it prints underneath the closing line.
 */
const H = 302;

/**
 * Wheels, measured off the trace rather than drawn by hand.
 *
 * The rear tyre survives the trace as one closed region (panel 5, 134 px
 * across); the front one comes through as the second silhouette loop, because
 * the drawing detaches it from the body at the arch. Both centres agree with
 * the published 2650 mm wheelbase to within 7 mm at this scale, which is the
 * check that the drawing is dimensioned rather than sketched.
 */
const WHEEL_R = 67;
const REAR_X = 784;
const FRONT_X = 218;
const AXLE_Y = 201;

/**
 * Tyre, rim, hub, spokes.
 *
 * Drawn from geometry rather than from the traced spoke panels, and stopping
 * at a tyre, a rim and a hub. At eighteen cells across, a spoke is one cell
 * wide: five of them drawn deliberately were no better than fifteen traced
 * faithfully, because both come out as a grey disc. Two rings and a dot is the
 * most a wheel this size can say.
 */
function wheel(cx: number): Shape[] {
  return [
    { tone: 1, stroke: 1.6, d: circle(cx, AXLE_Y, WHEEL_R, 40) },
    { tone: 0.62, stroke: 1.2, d: circle(cx, AXLE_Y, WHEEL_R * 0.6, 30) },
    { tone: 0.9, d: circle(cx, AXLE_Y, WHEEL_R * 0.14, 12) },
  ];
}

/**
 * The interior lines worth drawing, chosen by hand out of fifty-one.
 *
 * All fifty-one is much worse than seven. The drawing is 955 px wide and the
 * car renders at about 120 cells, so seven reference pixels land in one cell:
 * most of that line work is sub-cell, and drawing it does not add detail, it
 * adds an even grey texture that eats the silhouette. Nothing here is invented
 * — these are traced regions, just the ones large enough to survive the
 * resample, and each is a feature you would name describing the car.
 *
 * The flank is the surprise. Its *boundary* is the whole interior drawing at
 * once: both wheel arches, the shoulder line down the door, the sill, and the
 * leading edge of the sideblade. An earlier pass threw it away on the grounds
 * that the outline of the biggest region must just be the silhouette drawn
 * twice — exactly wrong, because the silhouette runs along the ground under
 * the tyres and this one runs around the arches.
 */
const FEATURES: { d: number[]; tone: number; weight: number }[] = [
  { d: FLANK, tone: 0.62, weight: 1 },
  { d: BONNET, tone: 0.85, weight: 1 },
  { d: GLASS, tone: 1, weight: 1 },
  { d: DECK, tone: 0.8, weight: 1 },
  { d: VALANCE, tone: 0.6, weight: 1 },
  { d: HEAD_LAMP, tone: 1, weight: 1 },
  { d: TAIL_LAMP, tone: 1, weight: 1 },
];

/**
 * Grit and tyre smoke on the road under it.
 *
 * The car was the only thing in its frame, and a drawing alone in the middle
 * of a black plane reads as a diagram. The slide that works best on this page
 * is the one with a branch shedding petals across the whole of it.
 */
function road(): Shape[] {
  const rand = rng(20070101);
  const grit: number[] = [];
  const smoke: number[] = [];
  for (let i = 0; i < 170; i++) grit.push(rand() * W, 272 + rand() * 24);
  for (let i = 0; i < 90; i++) {
    // Behind the rear wheel, thinning as it goes.
    const t = Math.pow(rand(), 1.4);
    smoke.push(784 + t * 240 + (rand() - 0.5) * 60, 250 - t * rand() * 90 + rand() * 30);
  }
  return [
    { tone: 0.09, specks: true, d: grit },
    { tone: 0.14, specks: true, d: smoke },
  ];
}

export const R8_ART: Art = {
  w: W,
  h: H,
  shapes: [
    ...road(),
    ...FEATURES.map(({ d, tone, weight }) => ({ tone, edge: true as const, stroke: weight, d })),
    ...wheel(FRONT_X),
    ...wheel(REAR_X),
    // The silhouette last and brightest, so nothing crosses it. Only the body
    // loop: the second one is the front wheel, which is drawn above.
    // One cell, not two. Every other slide on this page is drawn with a heavy
    // line because that is what gives them the presence the ikigai mark has,
    // but the car carries five times as much detail as any of them: at two
    // cells its own silhouette closes over the wheel arches and the sills.
    // Weight here comes from tone instead — the outline resolves to the top of
    // the ramp and the panels to the middle of it.
    { tone: 1, edge: 'outer' as const, d: OUTLINE },
  ],
};

/**
 * Where the exhaust sits, in artwork pixels, for the flame emitters.
 *
 * Measured off the drawing's rear valance rather than off the ground: the R8's
 * pipes are ovals set high in the bumper, and lighting them level with the
 * sills made the car look like it was on fire underneath rather than on the
 * overrun.
 */
export const PIPES: [number, number][] = [
  [912, 214],
  [890, 221],
];
