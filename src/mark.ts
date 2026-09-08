/**
 * Four overlapping rings — the ikigai diagram — drawn through the character
 * grid itself rather than placed on top of it.
 *
 * The rings are evaluated live every frame so that scrolling can move and grow
 * them: they arrive small beside the wordmark and end up large and low on the
 * screen. Everything is a pure function of the position and radius handed in,
 * which is what lets the whole journey run backwards when the visitor scrolls
 * back up.
 */

/** Centre offset as a fraction of the radius; sets how much the rings overlap. */
export const SPREAD = 0.58;
/** Columns/rows of clearance kept around every character at rest. */
const CLEAR_COLS = 2;
const CLEAR_ROWS = 1;
const TAU = Math.PI * 2;

/**
 * How much room the rings give the type.
 *
 * `Wide` is the resting look: a generous halo around every character, so the
 * mark beside the wordmark stays legible as a mark. `Tight` blocks only the
 * occupied cells, which leaves hairline gaps where a ring crosses a word —
 * weaving, rather than whole chunks of the mark missing. `None` is for once
 * the resume has faded and there is no type left to respect.
 */
export const Clearance = { None: 0, Tight: 1, Wide: 2 } as const;
export type ClearanceValue = (typeof Clearance)[keyof typeof Clearance];

/** Total width of the mark, in columns, for a given ring radius. */
export function markExtent(radius: number): number {
  return 2 * radius * (1 + SPREAD);
}

export type MarkPass = {
  out: Float32Array;
  mask: Uint8Array;
  cx: number;
  cy: number;
  radius: number;
  thick: number;
  /** 0..1 self-draw progress; each ring traces from its top in turn. */
  phase: number;
  /** How much room to leave around the type; see `Clearance`. */
  clearance: ClearanceValue;
  /**
   * 0 draws a hard-edged ring, 1 feathers it to nothing at the band edge.
   * Feathering is for when the mark is moving: it lets a cell fade in as an
   * arc sweeps over it instead of appearing at full strength.
   */
  soft: number;
  /** Cells the lantern has swept, brightened permanently. Null to ignore. */
  painted: Uint8Array | null;
  base: number;
  paintedBase: number;
};

export class MarkField {
  /** Cells too close to a character for a ring to pass through. */
  private readonly blockedWide: Uint8Array;
  /** Occupied cells only. */
  private readonly blockedTight: Uint8Array;

  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly aspect: number,
    chars: Uint16Array,
  ) {
    this.blockedWide = new Uint8Array(cols * rows);
    this.blockedTight = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (chars[r * cols + c] === 0) continue;
        this.blockedTight[r * cols + c] = 1;
        for (let dr = -CLEAR_ROWS; dr <= CLEAR_ROWS; dr++) {
          const rr = r + dr;
          if (rr < 0 || rr >= rows) continue;
          for (let dc = -CLEAR_COLS; dc <= CLEAR_COLS; dc++) {
            const cc = c + dc;
            if (cc < 0 || cc >= cols) continue;
            this.blockedWide[rr * cols + cc] = 1;
          }
        }
      }
    }
  }

  /**
   * Writes ring intensity and a per-cell ring bitmask. Only the mark's own
   * bounding box is touched, so growing it costs no more than it has to.
   */
  evaluate(p: MarkPass): void {
    const { cols, rows, aspect } = this;
    const { out, mask, cx, cy, radius, thick, phase, clearance, painted, soft } = p;
    const blocked =
      clearance === Clearance.Wide
        ? this.blockedWide
        : clearance === Clearance.Tight
          ? this.blockedTight
          : null;
    const d = radius * SPREAD;
    const centres: [number, number][] = [
      [-d, -d],
      [d, -d],
      [d, d],
      [-d, d],
    ];

    const reach = radius + d + thick + 1;
    const c0 = Math.max(0, Math.floor(cx - reach));
    const c1 = Math.min(cols - 1, Math.ceil(cx + reach));
    const r0 = Math.max(0, Math.floor(cy - reach / aspect));
    const r1 = Math.min(rows - 1, Math.ceil(cy + reach / aspect));

    const inner = (radius - thick) * (radius - thick);
    const outer = (radius + thick) * (radius + thick);

    for (let r = r0; r <= r1; r++) {
      const y = (r - cy) * aspect;
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (blocked !== null && blocked[i]) continue;
        const x = c - cx;

        let bits = 0;
        let overlap = 0;
        let earliest = 2;
        /** Strongest distance-to-centreline across the rings covering this cell. */
        let feather = 0;
        for (let k = 0; k < 4; k++) {
          const dx = x - centres[k][0];
          const dy = y - centres[k][1];
          const d2 = dx * dx + dy * dy;
          if (d2 <= inner || d2 >= outer) continue;
          bits |= 1 << k;
          overlap++;
          if (soft > 0.01) {
            const off = Math.abs(Math.sqrt(d2) - radius) / thick;
            if (1 - off > feather) feather = 1 - off;
          }
          if (phase < 1) {
            // Each ring traces from its top, staggered so they arrive in turn.
            const t = ((Math.atan2(dy, dx) + Math.PI / 2) / TAU + 1) % 1;
            const at = k * 0.2 + t * 0.28;
            if (at < earliest) earliest = at;
          }
        }
        if (overlap === 0 || (phase < 1 && earliest > phase)) continue;

        mask[i] = bits;
        const lit = painted && painted[i] ? p.paintedBase : p.base;
        let v = lit * (1 + 0.3 * (overlap - 1));
        if (overlap >= 3) v = Math.max(v, 0.78);
        if (soft > 0.01) v *= 1 - soft * 0.5 * (1 - feather);
        out[i] = Math.min(0.95, v);
      }
    }
  }
}
