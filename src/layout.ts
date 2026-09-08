/**
 * Composes the resume into a character plane.
 *
 * The plane is bigger than the viewport is wide-open: everything is placed in
 * cell coordinates, so the same code produces the two-column desktop poster
 * and the stacked narrow layout. Nothing here knows about pixels.
 */

import { BLOCK_ROWS, blockRows, blockWidth } from './blockfont';
import { BEFORE, EDU, MAKES, NOW, PERSON, type Role } from './resume';

/**
 * Cell height as a multiple of cell width. Block type is 5 cells tall, so this
 * *is* the wordmark's proportion; 1.4 puts it at a normal uppercase width.
 * Lives here because the composition reasons about it too.
 */
export const CELL_ASPECT = 1.4;

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
  /** A blinking block after the copy on the small-screen card, if there is one. */
  caret: { col: number; row: number } | null;
  /**
   * Where the ikigai mark rests before the second act, and how many rows it
   * may occupy there. The height is what sets its size: the mark has to fit
   * the band beside the wordmark without crowding the rule underneath, and
   * that band is a property of the composition, not of the viewport.
   */
  markRest: { col: number; row: number; rows: number };
  /**
   * Which word each cell belongs to. Resolution is computed per word rather
   * than per cell, so type snaps into focus whole instead of dissolving at
   * the edge of the light.
   */
  runId: Int32Array;
  runCount: number;
  /** Which runs count as words for the counter; see `bake`. */
  isWord: Uint8Array;
  wordCount: number;
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
  markRest = { col: 0, row: 0, rows: 10 };
  caret: { col: number; row: number } | null = null;

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

  /**
   * `minRows` pads the plane out to the viewport and centres the composition
   * inside it. Without it the grid ends where the text ends and the lantern
   * has no cells to light near the top and bottom edges of the screen.
   *
   * `reserveRows` keeps the bottom of the plane clear for the fixed controls,
   * which would otherwise sit on top of the last lines of the composition.
   */
  bake(cols: number, minRows: number, reserveRows: number): Plane {
    const contentRows = this.maxRow + 2;
    const rows = Math.max(contentRows, minRows);
    const shift = Math.max(0, Math.floor((rows - reserveRows - contentRows) / 2));
    const chars = new Uint16Array(cols * rows);
    const tone = new Uint8Array(cols * rows);
    const links: LinkRegion[] = [];

    for (const op of this.ops) {
      const glyphs = [...op.s];
      const row = op.row + shift;
      for (let i = 0; i < glyphs.length; i++) {
        const c = op.col + i;
        if (c < 0 || c >= cols || row < 0 || row >= rows) continue;
        const code = glyphs[i].charCodeAt(0);
        if (code === 32) continue; // spaces stay empty, not blank glyphs
        chars[row * cols + c] = code;
        tone[row * cols + c] = op.tone;
      }
      if (op.kind === 'link') {
        links.push({ col: op.col, row, len: glyphs.length, href: op.href, label: op.s });
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

    const home = { col: this.home.col, row: this.home.row + shift };
    const markRest = { ...this.markRest, row: this.markRest.row + shift };
    const caret = this.caret && { col: this.caret.col, row: this.caret.row + shift };
    // "Words" excludes block type (whose strokes are runs of their own), the
    // halftone rule (one very long run) and single-character separators, so
    // the counter reports something a visitor would actually call a word.
    const runLen = new Int32Array(runCount);
    const runTone = new Uint8Array(runCount);
    for (let i = 0; i < runId.length; i++) {
      const k = runId[i];
      if (k < 0) continue;
      runLen[k]++;
      runTone[k] = tone[i];
    }
    const isWord = new Uint8Array(runCount);
    let wordCount = 0;
    for (let k = 0; k < runCount; k++) {
      if (runTone[k] === Tone.Display || runLen[k] < 2 || runLen[k] > 40) continue;
      isWord[k] = 1;
      wordCount++;
    }

    return {
      cols,
      rows,
      chars,
      tone,
      textCells,
      links,
      home,
      markRest,
      caret: caret ?? null,
      runId,
      runCount,
      isWord,
      wordCount,
    };
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

export function compose(cols: number, minRows = 0, reserveRows = 0): Plane {
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
    const ruleRow = y;
    d.text(x0, ruleRow, rulePattern(contentW), Tone.Muted);

    const top = ruleRow + 3;

    // The mark rests in the middle of the layout, centred on the gutter.
    //
    // Beside the wordmark is the obvious place and it does not work: the band
    // between the top of the name and the rule is about ten rows on a normal
    // desktop, and four overlapping rings need something closer to seventeen
    // before they read as four rings rather than as one lumpy one. The gutter
    // is the only run of the poster tall enough, and at a normal width the
    // whole mark lands inside it without touching a single character.
    const restRows = 17;
    d.markRest = {
      col: x0 + LEFT_W + Math.round(gutter / 2),
      row: top + 12,
      rows: restRows,
    };

    // Left column: the work, newest first.
    let yl = d.block(x0, top, 'NOW', Tone.Display) + 2;
    for (const r of NOW) yl = roleBlock(d, x0, yl, r) + 2;
    yl += 2;
    yl = d.block(x0, yl, 'BEFORE', Tone.Display) + 2;
    for (const r of BEFORE) yl = roleBlock(d, x0, yl, r) + 2;

    // Right column: school, tools, how to reach him.
    let yr = d.block(xR, top, 'EDU', Tone.Display) + 2;
    yr = paintEdu(d, xR, yr) + 2;
    yr = d.block(xR, yr, 'MAKES', Tone.Display) + 2;
    yr = paintMakes(d, xR, yr) + 4;
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
    for (const r of NOW) y = roleBlock(d, x0, y, r) + 2;
    y += 2;
    y = d.block(x0, y, 'BEFORE', Tone.Display) + 2;
    for (const r of BEFORE) y = roleBlock(d, x0, y, r) + 2;
    y += 2;
    y = d.block(x0, y, 'EDU', Tone.Display) + 2;
    y = paintEdu(d, x0, y) + 2;
    y = d.block(x0, y, 'MAKES', Tone.Display) + 2;
    y = paintMakes(d, x0, y) + 4;
    y = d.block(x0, y, 'REACH', Tone.Display) + 2;
    paintReach(d, x0, y);

    // Nothing fits beside a wrapped wordmark on a phone, but the ragged right
    // edge of the single column leaves a clear strip for its whole height, so
    // the band is as tall as the mark wants rather than as tall as a header.
    // Positioned from its own right edge inward, or it runs off the screen.
    const restRows = 15;
    d.markRest = {
      col: cols - 2 - Math.round((restRows * CELL_ASPECT) / 2),
      row: Math.round(d.maxRow * 0.42),
      rows: restRows,
    };
  }

  return d.bake(cols, minRows, reserveRows);
}

/**
 * The small-screen card.
 *
 * The whole page is a cursor dragged across a grid, and a touch screen has no
 * cursor: the lantern has nothing to follow, the two-column poster has nowhere
 * to go, and the second act has no room to play. Rather than shrink all of it
 * into something that works badly, say so, in the same type — and hand over
 * the two things a visitor on a phone actually came for.
 */
export function composeCard(cols: number, minRows = 0, reserveRows = 0): Plane {
  const d = new Draft();
  const w = Math.min(NARROW_W, cols - 4);
  const x0 = Math.max(2, Math.floor((cols - w) / 2));

  d.home = { col: x0 + 8, row: 4 };
  d.markRest = { col: x0 + Math.round(w / 2), row: 6, rows: 10 };

  let y = paintName(d, x0, 2, w) + 2;
  d.text(x0, y, PERSON.tagline, Tone.Dim);
  y += 2;
  d.text(x0, y, rulePattern(w), Tone.Muted);
  y += 3;

  d.text(x0, y++, 'this page is a room you walk', Tone.Ink);
  d.text(x0, y, 'through with a cursor.', Tone.Ink);
  y += 2;
  const closing = 'it wants a desktop.';
  d.text(x0, y, closing, Tone.Accent);
  // The same blinking block the page opens with, so the card is recognisably
  // the same machine, just resting.
  d.caret = { col: x0 + closing.length + 1, row: y };
  y += 3;

  d.link(x0, y, '[ resume.pdf ]', PERSON.resume, Tone.Ink);
  y += 2;
  d.link(x0, y++, PERSON.email, `mailto:${PERSON.email}`, Tone.Dim);
  d.link(x0, y++, PERSON.github, PERSON.githubHref, Tone.Dim);
  d.link(x0, y++, PERSON.linkedin, PERSON.linkedinHref, Tone.Dim);

  return d.bake(cols, minRows, reserveRows);
}
