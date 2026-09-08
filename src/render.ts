/**
 * Draw loop. Every visible cell is one `drawImage` from a pre-coloured sheet;
 * cells are bucketed by (sheet, quantised alpha) so a frame costs a few dozen
 * context state changes instead of several thousand.
 */

import { Atlas, Sheet } from './atlas';
import { Field } from './field';
import type { LinkRegion, Plane } from './layout';

const ALPHA_STEPS = 12;
const FLOOR = 0.04; // below this a cell is simply dark
const HAZE_TEXT = 0.78; // haze is stronger over text than over empty field
const HAZE_EMPTY = 0.52;

/** Sheets are drawn in this order so resolved type sits above the haze. */
const DRAW_ORDER = [Sheet.Glow, Sheet.Display, Sheet.Ink, Sheet.Dim, Sheet.Muted, Sheet.GlowHot];

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
    const hotRow = this.hot ? this.hot.row : -1;
    const hotCol = this.hot ? this.hot.col : 0;
    const hotEnd = this.hot ? this.hot.col + this.hot.len : 0;

    for (let r = firstRow; r <= lastRow; r++) {
      for (let c = 0; c < plane.cols; c++) {
        const i = r * plane.cols + c;
        const l = Math.max(field.light[i], field.ink[i]);
        if (l < FLOOR) continue;

        const code = plane.chars[i];
        const isText = code !== 0;
        const run = isText ? plane.runId[i] : -1;
        // Words resolve as words, on their brightest cell.
        const resolve = run >= 0 ? smoothstep(0.28, 0.55, field.runLight[run]) : 0;

        // Halftone haze — the ASCII-art layer.
        const hazeA = l * (1 - resolve) * (isText ? HAZE_TEXT : HAZE_EMPTY);
        if (hazeA >= 0.03) {
          const jitter = 0.75 + field.seed[i] * 0.5;
          const idx = Math.min(ramp.length - 1, Math.floor(l * jitter * ramp.length));
          this.push(Sheet.Glow, hazeA, i, ramp[Math.max(0, idx)]);
        }

        if (!isText || resolve <= 0.02) continue;

        // Resolved type, or the brief scramble on the way in.
        if (field.runLock[run] > 0) {
          // Offset by the cell's own seed, or neighbours march through the
          // alphabet in lockstep instead of looking like noise.
          const pick =
            (((this.frame / 3) | 0) + ((field.seed[i] * scramble.length) | 0)) % scramble.length;
          this.push(Sheet.GlowHot, resolve, i, scramble[pick]);
        } else if (hotRow === r && c >= hotCol && c < hotEnd) {
          this.push(Sheet.GlowHot, 1, i, code);
        } else {
          // Live words burn brighter than ones already developed.
          const settled = 0.72 + 0.28 * Math.min(1, field.runLive[run] / 0.6);
          this.push(plane.tone[i], resolve * settled, i, code);
        }
      }
    }

    this.flush(originX, originY);
  }

  private push(sheet: number, alpha: number, cell: number, code: number): void {
    const order = DRAW_ORDER.indexOf(sheet as (typeof DRAW_ORDER)[number]);
    const step = Math.min(ALPHA_STEPS - 1, Math.floor(alpha * ALPHA_STEPS));
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
        ctx.globalAlpha = (step + 0.5) / ALPHA_STEPS;
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
