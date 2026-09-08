/**
 * Composes the resume into a character plane.
 *
 * The plane is bigger than the viewport is wide-open: everything is placed in
 * cell coordinates, so the same code produces the two-column desktop poster
 * and the stacked narrow layout. Nothing here knows about pixels.
 */

import { BLOCK_ROWS, blockRows, blockWidth } from './blockfont';
import { BEFORE, EDU, MAKES, NOW, PERSON, type Role } from './resume';

export const Tone = {
  Display: 0,
  Ink: 1,
  Dim: 2,
  Muted: 3,
  /** Safelight amber, for the labels in the craft block. */
  Accent: 4,
} as const;
export type ToneValue = (typeof Tone)[keyof typeof Tone];

export type LinkRegion = {
  col: number;
  row: number;
  len: number;
  href: string;
  label: string;
};

export type Plane = {
  cols: number;
  rows: number;
  /** UTF-16 code unit per cell; 0 means empty. */
  chars: Uint16Array;
  tone: Uint8Array;
  /** Number of non-empty cells, for the uncovered readout. */
  textCells: number;
  /** Where a keyboard visitor's lantern starts: on the name, not in a gutter. */
  home: { col: number; row: number };
  /**
   * Which word each cell belongs to. Resolution is computed per word rather
   * than per cell, so type snaps into focus whole instead of dissolving at
   * the edge of the light.
   */
  runId: Int32Array;
  runCount: number;
  links: LinkRegion[];
};

/**
 * The divider under the name doubles as a legend: it is the same density ramp
 * the lantern's fringe draws with, swept light → heavy → light.
 */
function rulePattern(w: number): string {
  const ramp = '.·:-=+*#%@';
  let out = '';
  for (let i = 0; i < w; i++) {
    const t = 1 - Math.abs((2 * i) / (w - 1) - 1);
    out += ramp[Math.round(t * (ramp.length - 1))];
  }
  return out;
}

type Op =
  | { kind: 'text'; col: number; row: number; s: string; tone: ToneValue }
  | { kind: 'link'; col: number; row: number; s: string; tone: ToneValue; href: string };

class Draft {
  ops: Op[] = [];
  maxRow = 0;
  maxCol = 0;
  home = { col: 0, row: 0 };

  text(col: number, row: number, s: string, tone: ToneValue): void {
    if (!s) return;
    this.ops.push({ kind: 'text', col, row, s, tone });
    this.maxRow = Math.max(this.maxRow, row);
    this.maxCol = Math.max(this.maxCol, col + [...s].length);
  }

  /** Right-aligns `s` so its last cell sits at `colEnd - 1`. */
  right(colEnd: number, row: number, s: string, tone: ToneValue): void {
    this.text(colEnd - [...s].length, row, s, tone);
  }

  link(col: number, row: number, s: string, href: string, tone: ToneValue): void {
    this.ops.push({ kind: 'link', col, row, s, tone, href });
    this.maxRow = Math.max(this.maxRow, row);
    this.maxCol = Math.max(this.maxCol, col + [...s].length);
  }

  /** Stamps 5-row block type. Returns the row after the block. */
  block(col: number, row: number, s: string, tone: ToneValue): number {
    blockRows(s).forEach((line, i) => this.text(col, row + i, line, tone));
    return row + BLOCK_ROWS;
  }

  bake(cols: number): Plane {
    const rows = this.maxRow + 2;
    const chars = new Uint16Array(cols * rows);
    const tone = new Uint8Array(cols * rows);
    const links: LinkRegion[] = [];

    for (const op of this.ops) {
      const glyphs = [...op.s];
      for (let i = 0; i < glyphs.length; i++) {
        const c = op.col + i;
        if (c < 0 || c >= cols || op.row < 0 || op.row >= rows) continue;
        const code = glyphs[i].charCodeAt(0);
        if (code === 32) continue; // spaces stay empty, not blank glyphs
        chars[op.row * cols + c] = code;
        tone[op.row * cols + c] = op.tone;
      }
      if (op.kind === 'link') {
        links.push({ col: op.col, row: op.row, len: glyphs.length, href: op.href, label: op.s });
      }
    }

    let textCells = 0;
    for (let i = 0; i < chars.length; i++) if (chars[i] !== 0) textCells++;

    // Contiguous non-empty cells in a row form one word; spaces break the run.
    const runId = new Int32Array(cols * rows).fill(-1);
    let runCount = 0;
    for (let r = 0; r < rows; r++) {
      let open = false;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (chars[i] !== 0) {
          if (!open) {
            runCount++;
            open = true;
          }
          runId[i] = runCount - 1;
        } else {
          open = false;
        }
      }
    }

    return { cols, rows, chars, tone, textCells, links, home: this.home, runId, runCount };
  }
}

/**
 * Two lines: what he did, then where and when. The supporting detail lives in
 * the plain view and the PDF, so the grid stays a poster rather than a page.
 */
function roleBlock(d: Draft, x: number, row: number, r: Role): number {
  d.text(x, row, r.title, Tone.Ink);
  d.text(x + 2, row + 1, r.org, Tone.Dim);
  d.text(x + 3 + [...r.org].length, row + 1, `· ${r.when}`, Tone.Muted);
  return row + 2;
}

function paintEdu(d: Draft, x: number, row: number): number {
  let y = row;
  let lastSchool = '';
  for (const s of EDU) {
    if (s.school !== lastSchool) {
      if (lastSchool) y += 1;
      d.text(x, y++, s.school, Tone.Ink);
      lastSchool = s.school;
    }
    d.text(x + 2, y, s.award, Tone.Dim);
    d.text(x + 3 + [...s.award].length, y, `· ${s.when}`, Tone.Muted);
    y += 1;
    if (s.extra) d.text(x + 2, y++, s.extra, Tone.Muted);
  }
  return y + 1;
}

/** A labelled definition block: amber key on the left, items indented. */
function paintMakes(d: Draft, x: number, row: number): number {
  let y = row;
  for (const [label, lines] of MAKES) {
    d.text(x, y, label, Tone.Accent);
    for (const line of lines) d.text(x + 8, y++, line, Tone.Dim);
  }
  return y;
}

function paintReach(d: Draft, x: number, row: number): number {
  let y = row;
  d.link(x, y++, PERSON.email, `mailto:${PERSON.email}`, Tone.Ink);
  d.link(x, y++, PERSON.phone, `tel:${PERSON.phoneHref}`, Tone.Dim);
  d.link(x, y++, PERSON.github, PERSON.githubHref, Tone.Dim);
  d.link(x, y++, PERSON.linkedin, PERSON.linkedinHref, Tone.Dim);
  y += 1;
  d.link(x, y++, '[ resume.pdf ]', PERSON.resume, Tone.Ink);
  return y;
}

/** Name as block type, wrapping to a second line when the column is tight. */
function paintName(d: Draft, x: number, row: number, avail: number): number {
  const whole = PERSON.name;
  if (blockWidth(whole) <= avail) return d.block(x, row, whole, Tone.Display);

  const parts = whole.split(' ');
  if (parts.every((p) => blockWidth(p) <= avail)) {
    let y = row;
    for (const p of parts) y = d.block(x, y, p, Tone.Display) + 1;
    return y - 1;
  }

  // Narrower than block type can serve; fall back to plain display text.
  d.text(x, row, whole, Tone.Display);
  return row + 1;
}

const LEFT_W = 52;
const RIGHT_W = 46;
const NARROW_W = 54; // exactly wide enough for MONASYPOV as block type

export function compose(cols: number): Plane {
  const d = new Draft();
  const twoUp = cols >= LEFT_W + RIGHT_W + 8 + 8;

  if (twoUp) {
    const gutter = Math.min(30, Math.max(8, cols - 8 - LEFT_W - RIGHT_W));
    const contentW = LEFT_W + gutter + RIGHT_W;
    const x0 = Math.max(2, Math.floor((cols - contentW) / 2));
    const xR = x0 + LEFT_W + gutter;

    d.home = { col: x0 + 12, row: 4 };
    let y = paintName(d, x0, 2, contentW) + 2;
    d.text(x0, y, PERSON.tagline, Tone.Dim);
    y += 2;
    d.text(x0, y, rulePattern(contentW), Tone.Muted);

    const top = y + 3;

    // Left column: the work, newest first.
    let yl = d.block(x0, top, 'NOW', Tone.Display) + 2;
    for (const r of NOW) yl = roleBlock(d, x0, yl, r) + 1;
    yl += 2;
    yl = d.block(x0, yl, 'BEFORE', Tone.Display) + 2;
    for (const r of BEFORE) yl = roleBlock(d, x0, yl, r) + 1;

    // Right column: school, tools, how to reach him.
    let yr = d.block(xR, top, 'EDU', Tone.Display) + 2;
    yr = paintEdu(d, xR, yr) + 1;
    yr = d.block(xR, yr, 'MAKES', Tone.Display) + 2;
    yr = paintMakes(d, xR, yr) + 3;
    yr = d.block(xR, yr, 'REACH', Tone.Display) + 2;
    paintReach(d, xR, yr);
  } else {
    const w = Math.min(NARROW_W, cols - 4);
    const x0 = Math.max(2, Math.floor((cols - w) / 2));

    d.home = { col: x0 + 8, row: 4 };
    let y = paintName(d, x0, 2, w) + 2;
    d.text(x0, y, PERSON.tagline, Tone.Dim);
    y += 2;
    d.text(x0, y, rulePattern(w), Tone.Muted);
    y += 3;

    y = d.block(x0, y, 'NOW', Tone.Display) + 2;
    for (const r of NOW) y = roleBlock(d, x0, y, r) + 1;
    y += 2;
    y = d.block(x0, y, 'BEFORE', Tone.Display) + 2;
    for (const r of BEFORE) y = roleBlock(d, x0, y, r) + 1;
    y += 2;
    y = d.block(x0, y, 'EDU', Tone.Display) + 2;
    y = paintEdu(d, x0, y) + 1;
    y = d.block(x0, y, 'MAKES', Tone.Display) + 2;
    y = paintMakes(d, x0, y) + 3;
    y = d.block(x0, y, 'REACH', Tone.Display) + 2;
    paintReach(d, x0, y);
  }

  return d.bake(cols);
}
