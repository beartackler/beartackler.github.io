/**
 * Draw loop. Every visible cell is one `drawImage` from a pre-coloured sheet;
 * cells are bucketed by (sheet, quantised alpha) so a frame costs a few dozen
 * context state changes instead of several thousand.
 */

import { Atlas, Sheet } from './atlas';
import { Field, LOCK_TIME } from './field';
import type { LinkRegion, Plane } from './layout';

/**
 * Alpha buckets. Every step is a visible brightness plateau while the resume
 * fades out on scroll, so this is a smoothness knob, not just a batching one.
 * Empty buckets are skipped, so the cost of raising it is nil.
 */
const ALPHA_STEPS = 32;
const FLOOR = 0.035; // below this a cell is simply dark
const HAZE_TEXT = 0.78; // haze is stronger over text than over empty field
const HAZE_EMPTY = 0.52;
/** Uniform, so a glow that crosses type is no brighter than one that doesn't. */
const HAZE_FLOOR = 0.62;
/**
 * Where the lantern's fringe stops being amber and starts being hot.
 *
 * A lamp is whiter at its core than at its edge, and the page has both inks
 * already. Splitting the haze across them at one threshold is the difference
 * between a flat orange disc and something with a centre.
 */
const HAZE_HOT = 0.62;
/** How much resolved type spills into the space around it. See `Field.halate`. */
const HALO = 0.32;
/**
 * How much of the decode window the first letter of a word still churns for.
 * Below 1 every letter gets at least a flicker; at 1 the first one never
 * scrambles at all and the word looks like it grew a head.
 */
const LOCK_STAGGER = 0.82;

/** Sheets are drawn in this order so resolved type sits above the haze. */
const DRAW_ORDER = [
  Sheet.Glow,
  Sheet.Display,
  Sheet.Ink,
  Sheet.Dim,
  Sheet.Muted,
  Sheet.GlowHot,
  Sheet.Bark,
  Sheet.Bloom,
  Sheet.BloomDeep,
];

/**
 * How much earlier the top of the page fades than the bottom.
 *
 * A single alpha ramped across the whole plane steps through its buckets in
 * lockstep, which reads as the page blinking down through a handful of levels.
 * Skewing it by row turns the same fade into a wipe: the resume dissolves from
 * the top down, following the branch in, and no two rows change level on the
 * same frame.
 */
const FADE_SKEW = 0.4;

/** A second layer drawn above the grid, owned by the plum blossom. */
export type Overlay = {
  char: Uint16Array;
  sheet: Uint8Array;
  alpha: Float32Array;
};

/**
 * The mark's own ramp, hand-ordered rather than measured.
 *
 * The haze ramp is built from each glyph's ink coverage at the current font
 * size, which is right for a halftone fringe but wrong for a single stroke:
 * its mid-range reshuffles between cell sizes, so the same intensity draws a
 * solid `@` on a desktop and a faint squiggle on a phone. The mark needs one
 * stroke weight that means the same thing everywhere.
 */
const MARK_RAMP = ['.', ':', '+', '*', '@', '#'].map((c) => c.charCodeAt(0));

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private buckets: number[][] = [];
  private codes: number[][] = [];
  /** Reused per frame so the loop allocates nothing. */
  private frame = 0;
  /** The link under the pointer, drawn hot so hovering reads as a hover. */
  hot: LinkRegion | null = null;
  /** Multiplies everything the lantern lit; the resume fades out on scroll. */
  fade = 1;
  /** 0 keeps the mark amber, 1 turns it to ink for act two. */
  tint = 0;
  overlay: Overlay | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private plane: Plane,
    private field: Field,
    private atlas: Atlas,
    private dpr: number,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < DRAW_ORDER.length * ALPHA_STEPS; i++) {
      this.buckets.push([]);
      this.codes.push([]);
    }
  }

  setPlane(plane: Plane, field: Field, atlas: Atlas): void {
    this.plane = plane;
    this.field = field;
    this.atlas = atlas;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;
  }

  draw(originX: number, originY: number, bg: string): void {
    const { ctx, plane, field, atlas, dpr } = this;
    const { cellH } = atlas;
    this.frame++;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const b of this.buckets) b.length = 0;
    for (const c of this.codes) c.length = 0;

    const firstRow = Math.max(0, Math.floor(-originY / cellH));
    const lastRow = Math.min(
      plane.rows - 1,
      Math.ceil((-originY + this.canvas.height / dpr) / cellH),
    );
    const ramp = atlas.ramp;
    const scramble = atlas.scramble;
    const fadeBase = this.fade;
    const tint = this.tint;
    const lastPlaneRow = Math.max(1, plane.rows - 1);
    const hotRow = this.hot ? this.hot.row : -1;
    const hotCol = this.hot ? this.hot.col : 0;
    const hotEnd = this.hot ? this.hot.col + this.hot.len : 0;

    for (let r = firstRow; r <= lastRow; r++) {
      // Rows near the top of the plane go first; see FADE_SKEW.
      const fade =
        fadeBase >= 1
          ? 1
          : Math.min(1, Math.max(0, (fadeBase - FADE_SKEW * (1 - r / lastPlaneRow)) / (1 - FADE_SKEW)));
      for (let c = 0; c < plane.cols; c++) {
        const i = r * plane.cols + c;
        const glow = field.floor[i];
        // Scaled by `fade` before anything is compared against it: as the
        // resume fades out in act two, the mark has to be able to win cells
        // the lantern already burned in, or it disintegrates against its own
        // ghost halfway through the journey.
        //
        // `live` is the lantern; `lit` is the lantern or the developed page.
        // The two are kept apart because only one of them is allowed to draw
        // halftone: a burned-in cell means *developed*, and a developed cell
        // that still shows fringe glyphs is a permanent smear of garbled
        // punctuation with no way ever to become a word.
        const live = field.lit(i) * fade;
        const lit = Math.max(live, field.ink[i] * fade);
        const l = Math.max(lit, glow);
        const spill = field.halo[i] * fade;
        if (l < FLOOR && spill < FLOOR) continue;

        const code = plane.chars[i];
        const isText = code !== 0;
        const run = isText ? plane.runId[i] : -1;
        // Words resolve as words, on their brightest cell.
        const resolve = run >= 0 ? smoothstep(0.24, 0.46, field.runLight[run]) : 0;
        /** How much of the word is actually on screen, fade included. */
        const shown = resolve * fade;

        // Halftone haze — the ASCII-art layer. A cell lit by `floor` uses one
        // multiplier either way, so a ring crossing the page reads as a single
        // continuous line rather than tracing where the text is.
        const byFloor = glow >= lit;
        // Two different jobs. The lantern's haze is the fringe *around* type
        // that has not resolved yet, so it must vanish with the fade rather
        // than grow into it — otherwise every fading word swaps its glyphs for
        // halftone ones and reads as corruption. The mark's haze is the mark
        // itself: it takes cells as their word gives them up, and stops being
        // a glow behind the resume to become the only ink on the page.
        const hazeA = byFloor
          ? l * (1 - shown) * (HAZE_FLOOR + (1 - HAZE_FLOOR) * tint)
          : live * (1 - resolve) * (isText ? HAZE_TEXT : HAZE_EMPTY) +
            // Type bleeds into the space beside it, never over other type:
            // spill on an occupied cell would fight the word that owns it.
            (isText ? 0 : spill * HALO);
        if (hazeA >= 0.02) {
          // Jitter gives the lantern's haze its grain, but it would scatter the
          // mark's glyphs. The mark also sits at the dense end of the ramp:
          // mid-density punctuation reads as stray text, `#%@` reads as a line.
          // The mark keeps to the dense end of its own ramp, where a cell
          // reads as part of a line; the haze gets the measured ramp and a
          // per-cell jitter, which is what gives it its grain.
          // Spill is deliberately read at a lower density than the lantern's
          // own light: the halo wants dots and commas, the faint end of the
          // ramp, where a cell reads as a grain of light. At the same density
          // as the fringe it picks `+` and `(` and the gaps between words fill
          // with things that look like typed characters.
          const dens = byFloor ? l : Math.max(live, spill * 0.5);
          const ch = byFloor
            ? MARK_RAMP[Math.min(MARK_RAMP.length - 1, Math.floor((0.5 + 0.5 * l) * MARK_RAMP.length))]
            : ramp[
                Math.max(
                  0,
                  Math.min(
                    ramp.length - 1,
                    Math.floor(dens * (0.75 + field.seed[i] * 0.5) * ramp.length),
                  ),
                )
              ];
          if (byFloor) {
            // The mark crossfades from safelight amber to ink as act two opens.
            // Ink, not bark: the wood of the branch is deliberately dim, and
            // the mark is the one thing left on the page.
            const warm = glow > 0.7 ? Sheet.GlowHot : Sheet.Glow;
            if (tint > 0.01) this.push(Sheet.Ink, hazeA * tint, i, ch);
            if (tint < 0.99) this.push(warm, hazeA * (1 - tint), i, ch);
          } else {
            // Hot at the core, amber at the fringe.
            this.push(dens > HAZE_HOT ? Sheet.GlowHot : Sheet.Glow, hazeA, i, ch, field.dither[i]);
          }
        }

        if (!isText || resolve <= 0.02) continue;

        // Resolved type, or the brief scramble on the way in.
        // A word decodes front to back rather than all at once. The lock is
        // one countdown for the whole run; where a cell sits inside the word
        // decides how much of it that cell actually serves, so the first
        // letter settles almost immediately and the last one is still
        // churning. Flipping every letter on the same frame is a cut, not a
        // decode — the eye reads it as the word being swapped rather than
        // arriving.
        const lock = field.runLock[run];
        if (lock > 0 && lock > LOCK_TIME * (1 - plane.runPos[i] / plane.runLen[run]) * LOCK_STAGGER) {
          // Offset by the cell's own seed, or neighbours march through the
          // alphabet in lockstep instead of looking like noise.
          const pick =
            (((this.frame / 3) | 0) + ((field.seed[i] * scramble.length) | 0)) % scramble.length;
          this.push(Sheet.GlowHot, resolve * fade, i, scramble[pick]);
        } else if (hotRow === r && c >= hotCol && c < hotEnd) {
          this.push(Sheet.GlowHot, fade, i, code);
        } else {
          // Live words burn brighter than ones already developed.
          const settled = 0.72 + 0.28 * Math.min(1, field.runLive[run] / 0.6);
          this.push(plane.tone[i], resolve * settled * fade, i, code);
        }
      }
    }

    // The blossom sits above the grid, so it goes in last.
    const ov = this.overlay;
    if (ov) {
      for (let i = firstRow * plane.cols; i <= lastRow * plane.cols + plane.cols - 1; i++) {
        const a = ov.alpha[i];
        if (a < 0.05) continue;
        this.push(ov.sheet[i], a, i, ov.char[i]);
      }
    }

    this.flush(originX, originY);
  }

  /**
   * `dither` breaks the alpha quantisation.
   *
   * Alpha is bucketed so the draw can batch, which means brightness moves in
   * plateaus — and a plateau boundary drawn across a round pool of light is a
   * visible concentric ring. Offsetting each cell's rounding by its own blue
   * noise scatters the boundary into grain instead, which is the same trick
   * an ordered dither plays on a gradient and costs one add.
   */
  private push(sheet: number, alpha: number, cell: number, code: number, dither = 0.5): void {
    const order = DRAW_ORDER.indexOf(sheet as (typeof DRAW_ORDER)[number]);
    const step = Math.min(ALPHA_STEPS - 1, Math.floor(alpha * ALPHA_STEPS + dither));
    if (step < 1) return;
    const key = order * ALPHA_STEPS + step;
    this.buckets[key].push(cell);
    this.codes[key].push(code);
  }

  private flush(originX: number, originY: number): void {
    const { ctx, atlas, plane, dpr } = this;
    const w = Math.round(atlas.cellW * dpr);
    const h = Math.round(atlas.cellH * dpr);

    for (let order = 0; order < DRAW_ORDER.length; order++) {
      const sheet = atlas.sheets[DRAW_ORDER[order]];
      for (let step = 1; step < ALPHA_STEPS; step++) {
        const key = order * ALPHA_STEPS + step;
        const cells = this.buckets[key];
        if (cells.length === 0) continue;
        ctx.globalAlpha = step / ALPHA_STEPS;
        const codes = this.codes[key];
        for (let n = 0; n < cells.length; n++) {
          const cell = cells[n];
          const c = cell % plane.cols;
          const r = (cell - c) / plane.cols;
          ctx.drawImage(
            sheet,
            atlas.sx(codes[n]),
            0,
            w,
            h,
            Math.round((c * atlas.cellW + originX) * dpr),
            Math.round((r * atlas.cellH + originY) * dpr),
            w,
            h,
          );
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
