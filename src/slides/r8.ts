/**
 * The R8 slide: a stationary side elevation, its exhaust alight.
 *
 * The previous version was a rotating 3D loft, which was the wrong trade. It
 * spent its whole fidelity budget on being *turnable* rather than on being an
 * R8, and bought a camera move nobody wanted. A fixed side view can be traced
 * from a dimensioned drawing instead of sculpted by hand, so it is both less
 * code and a far better car.
 */

import { circle, type Art } from '../art';
import { GLASS_MAIN, GLASS_QUARTER, SHELL, SHELL_LOOPS } from './r8-paths';

const W = 955;
const H = 275;

/**
 * Wheels, from the measured wheelbase rather than from the trace.
 *
 * The drawing is 949 px for 4431 mm, so 0.2142 px/mm; the R8's 2650 mm
 * wheelbase is 568 px. Both wheels stand on the same ground line, which fixes
 * their centres once the rear one is measured off its own arch.
 */
const WHEEL_R = 67;
const REAR_X = 784;
const FRONT_X = REAR_X - 568;
const AXLE_Y = 201;

/**
 * A wheel, drawn for legibility rather than for accuracy.
 *
 * Five double spokes is what an R8 has and it is not what fits: at 130 cells
 * the wheel is eighteen cells across, and ten spokes inside that is a smudge.
 * What reads at this size is alternating light and dark rings — bright arch,
 * dark tyre, bright rim, dark face, bright hub — so that is what it gets.
 */
function wheel(cx: number): Art['shapes'] {
  return [
    { tone: 0.03, d: circle(cx, AXLE_Y, WHEEL_R * 0.97, 44) },
    { tone: 1, stroke: 1.6, d: circle(cx, AXLE_Y, WHEEL_R * 0.66, 44) },
    { tone: 0.5, stroke: 1.1, d: circle(cx, AXLE_Y, WHEEL_R * 0.4, 32) },
    { tone: 1, d: circle(cx, AXLE_Y, WHEEL_R * 0.16, 20) },
  ];
}

/**
 * The side blade.
 *
 * It is the one panel that identifies an R8 from across a street, and it is
 * the one the trace could not isolate — in the drawing its outline runs into
 * the door shut line, so its enclosed region merges with the whole flank. So
 * it is laid in by hand, over the traced body, against the drawing.
 */
const BLADE = [
  600, 30, 700, 40, 716, 96, 712, 150, 690, 186, 640, 196, 612, 150, 604, 84,
];

/**
 * Drawn as line work, not as filled tone.
 *
 * The first attempt filled the body bright and darkened the details, which is
 * how you would render a photograph — and on a black page it deletes exactly
 * the parts that identify the car. A tyre is black and glass is nearly black,
 * so both simply became holes, and the R8 came out with no wheels.
 *
 * The reference is a line elevation, so this is one too: a dim fill for mass,
 * and everything that carries the shape drawn as a bright stroke over it.
 */
export const R8_ART: Art = {
  w: W,
  h: H,
  shapes: [
    // A dim fill first, only so the car has mass and reads as a solid object
    // rather than an outline floating on the page. It has to stay well below
    // the line work or the lines stop being lines.
    { tone: 0.14, d: SHELL },
    { tone: 0.3, d: GLASS_MAIN },
    { tone: 0.3, d: GLASS_QUARTER },
    // Then the drawing. Everything that identifies the car is a bright line,
    // because that is what the reference is, and because a dark detail on a
    // black page is not a detail — it is the background.
    //
    // The rocker, sill and valance outlines are deliberately not here. They
    // are real features of the drawing and they made the car unreadable: at
    // this size every extra stroke competes with the silhouette, and the
    // silhouette is the only thing that has to survive.
    ...SHELL_LOOPS.map((d) => ({ tone: 1, d, stroke: 1.6 })),
    { tone: 0.9, d: GLASS_MAIN, stroke: 1.2 },
    { tone: 0.9, d: GLASS_QUARTER, stroke: 1.1 },
    { tone: 0.8, d: BLADE, stroke: 1.2 },
    ...wheel(FRONT_X),
    ...wheel(REAR_X),
  ],
};

/** Where the exhaust sits, in artwork pixels, for the flame emitters. */
export const PIPES: [number, number][] = [
  [905, 232],
  [880, 236],
];
