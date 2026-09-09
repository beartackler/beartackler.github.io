/**
 * Renders the LinkedIn banner from the page's own parts.
 *
 * Not a lookalike: the same glyph atlas, the same block face, the same mark
 * geometry and the same palette tokens the site uses. Run `npm run dev`, open
 * `/banner.html`, and screenshot the canvas.
 *
 * Two constraints drive every number here, and both are invisible in the
 * artboard:
 *
 * 1. LinkedIn renders a 1584px banner in a container about 790px wide, so
 *    everything is halved. Type at the site's own cell size turns into a field
 *    of dots at that scale. The cells are therefore roughly twice the page's,
 *    which is also why the wordmark stacks: one line of it would need 92 cells
 *    and there is nowhere near that much room.
 * 2. The profile photo floats over roughly x 72–400, from y 208 down. That
 *    rules out the left side for the rosette, which is where the old banner
 *    put it: a mark that needs to be read cannot be half behind a photo, and
 *    a rosette small enough to sit above the photo is too coarse to resolve
 *    into four rings at all. So the photo takes the left, the wordmark the
 *    middle, and the mark the right, where it balances the photo.
 */

import './style.css';
import { Atlas, Sheet, type Palette } from './atlas';
import { blockRows } from './blockfont';
import { Clearance, markExtent, MarkField, SPREAD } from './mark';
import { PERSON } from './resume';

const W = 1584;
const H = 396;
/** Roughly twice the page's cell, so the wordmark survives being halved. */
const CELL_W = 13;
const CELL_H = 18;
const COLS = Math.floor(W / CELL_W);
const ROWS = Math.floor(H / CELL_H);
/** Where the profile photo stops covering the strip. */
const PHOTO_RIGHT = 410;

/** The mark's own ramp, as in render.ts: one stroke weight everywhere. */
const MARK_RAMP = ['.', ':', '+', '*', '@', '#'].map((c) => c.charCodeAt(0));

const css = getComputedStyle(document.documentElement);
const token = (n: string) => css.getPropertyValue(n).trim();

type Cell = { code: number; sheet: number; alpha: number };
const grid = new Map<number, Cell>();
const put = (c: number, r: number, code: number, sheet: number, alpha = 1) => {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS || code === 32) return;
  grid.set(r * COLS + c, { code, sheet, alpha });
};

// ── The wordmark, stacked ────────────────────────────────────────────────
const parts = PERSON.name.split(' ');
const art = parts.map((p) => blockRows(p));
const nameRows = art.length * 5 + (art.length - 1);

const textCol = Math.ceil(PHOTO_RIGHT / CELL_W) + 1;
const contactPx = 28;
const CONTACT = ['beartackler.github.io', PERSON.email];
const blockPx = nameRows * CELL_H;
const contactBlock = 30 + contactPx + 6 + contactPx;
const stackTop = Math.round((H - (blockPx + contactBlock)) / 2);
const nameRow = Math.round(stackTop / CELL_H);

art.forEach((lines, n) => {
  lines.forEach((line, i) => put0(line, textCol, nameRow + n * 6 + i));
});
function put0(line: string, c: number, r: number): void {
  [...line].forEach((ch, i) => put(c + i, r, ch.charCodeAt(0), Sheet.Display));
}

// ── The rosette, right of the wordmark and wholly visible ───────────────
const aspect = CELL_H / CELL_W;
/**
 * Fewer rows than this and the four rings stop resolving as four rings — they
 * collapse into a circle with hatching inside it. Seventeen is the floor, and
 * it is what sets the cell size for the whole banner: the wordmark has to fit
 * in whatever is left once the mark has the height it needs.
 */
const markRows = 17;
const radius = (markRows * aspect) / (2 * (1 + SPREAD));
const markCx = COLS - 4 - markExtent(radius) / 2;
const field = new Float32Array(COLS * ROWS);
new MarkField(COLS, ROWS, aspect, new Uint16Array(COLS * ROWS)).evaluate({
  out: field,
  mask: new Uint8Array(COLS * ROWS),
  cx: markCx,
  cy: ROWS / 2 - 0.5,
  radius,
  thick: 0.8,
  phase: 1,
  formation: 0,
  clearance: Clearance.None,
  painted: null,
  base: 0.72,
  paintedBase: 0.72,
  soft: 0,
});
for (let i = 0; i < field.length; i++) {
  const v = field[i];
  if (v < 0.05) continue;
  const idx = Math.min(MARK_RAMP.length - 1, Math.floor((0.5 + 0.5 * v) * MARK_RAMP.length));
  const c = i % COLS;
  put(c, (i - c) / COLS, MARK_RAMP[idx], v > 0.8 ? Sheet.GlowHot : Sheet.Glow);
}

// ── Draw ─────────────────────────────────────────────────────────────────
async function draw(): Promise<void> {
  await document.fonts.load('16px "Departure Mono"');
  await document.fonts.load(`${contactPx}px "Departure Mono"`);
  await document.fonts.ready;

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
  const charset = [...new Set([...grid.values()].map((v) => v.code))];
  // dpr 1: the output is the final size, so the pixel art stays pixel-exact
  // instead of being resampled on the way out.
  const atlas = new Atlas(CELL_W, CELL_H, 1, Math.round(CELL_H * 0.95), charset, palette);

  const canvas = document.getElementById('b') as HTMLCanvasElement;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = token('--bg');
  ctx.fillRect(0, 0, W, H);

  const originX = Math.round((W - COLS * CELL_W) / 2);
  const originY = Math.round((H - ROWS * CELL_H) / 2);
  for (const [i, cell] of grid) {
    const c = i % COLS;
    const r = (i - c) / COLS;
    ctx.globalAlpha = cell.alpha;
    ctx.drawImage(
      atlas.sheets[cell.sheet],
      atlas.sx(cell.code),
      0,
      CELL_W,
      CELL_H,
      c * CELL_W + originX,
      r * CELL_H + originY,
      CELL_W,
      CELL_H,
    );
  }
  ctx.globalAlpha = 1;

  // The contact line is set larger than a grid cell would allow, because at
  // half size a 25px cell is unreadable and this is the one line that has to
  // be read.
  ctx.font = `${contactPx}px "Departure Mono", monospace`;
  ctx.textBaseline = 'alphabetic';
  CONTACT.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? palette.ink : palette.dim;
    ctx.fillText(
      line,
      textCol * CELL_W + originX,
      stackTop + blockPx + 30 + contactPx * 0.78 + i * (contactPx + 6),
    );
  });

  document.body.dataset.ready = 'yes';
}

void draw();
