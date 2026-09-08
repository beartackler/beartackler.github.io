/**
 * Renders the LinkedIn banner from the page's own parts.
 *
 * Not a lookalike: the same glyph atlas, the same block face, the same mark
 * geometry and the same palette tokens the site uses, composed for a 4:1
 * strip. Run `npm run dev`, screenshot `#b`, and the result cannot drift from
 * the site's style because it is made of it.
 *
 * LinkedIn puts the profile photo over the bottom-left corner, so everything
 * here lives right of it.
 */

import './style.css';
import { Atlas, Sheet, type Palette } from './atlas';
import { blockRows } from './blockfont';
import { Clearance, markExtent, MarkField, SPREAD } from './mark';
import { PERSON } from './resume';

const W = 1584;
const H = 396;
const DPR = 2;
const CELL_W = 10;
const CELL_H = 14;
const COLS = Math.floor(W / CELL_W);
const ROWS = Math.floor(H / CELL_H);

/** The mark's own ramp, as in render.ts: one stroke weight everywhere. */
const MARK_RAMP = ['.', ':', '+', '*', '@', '#'].map((c) => c.charCodeAt(0));
/** The same legend as the rule under the name on the page. */
const RULE = '.·:-=+*#%@';

const css = getComputedStyle(document.documentElement);
const token = (n: string) => css.getPropertyValue(n).trim();

type Cell = { code: number; sheet: number; alpha: number };
const grid = new Map<number, Cell>();
const put = (c: number, r: number, code: number, sheet: number, alpha = 1) => {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS || code === 32) return;
  grid.set(r * COLS + c, { code, sheet, alpha });
};
const text = (c: number, r: number, s: string, sheet: number, alpha = 1) => {
  [...s].forEach((ch, i) => put(c + i, r, ch.charCodeAt(0), sheet, alpha));
};

function rule(w: number): string {
  let out = '';
  for (let i = 0; i < w; i++) {
    const t = 1 - Math.abs((2 * i) / (w - 1) - 1);
    out += RULE[Math.round(t * (RULE.length - 1))];
  }
  return out;
}

// ── Composition ──────────────────────────────────────────────────────────
// The block wordmark sets the width of everything; the mark is sized to the
// text block's height so the two read as one object.
const NAME = PERSON.name;
const nameArt = blockRows(NAME);
// Measure the rendered rows, not `blockWidth`: the latter counts tracking the
// last letter does not actually use, which pushed the V off the right edge.
const nameW = Math.max(...nameArt.map((l) => l.trimEnd().length));
const textCol = COLS - 7 - nameW;
const midRow = Math.round(ROWS / 2);

const nameRow = midRow - 5;
nameArt.forEach((line, i) => text(textCol, nameRow + i, line, Sheet.Display));
text(textCol, midRow + 2, PERSON.tagline, Sheet.Dim);
text(textCol, midRow + 4, rule(nameW), Sheet.Muted);
text(
  textCol,
  midRow + 7,
  `beartackler.github.io · ${PERSON.email}`,
  Sheet.Dim,
);

// The rosette, left of the text and clear of where the profile photo lands.
const aspect = CELL_H / CELL_W;
const markRows = 17;
const radius = (markRows * aspect) / (2 * (1 + SPREAD));
// LinkedIn floats the profile photo over roughly the left 260px, so the
// rosette has to start clear of that even though the strip looks empty there.
const markCx = textCol - 6 - markExtent(radius) / 2;
const field = new Float32Array(COLS * ROWS);
const mask = new Uint8Array(COLS * ROWS);
new MarkField(COLS, ROWS, aspect, new Uint16Array(COLS * ROWS)).evaluate({
  out: field,
  mask,
  cx: markCx,
  cy: midRow + 1,
  radius,
  thick: 0.78,
  phase: 1,
  clearance: Clearance.None,
  painted: null,
  base: 0.62,
  paintedBase: 0.62,
  soft: 0,
});
for (let i = 0; i < field.length; i++) {
  const v = field[i];
  if (v < 0.05) continue;
  const idx = Math.min(MARK_RAMP.length - 1, Math.floor((0.5 + 0.5 * v) * MARK_RAMP.length));
  const c = i % COLS;
  put(c, (i - c) / COLS, MARK_RAMP[idx], v > 0.7 ? Sheet.GlowHot : Sheet.Glow, 0.92);
}

// ── Draw ─────────────────────────────────────────────────────────────────
async function draw(): Promise<void> {
  await document.fonts.load(`16px "Departure Mono"`);
  await document.fonts.ready;

  const charset = [...new Set([...grid.values()].map((v) => v.code))];
  const palette: Palette = {
    display: token('--display'),
    ink: token('--ink'),
    dim: token('--ink-dim'),
    muted: token('--muted'),
    glow: token('--glow'),
    glowHot: token('--glow-hot'),
    bark: token('--bark'),
    bloom: token('--bloom'),
    bloomDeep: token('--bloom-deep'),
  };
  const atlas = new Atlas(CELL_W, CELL_H, DPR, Math.round(CELL_H * 0.95), charset, palette);

  const canvas = document.getElementById('b') as HTMLCanvasElement;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = token('--bg');
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const originX = Math.round((W - COLS * CELL_W) / 2);
  const originY = Math.round((H - ROWS * CELL_H) / 2);
  const w = CELL_W * DPR;
  const h = CELL_H * DPR;
  for (const [i, cell] of grid) {
    const c = i % COLS;
    const r = (i - c) / COLS;
    ctx.globalAlpha = cell.alpha;
    ctx.drawImage(
      atlas.sheets[cell.sheet],
      atlas.sx(cell.code),
      0,
      w,
      h,
      Math.round((c * CELL_W + originX) * DPR),
      Math.round((r * CELL_H + originY) * DPR),
      w,
      h,
    );
  }
  ctx.globalAlpha = 1;
  document.body.dataset.ready = 'yes';
}

void draw();
