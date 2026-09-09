/**
 * One renderer for every drawn thing in the gallery.
 *
 * Each slide is a set of filled polygons and stroked polylines in its own pixel
 * space, scanline-rasterised into character cells with subsampled coverage and
 * resolved through the page's own measured density ramp. Six slides drawn by
 * six different methods would look like six different projects; one primitive
 * is what makes a plum branch, a car and a boulder feel like the same page.
 *
 * Coverage and tone are kept apart deliberately. Tone is what the shape *is* —
 * bone bodywork, dark glass — and coverage is how much of the cell it fills.
 * Multiplying them at the end means a half-covered bright panel and a fully
 * covered dim one land on different glyphs, which is most of what stops
 * ASCII art at this size reading as a stencil.
 */

import { Sheet } from './atlas';
import type { Overlay } from './render';

/** Samples per cell, per axis. Nine samples is enough to hide the grid. */
const SUB = 3;
const WEIGHT = 1 / (SUB * SUB);

export type Shape = {
  /** Flat [x0,y0,x1,y1,…] in the artwork's own pixel space. */
  d: readonly number[];
  /** 0..1 brightness of the region itself, before coverage. */
  tone: number;
  /**
   * Stroke width in *cells*, not artwork pixels. Omit to fill instead.
   *
   * Cells, because a line narrower than a cell does not render as a line: its
   * coverage is a fraction, and the compositor dilutes it into whatever it is
   * drawn over. It comes out as a smudge the colour of the fill, which is how
   * an entire car came to be drawn with no visible wheels.
   */
  stroke?: number;
  /** Stroke an open path rather than closing it back to the start. */
  open?: boolean;
};

export type Art = {
  w: number;
  h: number;
  shapes: Shape[];
};

/** Where an artwork lands on the plane. */
export type Box = {
  /** Left edge and top edge, in cells. */
  col: number;
  row: number;
  /** Cells per artwork pixel. */
  scale: number;
  /** Cell height ÷ cell width. */
  aspect: number;
};

/** Fits an artwork inside a cell box, preserving its aspect ratio. */
export function fit(art: Art, cols: number, rows: number, cx: number, cy: number, aspect: number): Box {
  const scale = Math.min(cols / art.w, (rows * aspect) / art.h);
  return {
    col: cx - (art.w * scale) / 2,
    row: cy - (art.h * scale) / aspect / 2,
    scale,
    aspect,
  };
}

/** A closed polygon approximating a circle, for wheels and boulders. */
export function circle(cx: number, cy: number, r: number, segs = 48, from = 0, to = Math.PI * 2): number[] {
  const out: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = from + ((to - from) * i) / segs;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

export class Painter {
  private tone: Float32Array;
  private cover: Float32Array;
  private scratch: Float32Array;
  /** Rows touched by the shape being drawn, so clearing stays cheap. */
  private lo = 0;
  private hi = -1;
  private xs: number[] = [];

  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.tone = new Float32Array(cols * rows);
    this.cover = new Float32Array(cols * rows);
    this.scratch = new Float32Array(cols * rows);
  }

  clear(): void {
    this.tone.fill(0);
    this.cover.fill(0);
  }

  draw(art: Art, box: Box): void {
    for (const s of art.shapes) {
      if (s.stroke) this.strokePath(s.d, s.stroke, s.tone, box, s.open === true);
      else this.fillPath(s.d, s.tone, box);
    }
  }

  /**
   * Even-odd scanline fill.
   *
   * Crossings are gathered per subsample row and sorted, so a path may contain
   * several loops and the holes come out for free — an annulus is just the
   * outer ring followed by the inner one, which is how the wheels are drawn.
   */
  fillPath(d: readonly number[], tone: number, box: Box): void {
    const n = d.length / 2;
    if (n < 3) return;
    const { cols, rows } = this;
    const sxOf = (i: number) => (box.col + d[i * 2] * box.scale) * SUB;
    const syOf = (i: number) => (box.row + (d[i * 2 + 1] * box.scale) / box.aspect) * SUB;

    let top = Infinity;
    let bot = -Infinity;
    for (let i = 0; i < n; i++) {
      const y = syOf(i);
      if (y < top) top = y;
      if (y > bot) bot = y;
    }
    const y0 = Math.max(0, Math.ceil(top - 0.5));
    const y1 = Math.min(rows * SUB - 1, Math.floor(bot + 0.5));
    if (y1 < y0) return;

    this.beginShape(Math.floor(y0 / SUB), Math.floor(y1 / SUB));

    for (let sy = y0; sy <= y1; sy++) {
      const py = sy + 0.5;
      const xs = this.xs;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ay = syOf(i);
        const by = syOf(j);
        if (ay === by) continue;
        if (py < Math.min(ay, by) || py >= Math.max(ay, by)) continue;
        const t = (py - ay) / (by - ay);
        xs.push(sxOf(i) + (sxOf(j) - sxOf(i)) * t);
      }
      if (xs.length < 2) continue;
      xs.sort((a, b) => a - b);
      const row = Math.floor(sy / SUB);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.ceil(xs[k] - 0.5));
        const b = Math.min(cols * SUB - 1, Math.floor(xs[k + 1] - 0.5));
        for (let sx = a; sx <= b; sx++) {
          this.scratch[row * cols + ((sx / SUB) | 0)] += WEIGHT;
        }
      }
    }
    this.commit(tone);
  }

  /** Strokes a polyline by filling one quad per segment. */
  strokePath(d: readonly number[], cells: number, tone: number, box: Box, open: boolean): void {
    const n = d.length / 2;
    const last = open ? n - 1 : n;
    // Back into artwork units, so the line holds its weight at any zoom.
    const h = cells / box.scale / 2;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      const ax = d[i * 2];
      const ay = d[i * 2 + 1];
      const bx = d[j * 2];
      const by = d[j * 2 + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      // Extended half a width past each end so joins do not leave notches.
      const ex = (dx / len) * h;
      const ey = (dy / len) * h;
      const nx = (-dy / len) * h;
      const ny = (dx / len) * h;
      this.fillPath(
        [
          ax - ex + nx, ay - ey + ny,
          bx + ex + nx, by + ey + ny,
          bx + ex - nx, by + ey - ny,
          ax - ex - nx, ay - ey - ny,
        ],
        tone,
        box,
      );
    }
  }

  private beginShape(lo: number, hi: number): void {
    this.lo = Math.max(0, lo);
    this.hi = Math.min(this.rows - 1, hi);
  }

  /** Composites the scratch coverage over what is already there, then clears it. */
  private commit(tone: number): void {
    const { cols } = this;
    for (let r = this.lo; r <= this.hi; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const v = this.scratch[i];
        if (v <= 0) continue;
        const a = Math.min(1, v);
        this.tone[i] = this.tone[i] * (1 - a) + tone * a;
        this.cover[i] = this.cover[i] + a * (1 - this.cover[i]);
        this.scratch[i] = 0;
      }
    }
  }

  /** Writes the finished drawing into the overlay through the density ramp. */
  paint(
    out: Overlay,
    ramp: number[],
    alpha: number,
    prio: Uint8Array,
    level: number,
    gamma = 0.82,
  ): void {
    const cells = this.cols * this.rows;
    for (let i = 0; i < cells; i++) {
      const cov = this.cover[i];
      if (cov < 0.06) continue;
      const v = this.tone[i] * cov;
      if (v < 0.02) continue;
      if (prio[i] > level) continue;
      const g = Math.min(ramp.length - 1, Math.floor(Math.pow(Math.min(1, v), gamma) * ramp.length));
      out.char[i] = ramp[g];
      out.sheet[i] =
        v > 0.82 ? Sheet.Display : v > 0.54 ? Sheet.Ink : v > 0.28 ? Sheet.Dim : Sheet.Muted;
      out.alpha[i] = Math.min(1, alpha * (0.42 + 0.58 * cov));
      prio[i] = level;
    }
  }
}
