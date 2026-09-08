/**
 * A plum branch in ASCII, growing across the top of the screen as the visitor
 * scrolls.
 *
 * The geometry is generated once from a fixed seed, so the branch is the same
 * on every visit, and every segment, flower and falling petal carries the
 * scroll position at which it appears. Rasterising is therefore a pure
 * function of progress: scrolling back up retracts the branch exactly the way
 * it grew.
 *
 * The one thing that makes or breaks it is slope. A bough that crosses the
 * screen in long shallow steps picks the `-` glyph for every one of them and
 * reads as a dashed rule; plum wood is angular, so the spine takes short runs
 * and large alternating rises, which puts most segments on `/` and `\`.
 */

import { Sheet } from './atlas';
import type { Overlay } from './render';

/** Deterministic, so the branch is the same every visit. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Seg = { c0: number; r0: number; c1: number; r1: number; w0: number; w1: number; at: number };
type Flower = { c: number; r: number; big: boolean; at: number };
type Petal = { c: number; r: number; code: number; at: number };

/** Five petals around a stamen. At cell aspect ~1.4, 5 × 3 reads as round. */
const BIG = [' o o ', 'o * o', '  o  '];
const SMALL = [' o ', 'o*o'];

/** Bark's solid core, cycled by position so old wood reads as texture. */
const CORE = [35, 37, 64, 35]; // # % @ #

/** Flowers must be able to take a cell the wood already claimed. */
const P_WOOD = 0;
const P_BLOOM = 1;

export class Blossom {
  private readonly segs: Seg[] = [];
  private readonly flowers: Flower[] = [];
  private readonly petals: Petal[] = [];
  private readonly prio: Uint8Array;

  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly aspect: number,
    seed = 20260908,
  ) {
    this.prio = new Uint8Array(cols * rows);
    const rnd = rng(seed);
    // Rows the bough may occupy. It keeps to the top third; the ikigai mark
    // owns everything below, so the two never crowd each other.
    const band = Math.max(10, rows * 0.3);

    // The bough enters high on the left and works down to the right, so the
    // blossom mass gathers where the page has nothing else and only the thin
    // start of the wood crosses the wordmark as it fades. The spine is a
    // descending centre line with an alternating offset around it: controlled
    // enough to read as one bough, angular enough to read as plum wood.
    const spine: { c: number; r: number }[] = [{ c: -6, r: 4 }];
    let sign = 1;
    while (spine[spine.length - 1].c < cols * 0.97) {
      const last = spine[spine.length - 1];
      // Runs vary wildly and rises are squared toward zero, so the bough gets
      // long level sweeps punctuated by sharp kinks. Alternating every segment
      // by the same amount would draw a sawtooth, which is the other way to
      // fail at this.
      const jump = rnd();
      if (rnd() < 0.62) sign = -sign;
      const kick = rnd();
      // Amplitudes are fractions of the band, not fixed row counts: a phone
      // plane is half again as tall in rows, and a branch with desktop-sized
      // kinks leaves a dead strip between itself and the mark.
      const rise = sign * (0.4 + kick * kick * band * 0.32);
      // Two constraints on the run. Level stretches are allowed but kept
      // short, or the bough draws as an unbroken row of `-` — a rule, not a
      // branch. And a run shorter than its rise draws a near-vertical `|`,
      // which turns consecutive segments into sawtooth peaks.
      const run = Math.max(cols * (0.028 + jump * jump * 0.1), Math.abs(rise) * 1.35);
      const c = last.c + (Math.abs(rise) < 1.5 ? Math.min(run, 7) : run);
      const centre = 4 + Math.min(1, Math.max(0, c / cols)) * band * 0.32;
      spine.push({ c, r: Math.max(3, Math.min(band, centre + rise)) });
    }

    const spans = spine.length - 1;
    const width = (t: number) => 2.6 - t * 2;
    for (let i = 0; i < spans; i++) {
      this.segs.push({
        c0: spine[i].c,
        r0: spine[i].r,
        c1: spine[i + 1].c,
        r1: spine[i + 1].r,
        w0: width(i / spans),
        w1: width((i + 1) / spans),
        at: (i / spans) * 0.5,
      });
    }

    // Twigs leave the bough at steep angles — that is what puts `|` on the
    // page and stops the whole thing reading as one horizontal stroke. The
    // last joint always gets one, so the bough ends in blossom rather than
    // trailing off as bare wood.
    for (let i = 1; i < spine.length; i++) {
      const t = i / spans;
      // Every joint with two forks apiece buries the bough in scribble; the
      // flowers, not the wood, are supposed to carry the mass.
      if (i < spans && i % 2 === 0 && rnd() < 0.6) continue;
      const forks = rnd() < 0.25 ? 2 : 1;
      for (let f = 0; f < forks; f++) {
        // Mostly up, into the empty strip above the bough.
        // Up into the strip above the bough where there is nothing, unless
        // this stretch of bough is already near the top edge.
        const up = spine[i].r < 4 || rnd() > 0.7 ? 1 : -1;
        const at = 0.14 + t * 0.42;
        let c = spine[i].c;
        let r = spine[i].r;
        let w = 1.6;
        const joints = 2;
        for (let j = 0; j < joints; j++) {
          // Twigs run further than they rise, or every one of them draws as a
          // bare `|` column and the branch grows a picket fence.
          const run = (2.4 + rnd() * 3.4) * (rnd() < 0.42 ? -0.6 : 1);
          const rise = up * band * (0.06 + rnd() * 0.09);
          const c2 = c + run;
          const r2 = Math.max(2, Math.min(band + rows * 0.06, r + rise));
          const w2 = w * 0.55;
          this.segs.push({
            c0: c,
            r0: r,
            c1: c2,
            r1: r2,
            w0: w,
            w1: w2,
            at: at + j * 0.045,
          });
          c = c2;
          r = r2;
          w = w2;
        }
        // Two or three blossoms at the tip, offset so they read as a cluster
        // rather than as one symmetrical stamp.
        const cluster = 3 + Math.floor(rnd() * 3);
        for (let n = 0; n < cluster; n++) {
          this.flowers.push({
            c: Math.round(c + (rnd() - 0.5) * 8),
            r: Math.round(r + (rnd() - 0.5) * band * 0.18),
            big: n === 0 || rnd() < 0.45,
            at: at + 0.12 + n * 0.045 + rnd() * 0.12,
          });
        }
      }
    }

    // A few blossoms sit directly on the bough, the way they do on old wood.
    for (let i = 2; i < spine.length - 1; i += 2) {
      if (rnd() < 0.45) continue;
      this.flowers.push({
        c: Math.round(spine[i].c + (rnd() - 0.5) * 4),
        r: Math.round(spine[i].r - band * (0.08 + rnd() * 0.09)),
        big: rnd() < 0.5,
        at: 0.28 + (i / spans) * 0.42,
      });
    }

    // Petals adrift below the branch, arriving last: near ones still read as
    // petals, far ones as specks.
    for (let i = 0; i < 22; i++) {
      const near = rnd() < 0.45;
      this.petals.push({
        c: Math.round(cols * (0.05 + rnd() * 0.9)),
        r: Math.round(band + 2 + rnd() * rows * 0.34),
        code: near ? 111 : 46, // o .
        at: 0.5 + rnd() * 0.36,
      });
    }
  }

  /** How many blossoms there are in total. */
  get total(): number {
    return this.flowers.length;
  }

  /** How many are open at progress `p`. The second act's progress readout. */
  opened(p: number): number {
    let n = 0;
    for (const f of this.flowers) if (p > f.at) n++;
    return n;
  }

  /** Rasterises the branch grown to `p` into `out`, which must be cleared. */
  render(out: Overlay, p: number): void {
    if (p <= 0) return;
    this.prio.fill(0);
    for (const s of this.segs) {
      const local = (p - s.at) / 0.1;
      if (local <= 0) continue;
      this.stroke(out, s, Math.min(1, local));
    }
    for (const f of this.flowers) {
      const local = (p - f.at) / 0.12;
      if (local <= 0) continue;
      this.bloom(out, f, Math.min(1, local));
    }
    for (const t of this.petals) {
      const local = (p - t.at) / 0.14;
      if (local <= 0) continue;
      this.put(out, t.c, t.r, t.code, Sheet.Bloom, Math.min(1, local) * 0.42, P_BLOOM);
    }
  }

  /**
   * Draws one tapering segment, grown from its base to `grown`.
   *
   * A brush stroke, not a swept disc: one cell wide along the line, thickened
   * perpendicular to it where the wood is old. Discs merge into blobs the
   * moment two segments meet, which is what turns a branch into a mountain
   * range.
   */
  private stroke(out: Overlay, s: Seg, grown: number): void {
    const dc = (s.c1 - s.c0) * grown;
    const dr = (s.r1 - s.r0) * grown;
    const len = Math.hypot(dc, dr * this.aspect);
    if (len < 0.001) return;

    // Direction picks the glyph, so the wood reads as brush strokes.
    const angle = Math.atan2(dr * this.aspect, dc);
    const abs = Math.abs(angle);
    const dir =
      abs < 0.42 || abs > Math.PI - 0.42 ? 45 : abs > 1.16 ? 124 : dr * dc > 0 ? 92 : 47; // - | \ /

    // Unit normal, in cell units, so thickening reads the same either way.
    const nc = (-dr * this.aspect) / len;
    const nr = dc / (len * this.aspect);

    const steps = Math.max(1, Math.ceil(len * 1.6));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const c = s.c0 + dc * t;
      const r = s.r0 + dr * t;
      const w = s.w0 + (s.w1 - s.w0) * (t * grown);
      const arms = w >= 2.3 ? 2 : w >= 1.4 ? 1 : 0;
      for (let k = -arms; k <= arms; k++) {
        const cc = Math.round(c + nc * k);
        const rr = Math.round(r + nr * k);
        // Old wood is a solid mass at its core and a line at its edge. The
        // core alternates glyphs, or a long stretch of it reads as a printed
        // bar rather than bark.
        const code = arms === 2 && k === 0 ? CORE[(cc * 7 + rr * 3) % CORE.length] : dir;
        this.put(
          out,
          cc,
          rr,
          code,
          Sheet.Bark,
          // Bark stops short of full alpha so a blossom can take the cell.
          0.78 - Math.abs(k) * 0.14,
          P_WOOD,
        );
      }
    }
  }

  private bloom(out: Overlay, f: Flower, open: number): void {
    const art = f.big ? BIG : SMALL;
    const w = art[0].length;
    // A blossom sliced by the top edge reads as a rendering error, so keep
    // every one of them whole.
    const top = Math.max(0, f.r - (f.big ? 1 : 0));
    for (let r = 0; r < art.length; r++) {
      for (let c = 0; c < w; c++) {
        const ch = art[r][c];
        if (ch === ' ') continue;
        const sheet = ch === '*' ? Sheet.BloomDeep : Sheet.Bloom;
        this.put(out, f.c - (w >> 1) + c, top + r, ch.charCodeAt(0), sheet, open, P_BLOOM);
      }
    }
  }

  private put(
    out: Overlay,
    c: number,
    r: number,
    code: number,
    sheet: number,
    alpha: number,
    prio: number,
  ): void {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return;
    const i = r * this.cols + c;
    if (prio < this.prio[i]) return;
    if (prio === this.prio[i] && alpha <= out.alpha[i]) return;
    out.char[i] = code;
    out.sheet[i] = sheet;
    out.alpha[i] = alpha;
    this.prio[i] = prio;
  }
}
