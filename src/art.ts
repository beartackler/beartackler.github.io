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

/**
 * Coverage below which a cell counts as empty when looking for a silhouette.
 *
 * Deliberately near zero. Any ink at all blocks the flood, which seals the
 * sub-cell gaps between the grille's traced slats — at a stricter threshold
 * the outside leaks in between them and the car's nose comes out as a dotted
 * line instead of a bumper.
 */
const AIR = 0.03;

/**
 * The ramp the drawings resolve through: eight marks, light to heavy.
 *
 * Hand-picked rather than the atlas's measured one. The measured ramp is
 * ordered purely by how much ink a glyph puts in a cell, which is right for
 * haze — variety is the point there — but its middle is `\\ / < > ~ { }`, and a
 * line drawn in those does not read as a fainter line, it reads as scratches
 * and chain links. These eight read as one mark at eight weights, which is
 * what a pencil does.
 */
export const ART_RAMP = ['.', ':', '-', '=', '+', '*', '#', '@'].map((c) => c.charCodeAt(0));

/** Samples per cell, per axis. Nine samples is enough to hide the grid. */
const SUB = 3;
const WEIGHT = 1 / (SUB * SUB);

export type Shape = {
  /** Flat [x0,y0,x1,y1,…] in the artwork's own pixel space. */
  d: readonly number[];
  /** 0..1 brightness of the region itself, before coverage. */
  tone: number;
  /**
   * Line width in *cells*, not artwork pixels. Omit to fill instead.
   *
   * Also sets the width of an `edge`, where it is the thickness of the
   * boundary band kept.
   *
   * Cells, because a line narrower than a cell does not render as a line: its
   * coverage is a fraction, and the compositor dilutes it into whatever it is
   * drawn over. It comes out as a smudge the colour of the fill, which is how
   * an entire car came to be drawn with no visible wheels.
   */
  stroke?: number;
  /** Stroke an open path rather than closing it back to the start. */
  open?: boolean;
  /**
   * Fill the path, then keep only the boundary of what got filled.
   *
   * For a traced contour this is the only honest way to draw an outline.
   * Marching squares walks one continuous loop through every detached
   * component of a drawing, so the path doubles back on itself constantly —
   * under an even-odd fill those excursions cancel, but stroked they all draw,
   * and the R8's silhouette came out as a hedge. Filling first and taking the
   * edge afterwards asks the question the drawing actually answers: which
   * cells are on the boundary of the car.
   *
   * `'outer'` goes further and keeps only the boundary against the outside
   * world, found by flooding in from the edges of the grid. The traced shell
   * needs it: the front grille's ten slats are chained into the same contour,
   * so they fill correctly but their edges are ten rows of sub-cell noise
   * exactly where the car's nose should be.
   */
  edge?: boolean | 'outer';
  /**
   * Treat `d` as a list of points and light exactly the cell each falls in.
   *
   * Atmosphere: scree on a hill, chalk in the air, a crowd in the dark. The
   * slide that works best on this page is the one with a plum branch shedding
   * petals across the whole frame, and most of what it has that the others
   * lacked is something in the empty parts of the picture.
   */
  specks?: boolean;
  /**
   * Which family of sheets the shape is coloured from. Bone by default.
   *
   * `plum` is act two's colour, reused for the few things on later slides that
   * are alight rather than drawn — a lamp, a sprout, a sun.
   */
  hue?: 'bone' | 'plum' | 'leaf';
};

export type Art = {
  w: number;
  h: number;
  shapes: Shape[];
  /**
   * Shapes regenerated every frame, drawn over the static ones.
   *
   * A slide is meant to *rest* — that is the whole point of the hold — but
   * resting is not the same as being frozen, and the two slides whose subject
   * is living things looked dead precisely because nothing on them moved. The
   * budget is small on purpose: a sprout that leans a couple of degrees and
   * some drifting dust, not an animation. Everything load-bearing stays in
   * `shapes`, so the picture is identical on a still capture.
   */
  live?: (t: number) => Shape[];
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
  /** Mirror horizontally. The car is drawn nose-right so its flames trail
      away from the column the closing line sits in. */
  flip?: boolean;
};

/** Fits an artwork inside a cell box, preserving its aspect ratio. */
export function fit(
  art: Art,
  cols: number,
  rows: number,
  cx: number,
  cy: number,
  aspect: number,
  flip = false,
): Box {
  const scale = Math.min(cols / art.w, (rows * aspect) / art.h);
  return {
    col: cx - (art.w * scale) / 2,
    row: cy - (art.h * scale) / aspect / 2,
    scale,
    aspect,
    flip,
  };
}

/** Where an artwork-space point lands on the plane, for hanging things off it. */
export function at(art: Art, box: Box, x: number, y: number): { c: number; r: number } {
  return {
    c: box.flip ? box.col + (art.w - x) * box.scale : box.col + x * box.scale,
    r: box.row + (y * box.scale) / box.aspect,
  };
}

/**
 * Turns a traced reference (tools/pose.mjs) into shapes.
 *
 * Bands are painted lightest first, each one over the last, so the darkest is
 * on top — which is the order they were cut in.
 *
 * Tones are given explicitly rather than derived from the source's own levels,
 * and they always need to be spread much wider than the arithmetic suggests. A
 * pen sketch is mostly mid-grey hatching with the drawing itself in a thin
 * darkest band; mapped proportionally, all of it lands in the top third of the
 * ramp and the whole figure arrives as one lump.
 */
export function poster(
  p: { w: number; h: number; bands: { tone: number; d: number[] }[] },
  tones: number[],
): Shape[] {
  return p.bands.map((b, i) => ({ tone: tones[Math.min(tones.length - 1, i)], d: b.d }));
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
  /**
   * Per cell: how much of what is there is line work rather than fill.
   *
   * Tone and coverage answer different questions for the two. A half-lit *fill*
   * should thin out to a sparser glyph, because that is what "less of it" looks
   * like in a density ramp. A half-lit *line* should not: it is still a whole
   * line, just a dimmer one, and thinning its glyph is what made the R8's
   * beltline read as a row of braces instead of a crease down the door.
   */
  private drawn: Float32Array;
  private scratch: Float32Array;
  /** Second buffer for `edge`, so the erosion reads an unmodified source. */
  private rim: Float32Array;
  /** Reachable-from-outside mask and its worklist, for `edge: 'outer'`. */
  private flood: Uint8Array;
  private queue: Int32Array;
  /** What the shape covered before it was eroded, so an edge can be thickened. */
  private solid: Uint8Array;
  /** Rows touched by the shape being drawn, so clearing stays cheap. */
  private lo = 0;
  private hi = -1;
  private xs: number[] = [];
  /** Set by `draw`, so a mirrored box knows what to mirror about. */
  private artW = 0;
  /** Which colour family the shape being drawn belongs to: bone, plum, leaf. */
  private hot = 0;
  /** Per cell: which family of sheets it was drawn from. */
  private tint: Uint8Array;

  readonly cols: number;
  readonly rows: number;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.tone = new Float32Array(cols * rows);
    this.cover = new Float32Array(cols * rows);
    this.drawn = new Float32Array(cols * rows);
    this.scratch = new Float32Array(cols * rows);
    this.rim = new Float32Array(cols * rows);
    this.flood = new Uint8Array(cols * rows);
    this.queue = new Int32Array(cols * rows);
    this.solid = new Uint8Array(cols * rows);
    this.tint = new Uint8Array(cols * rows);
  }

  clear(): void {
    this.tone.fill(0);
    this.cover.fill(0);
    this.drawn.fill(0);
    this.tint.fill(0);
  }

  draw(art: Art, box: Box, t = 0): void {
    this.artW = art.w;
    for (const s of art.live ? [...art.shapes, ...art.live(t)] : art.shapes) {
      this.hot = s.hue === 'plum' ? 1 : s.hue === 'leaf' ? 2 : 0;
      if (s.specks) this.dots(s.d, s.tone, box);
      else if (s.edge) this.fillPath(s.d, s.tone, box, s.edge, s.stroke ?? 1);
      else if (s.stroke) this.strokePath(s.d, s.stroke, s.tone, box, s.open === true);
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
  fillPath(
    d: readonly number[],
    tone: number,
    box: Box,
    edge: boolean | 'outer' = false,
    width = 1,
  ): void {
    this.lo = 0;
    this.hi = -1;
    if (!this.raster(d, box)) return;
    if (edge === 'outer') this.keepSilhouette();
    else if (edge) this.keepEdge();
    if (edge && width > 1) this.thicken(width);
    this.commit(tone, edge !== false);
  }

  /**
   * Grows a one-cell boundary inward to `width` cells.
   *
   * Weight is most of what separates these drawings from the mark they follow.
   * The mark is a band three cells across and it reads as drawn; a boundary is
   * one cell across and reads as plotted. Grown inward rather than outward so
   * a thicker line never makes the thing it outlines any bigger.
   */
  private thicken(width: number): void {
    const { cols, scratch, rim, lo, hi } = this;
    for (let n = 1; n < Math.round(width); n++) {
      for (let r = lo; r <= hi; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const v = scratch[i];
          if (v > 0 || this.solid[i] === 0) {
            rim[i] = v;
            continue;
          }
          const up = r > lo ? scratch[i - cols] : 0;
          const down = r < hi ? scratch[i + cols] : 0;
          const left = c > 0 ? scratch[i - 1] : 0;
          const right = c + 1 < cols ? scratch[i + 1] : 0;
          rim[i] = Math.max(up, down, left, right) > 0 ? 1 : 0;
        }
      }
      for (let r = lo; r <= hi; r++) {
        const base = r * cols;
        for (let c = 0; c < cols; c++) scratch[base + c] = rim[base + c];
      }
    }
  }

  /**
   * Accumulates one even-odd scanline fill into the scratch buffer.
   *
   * Returns false if the path missed the plane entirely. Nothing is composited
   * here, so a caller can lay several paths down before deciding what the
   * result means — which is how a stroked polyline becomes one line rather
   * than a chain of separately blended quads.
   */
  private raster(d: readonly number[], box: Box): boolean {
    const n = d.length / 2;
    if (n < 3) return false;
    const { cols, rows } = this;
    const sxOf = (i: number) =>
      (box.flip
        ? box.col + (this.artW - d[i * 2]) * box.scale
        : box.col + d[i * 2] * box.scale) * SUB;
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
    if (y1 < y0) return false;

    this.growShape(Math.floor(y0 / SUB), Math.floor(y1 / SUB));

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
    return true;
  }

  /**
   * Strokes a polyline: one quad per segment, all of them laid down together
   * and then sharpened into a line.
   *
   * The sharpening is the point. A one-cell-wide line almost never lands
   * squarely inside a cell, so its coverage comes out around a half, and half
   * coverage times full tone lands on a dim glyph on a dim sheet. Rendered
   * that way the R8's wheels were present in the buffer and invisible on the
   * page.
   *
   * It is a floor, though, not a flattening. Promoted all the way to one, every
   * line on the page comes out at exactly one weight and the drawings read as
   * CAD output — which is precisely what the ikigai mark beside them does not
   * do, because its ring band feathers and lands on three different sheets
   * along its length. Keeping a third of the coverage variation buys that
   * mottle back without letting any cell of a line fall below legible.
   */
  /**
   * Lights exactly one cell per point.
   *
   * Deliberately unsmoothed: a speck is one character, and rounding it to the
   * nearest cell is the whole primitive. Antialiasing a dust mote across four
   * cells at a quarter coverage each produces nothing you can see.
   */
  private dots(d: readonly number[], tone: number, box: Box): void {
    const { cols, rows, scratch } = this;
    this.lo = 0;
    this.hi = -1;
    for (let i = 0; i + 1 < d.length; i += 2) {
      const x = box.flip ? box.col + (this.artW - d[i]) * box.scale : box.col + d[i] * box.scale;
      const c = Math.round(x);
      const r = Math.round(box.row + (d[i + 1] * box.scale) / box.aspect);
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      scratch[r * cols + c] = 1;
      this.growShape(r, r);
    }
    if (this.hi >= this.lo) this.commit(tone, true);
  }

  strokePath(d: readonly number[], cells: number, tone: number, box: Box, open: boolean): void {
    const n = d.length / 2;
    const last = open ? n - 1 : n;
    this.lo = 0;
    this.hi = -1;
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
      this.raster(
        [
          ax - ex + nx, ay - ey + ny,
          bx + ex + nx, by + ey + ny,
          bx + ex - nx, by + ey - ny,
          ax - ex - nx, ay - ey - ny,
        ],
        box,
      );
    }
    const { cols, scratch } = this;
    for (let r = this.lo; r <= this.hi; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const v = scratch[i];
        if (v <= 0) continue;
        scratch[i] = v < 0.18 ? 0 : Math.min(1, 0.66 + v * 0.72);
      }
    }
    this.commit(tone, true);
  }

  /**
   * Erodes the scratch coverage down to its own boundary.
   *
   * A cell survives if it is covered but is not surrounded on all four sides
   * by covered cells — the same union-outline idea as the favicon, one
   * dimension up. Partly covered cells are the antialiased edge by definition,
   * so they are kept at their own coverage and give the line its weight back.
   */
  private keepEdge(): void {
    const { cols, scratch, rim, solid, lo, hi } = this;
    for (let r = lo; r <= hi; r++) {
      const base = r * cols;
      for (let c = 0; c < cols; c++) solid[base + c] = scratch[base + c] > AIR ? 1 : 0;
    }
    const solidAt = (r: number, c: number): boolean =>
      r >= lo && r <= hi && c >= 0 && c < cols && scratch[r * cols + c] >= 0.55;
    for (let r = lo; r <= hi; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const v = scratch[i];
        if (v <= 0.08) {
          rim[i] = 0;
          continue;
        }
        const buried =
          v >= 0.55 &&
          solidAt(r - 1, c) &&
          solidAt(r + 1, c) &&
          solidAt(r, c - 1) &&
          solidAt(r, c + 1);
        rim[i] = buried ? 0 : v >= 0.55 ? 1 : v;
      }
    }
    for (let r = lo; r <= hi; r++) {
      const base = r * cols;
      for (let c = 0; c < cols; c++) scratch[base + c] = rim[base + c];
    }
  }

  /**
   * Erodes the scratch coverage down to the boundary it shares with the
   * outside — everything enclosed, however intricate, is discarded.
   *
   * The outside is found by flooding in from the border of the touched window
   * rather than by testing enclosure, because the traced contour crosses
   * itself and an even-odd "inside" is not the same as "not reachable from
   * outside". Flooding asks the question the eye asks.
   */
  private keepSilhouette(): void {
    const { cols, scratch, rim, solid, lo, hi } = this;
    for (let r = lo; r <= hi; r++) {
      const base = r * cols;
      for (let c = 0; c < cols; c++) solid[base + c] = scratch[base + c] > AIR ? 1 : 0;
    }
    const w = cols;
    const h = hi - lo + 1;
    if (h <= 0) return;
    const open = this.flood;
    const need = w * h;
    if (open.length < need) this.flood = new Uint8Array(need);
    const seen = this.flood;
    seen.fill(0, 0, need);
    const stack = this.queue;
    let top = 0;
    const push = (x: number, y: number): void => {
      const k = y * w + x;
      if (seen[k]) return;
      if (scratch[(y + lo) * w + x] > AIR) return;
      seen[k] = 1;
      stack[top++] = k;
    };
    for (let x = 0; x < w; x++) {
      push(x, 0);
      push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      push(0, y);
      push(w - 1, y);
    }
    while (top > 0) {
      const k = stack[--top];
      const x = k % w;
      const y = (k / w) | 0;
      if (x > 0) push(x - 1, y);
      if (x + 1 < w) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y + 1 < h) push(x, y + 1);
    }
    const touchesAir = (x: number, y: number): boolean =>
      x < 0 || x >= w || y < 0 || y >= h || seen[y * w + x] === 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y + lo) * w + x;
        const v = scratch[i];
        // Surviving cells are written at full coverage rather than at their
        // own. The grid has already quantised the line; letting a shallow
        // diagonal keep its fractional coverage only makes the silhouette
        // flicker between two brightnesses along its length.
        if (v <= AIR) {
          rim[i] = 0;
          continue;
        }
        rim[i] =
          touchesAir(x - 1, y) || touchesAir(x + 1, y) || touchesAir(x, y - 1) || touchesAir(x, y + 1)
            ? 1
            : 0;
      }
    }
    for (let r = lo; r <= hi; r++) {
      const base = r * cols;
      for (let c = 0; c < cols; c++) scratch[base + c] = rim[base + c];
    }
  }

  /** Widens the touched-row window to include another path. */
  private growShape(lo: number, hi: number): void {
    const a = Math.max(0, lo);
    const b = Math.min(this.rows - 1, hi);
    if (this.hi < this.lo) {
      this.lo = a;
      this.hi = b;
      return;
    }
    if (a < this.lo) this.lo = a;
    if (b > this.hi) this.hi = b;
  }

  /** Composites the scratch coverage over what is already there, then clears it. */
  private commit(tone: number, line = false): void {
    const { cols } = this;
    for (let r = this.lo; r <= this.hi; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const v = this.scratch[i];
        if (v <= 0) continue;
        const a = Math.min(1, v);
        this.tone[i] = this.tone[i] * (1 - a) + tone * a;
        this.cover[i] = this.cover[i] + a * (1 - this.cover[i]);
        this.drawn[i] = this.drawn[i] * (1 - a) + (line ? a : 0);
        if (a > 0.5) this.tint[i] = this.hot;
        this.scratch[i] = 0;
      }
    }
  }

  /** Writes the finished drawing into the overlay through the density ramp. */
  paint(out: Overlay, alpha: number, prio: Uint8Array, level: number, gamma = 0.82): void {
    const ramp = ART_RAMP;
    const cells = this.cols * this.rows;
    for (let i = 0; i < cells; i++) {
      const cov = this.cover[i];
      if (cov < 0.06) continue;
      const v = this.tone[i] * cov;
      if (v < 0.02) continue;
      if (prio[i] > level) continue;
      // A line cell is resolved from its tone alone; a fill cell from tone
      // times coverage. Coverage decides only *whether* a line lights a cell,
      // never how strongly — that was the fix that made the R8's wheels
      // visible. But resolving a line from coverage instead, which is where
      // that fix first landed, costs the drawings all their depth: every line
      // comes out as a dense glyph and a dim one differs only in colour, so a
      // far rope reads as near. From tone, a dim line is a sparse character —
      // which is exactly how the plum branch's far twigs recede.
      const ink = v + (this.tone[i] - v) * this.drawn[i];
      const g = Math.min(ramp.length - 1, Math.floor(Math.pow(Math.min(1, ink), gamma) * ramp.length));
      out.char[i] = ramp[g];
      // The plum family stops at Bloom rather than running up to Display. The
      // flame uses Display as its core because the hottest part of a flame is
      // near white, but a sprout or a sun that resolves to Display is simply
      // bone, and the whole point of tinting it was that it is not.
      out.sheet[i] =
        this.tint[i] === 1
          ? ink > 0.44
            ? Sheet.Bloom
            : Sheet.BloomDeep
          : this.tint[i] === 2
            ? ink > 0.44
              ? Sheet.Leaf
              : Sheet.LeafDeep
            : ink > 0.82
              ? Sheet.Display
              : ink > 0.54
                ? Sheet.Ink
                : ink > 0.28
                  ? Sheet.Dim
                  : Sheet.Muted;
      out.alpha[i] = Math.min(1, alpha * (0.42 + 0.58 * cov));
      prio[i] = level;
    }
  }
}
