/**
 * The gallery's timeline.
 *
 * The page used to be one continuous morph with no resting states, and it had
 * a bug that no amount of tuning could fix: act two's finished composition —
 * mark, branch and closing line together — occupied about 0.06 of the scroll.
 * Its own fade took 1.4s. So at any real scrolling speed the thing it spent a
 * viewport and a half assembling was gone before it finished arriving, and a
 * visitor moving quickly never saw it at all.
 *
 * The fix is structural. Every scene owns three beats — enter, hold, exit —
 * and **nothing driven by scroll changes during the hold**. That single rule
 * turns a morph into a sequence of slides: each composition is guaranteed a
 * stretch of scroll where it simply sits there and can be read.
 *
 * Beats are measured in viewports, so the timeline is resolution-independent
 * and a slide occupies the same fraction of a scroll gesture on any screen.
 */

/** Lengths of a scene's three beats, in viewports. */
export type Beat = { enter: number; hold: number; exit: number };

export type Phase = {
  /** 0..1 across the entrance. */
  in: number;
  /** 0..1 across the hold. 0 and 1 both mean "resting". */
  held: number;
  /** 0..1 across the exit. */
  out: number;
  /**
   * Overall presence: rises to 1 on entering, stays there through the hold,
   * falls to 0 on leaving. Everything a scene fades gets multiplied by this.
   */
  on: number;
  /** Whether the scene is close enough to the viewport to be worth drawing. */
  live: boolean;
};

export const RESTING: Phase = { in: 0, held: 0, out: 0, on: 0, live: false };

export type Scene = {
  id: string;
  beat: Beat;
  /** Key in resume.json for this scene's closing line, if it has one. */
  quote?: string;
};

/**
 * The running order.
 *
 * The first two scenes are longer because they have more to assemble — a mark
 * that travels the whole page, a branch that grows, a car that has to arrive
 * before it can be looked at. The rest are single images and need less.
 *
 * The running order is an argument, not a playlist: purpose, then speed, then
 * the labour underneath it, then the honesty of that labour, then living
 * rather than surviving, and finally the mirror.
 *
 * Holds are never shorter than half a viewport. Below that a fast scroll can
 * cross one inside a single inertial fling, which is the failure this whole
 * structure exists to prevent.
 */
const SHORT: Beat = { enter: 0.5, hold: 0.55, exit: 0.3 };

export const SCENES: Scene[] = [
  { id: 'ikigai', beat: { enter: 1.15, hold: 0.7, exit: 0.45 }, quote: 'coda' },
  { id: 'r8', beat: { enter: 1.0, hold: 0.8, exit: 0.45 }, quote: 'drive' },
  { id: 'sisyphus', beat: SHORT, quote: 'sisyphus' },
  { id: 'iron', beat: SHORT, quote: 'iron' },
  { id: 'walle', beat: SHORT, quote: 'walle' },
  { id: 'dorian', beat: { enter: 0.5, hold: 0.65, exit: 0.3 }, quote: 'dorian' },
];

const LEN = (b: Beat) => b.enter + b.hold + b.exit;

/** Total length of the timeline, in viewports. */
export const SPAN = SCENES.reduce((n, s) => n + LEN(s.beat), 0);

/** Cumulative start of each scene, in viewports. */
const STARTS: number[] = [];
{
  let at = 0;
  for (const s of SCENES) {
    STARTS.push(at);
    at += LEN(s.beat);
  }
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Where a scene has got to, given the journey's overall 0..1 position.
 *
 * `live` is deliberately generous at the edges: a scene that has just finished
 * exiting still gets a frame or two to write zero alpha, otherwise whatever it
 * last drew stays on the plane.
 */
export function phaseOf(index: number, p: number): Phase {
  const s = SCENES[index];
  const at = p * SPAN - STARTS[index];
  const b = s.beat;
  const inP = b.enter > 0 ? clamp01(at / b.enter) : 1;
  const held = b.hold > 0 ? clamp01((at - b.enter) / b.hold) : 1;
  const out = b.exit > 0 ? clamp01((at - b.enter - b.hold) / b.exit) : 0;
  return {
    in: inP,
    held,
    out,
    on: inP * (1 - out),
    live: at > -0.35 && at < LEN(b) + 0.35,
  };
}

/** The scene with the strongest claim on the page right now. */
export function activeScene(p: number): number {
  const v = p * SPAN;
  for (let i = SCENES.length - 1; i >= 0; i--) if (v >= STARTS[i]) return i;
  return 0;
}

/**
 * The 0..1 position of the middle of a scene's hold.
 *
 * This is where `space` and the keyboard land, because the middle of a hold is
 * the only place in the timeline guaranteed to be a finished composition.
 */
export function restOf(index: number): number {
  const b = SCENES[index].beat;
  return (STARTS[index] + b.enter + b.hold / 2) / SPAN;
}

/** The rest position of the next scene after `p`, for paging forward. */
export function nextRest(p: number, dir: number): number {
  const here = p * SPAN;
  const rests = SCENES.map((_, i) => restOf(i) * SPAN);
  if (dir > 0) {
    for (const r of rests) if (r > here + 0.05) return r / SPAN;
    return 1;
  }
  for (let i = rests.length - 1; i >= 0; i--) if (rests[i] < here - 0.05) return rests[i] / SPAN;
  return 0;
}
