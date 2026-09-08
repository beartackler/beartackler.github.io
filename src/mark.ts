/**
 * Four overlapping rings — the ikigai diagram — drawn through the page's own
 * empty cells rather than placed on top of it.
 *
 * The rings are big enough to enclose the whole composition, so the resume
 * ends up sitting inside the mark, and every arc breaks cleanly where a block
 * of type stands in the way. That negative-space relationship is the point:
 * the shape was always there, and uncovering the page is what shows it.
 */

import type { Plane } from './layout';

/** Columns/rows of clearance kept around every character. */
const CLEAR_COLS = 2;
const CLEAR_ROWS = 1;
/** Ring line thickness, in column-widths. */
const THICK = 0.9;
/** Centre offset as a fraction of the radius; sets how much the rings overlap. */
const SPREAD = 0.58;

export type Mark = {
  /** Bitmask of which rings pass through each cell; 0 means "not the mark". */
  bits: Uint8Array;
  /** Normalised time in 0..1 at which a cell appears while the mark draws. */
  appearAt: Float32Array;
  /** Cells per ring, for painting progress. */
  totals: number[];
  cells: number;
};

export function buildMark(plane: Plane, aspect: number): Mark {
  const { cols, rows, chars } = plane;
  const bits = new Uint8Array(cols * rows);
  const appearAt = new Float32Array(cols * rows).fill(2);
  const totals = [0, 0, 0, 0];

  // The composition is already centred inside the padded plane, so the plane
  // centre is the composition centre and is guaranteed symmetric.
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

  // Total extent is 2 * (R + SPREAD * R); fill the page without clipping.
  const extent = 2 * (1 + SPREAD);
  const radius = Math.min((cols * 0.5) / extent, ((rows - 5) * aspect) / extent);
  if (radius < 4) return { bits, appearAt, totals, cells: 0 };

  const d = radius * SPREAD;
  const centres: [number, number][] = [
    [-d, -d],
    [d, -d],
    [d, d],
    [-d, d],
  ];

  // Any empty cell too close to a character is off limits, so arcs never fill
  // the single-space gaps between words.
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (chars[r * cols + c] === 0) continue;
      for (let dr = -CLEAR_ROWS; dr <= CLEAR_ROWS; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= rows) continue;
        for (let dc = -CLEAR_COLS; dc <= CLEAR_COLS; dc++) {
          const cc = c + dc;
          if (cc < 0 || cc >= cols) continue;
          blocked[rr * cols + cc] = 1;
        }
      }
    }
  }

  let cells = 0;
  const TAU = Math.PI * 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (blocked[i]) continue;
      const x = c - cx;
      const y = (r - cy) * aspect;
      let mask = 0;
      for (let k = 0; k < 4; k++) {
        const dx = x - centres[k][0];
        const dy = y - centres[k][1];
        if (Math.abs(Math.hypot(dx, dy) - radius) >= THICK) continue;
        mask |= 1 << k;
        totals[k]++;
        // Each ring traces from its top, staggered so they arrive in turn.
        const t = ((Math.atan2(dy, dx) + Math.PI / 2) / TAU + 1) % 1;
        const at = k * 0.2 + t * 0.28;
        if (at < appearAt[i]) appearAt[i] = at;
      }
      if (mask) {
        bits[i] = mask;
        cells++;
      }
    }
  }

  return { bits, appearAt, totals, cells };
}

export function popcount4(mask: number): number {
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1);
}
