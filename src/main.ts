import './style.css';
import { Atlas, Sheet, type Palette } from './atlas';
import { Blossom } from './blossom';
import { Field } from './field';
import { CELL_ASPECT, compose, composeCard, type Plane } from './layout';
import { Clearance, MarkField, markExtent, SPREAD } from './mark';
import { R8, type Emitter } from './r8';
import { Renderer, type Overlay } from './render';

const IDLE_HINT = 3000;
const IDLE_GHOST = 9000;
const MIN_RADIUS = 7;
const MAX_RADIUS = 17;
/** Cells per second the idle reader travels along a line of type. */
const READ_SPEED = 30;
const PULSE_PERIOD = 2.9;
/** Fraction of the page you must uncover by hand before the mark appears. */
const MARK_AT = 0.9;
const MARK_DRAW_SECONDS = 4.2;
/** How much of a viewport the second act takes to play out. */
const JOURNEY_SPAN = 1.35;
/**
 * And the third: the rings unfold, the car arrives, turns, and lights up.
 *
 * Longer than act two because it has four beats rather than two, and because
 * the turn needs room — rushed, a rotation reads as a glitch rather than a
 * camera move.
 */
const DRIVE_SPAN = 2.05;
/** Where act two ends, on the 0..1 parameter the two acts share. */
const ACT_TWO = JOURNEY_SPAN / (JOURNEY_SPAN + DRIVE_SPAN);
/** How far round the car turns: past its tail, so one flank stays in view. */
const TURN_TO = 200;
/** Fraction of the plane the plum branch claims; the mark gets the rest. */
const BLOSSOM_BAND = 0.38;
/**
 * Seconds for the journey to catch up to the scroll position, near enough.
 *
 * A wheel notch is a jump, and the mark is rasterised to whole cells, so
 * driving the second act straight off `scrollY` makes it advance in visible
 * steps. Following the scroll with a spring turns each notch into travel.
 */
const SCROLL_LAG = 0.16;

const canvas = document.getElementById('field') as HTMLCanvasElement;
const spacer = document.getElementById('spacer') as HTMLElement;
const hotspots = document.getElementById('hotspots') as HTMLElement;
const boot = document.getElementById('boot') as HTMLElement;
const hint = document.getElementById('hint') as HTMLElement;
const nudge = document.getElementById('nudge') as HTMLElement;
const caret = document.getElementById('caret') as HTMLElement;
const coda = document.getElementById('coda') as HTMLElement;
const drive = document.getElementById('drive') as HTMLElement;
const pct = document.getElementById('pct') as HTMLElement;
const chrome = document.querySelector('.chrome') as HTMLElement;

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)');

const css = getComputedStyle(document.documentElement);
const colour = (name: string) => css.getPropertyValue(name).trim();
const palette: Palette = {
  display: colour('--display'),
  ink: colour('--ink'),
  dim: colour('--ink-dim'),
  muted: colour('--muted'),
  glow: colour('--glow'),
  glowHot: colour('--glow-hot'),
  bark: colour('--bark'),
  bloom: colour('--bloom'),
  bloomDeep: colour('--bloom-deep'),
};
const bg = colour('--bg');

let plane!: Plane;
let field!: Field;
let atlas!: Atlas;
let renderer!: Renderer;
let cellW = 9;
let cellH = 13;
let originX = 0;
let originY = 0;
let posterFits = true;
/** Rows at the bottom of the plane the fixed controls sit over. */
let chromeRows = 0;
/** True when we are showing the small-screen card instead of the page. */
let cardMode = false;
/** Seconds the card has been fading up. */
let cardAt = 0;

/**
 * Whether this screen gets the card rather than the page.
 *
 * A touch screen has no cursor for the lantern to follow, so the mechanic the
 * whole page is built on simply is not available. Width alone is not the test:
 * a narrow desktop window still has a pointer and gets the stacked poster.
 */
function smallScreen(): boolean {
  return (coarse.matches && innerWidth < 900) || innerWidth < 560;
}

let target: { c: number; r: number } | null = null;
let cursor: { c: number; r: number } | null = null;
let radius = MAX_RADIUS;
let lastInput = performance.now();
let touched = false;
/** Where the lantern is, in client pixels, for lighting the chrome. */
const lanternAt = { x: -9999, y: -9999 };
let chromeLit = 0;
/**
 * How much light the lantern is still putting out.
 *
 * Once the rings are painted there is nothing left in act one to uncover, and
 * a pool of light still chasing the cursor over a page that is already fully
 * developed is just restlessness. It fades out over a second and a half
 * rather than switching off, and comes back if the page is reset.
 */
let lanternGain = 1;
let chromeBox: DOMRect | null = null;
let surfacedAt = 0;
const startedAt = performance.now();

// ── The second act ─────────────────────────────────────────────────────────
// It opens once the page is uncovered, by hand or by the reveal button; there
// is no reason to strand someone who took the shortcut. Everything past the
// unlock is a pure function of scroll position, so scrolling back up returns
// the page exactly to the resume it came from.
let markField: MarkField | null = null;
let markMask = new Uint8Array(0);
let markOn = false;
let markPhase = 0;
let painted = new Uint8Array(0);
let markComplete = false;
/** Where the scroll bar is. */
let scrollRaw = 0;
/** Where the journey has got to; chases `scrollRaw`. See SCROLL_LAG. */
let scrollP = 0;
let blossom: Blossom | null = null;
let overlay: Overlay | null = null;
let car: R8 | null = null;
let emitters: Emitter[] = [];
/** Priority per overlay cell, so the flames can take cells off the car. */
let overlayPrio = new Uint8Array(0);

function cellMetrics(cw: number) {
  const ch = Math.round(cw * CELL_ASPECT);
  return { cw, ch, fontPx: Math.round(ch * 0.95) };
}

/**
 * Picks a cell size that fits the whole composition on screen.
 *
 * Act one is a poster and should not scroll, so width sets the first guess and
 * the cell shrinks until the composition also fits the height. Scrolling is
 * reserved for the second act.
 */
function fitMetrics(w: number, h: number, plan: typeof compose) {
  // The fixed controls are not part of the plane, so their height comes off
  // the budget before anything is measured against it.
  h -= chrome.offsetHeight + 6;
  const targetCols = w >= 1280 ? 152 : w >= 1024 ? 128 : w >= 700 ? 92 : 60;
  let cw = Math.min(11, Math.max(4, Math.floor(w / targetCols)));

  for (let attempt = 0; attempt < 6; attempt++) {
    const m = cellMetrics(cw);
    const cols = Math.max(20, Math.floor(w / m.cw));
    const need = plan(cols).rows * m.ch;
    if (need <= h) return { ...m, cols, fits: true };
    if (cw <= 4) return { ...m, cols, fits: false };
    cw = Math.max(4, Math.min(cw - 1, Math.floor(cw * (h / need))));
  }
  const m = cellMetrics(4);
  return { ...m, cols: Math.max(20, Math.floor(w / 4)), fits: false };
}

function charsetFor(p: Plane): number[] {
  const set = new Set<number>();
  for (const code of p.chars) if (code !== 0) set.add(code);
  // The haze, the scramble and the blossom can only draw glyphs the atlas
  // holds, so seed the punctuation and line-art they need.
  for (const ch of ".,:;-=+*#%@'\"/\\|()[]{}<>~^`o") set.add(ch.charCodeAt(0));
  return [...set];
}

function build(): void {
  const w = innerWidth;
  const h = innerHeight;
  cardMode = smallScreen();
  const plan = cardMode ? composeCard : compose;
  document.body.classList.toggle('card', cardMode);
  const m = fitMetrics(w, h, plan);
  cellW = m.cw;
  cellH = m.ch;
  posterFits = m.fits;

  const previous = field;
  // Pad the plane to the viewport so haze reaches every edge of the screen,
  // but keep the composition clear of the controls.
  chromeRows = Math.ceil((chrome.offsetHeight + 6) / cellH);
  plane = plan(m.cols, Math.ceil(h / cellH), chromeRows);

  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  atlas = new Atlas(cellW, cellH, dpr, m.fontPx, charsetFor(plane), palette);

  originX = Math.round((w - m.cols * cellW) / 2);

  const cells = plane.cols * plane.rows;
  field = new Field(plane.cols, plane.rows, plane.runCount);
  if (previous && previous.cols === plane.cols && previous.rows === plane.rows) {
    field.ink.set(previous.ink);
    field.light.set(previous.light);
  }

  markField = new MarkField(plane.cols, plane.rows, cellH / cellW, plane.chars);
  markMask = new Uint8Array(cells);
  painted = new Uint8Array(cells);
  blossom = new Blossom(plane.cols, plane.rows, cellH / cellW);
  car = new R8(plane.cols, plane.rows);
  emitters = [];
  overlayPrio = new Uint8Array(cells);
  overlay = {
    char: new Uint16Array(cells),
    sheet: new Uint8Array(cells),
    alpha: new Float32Array(cells),
  };
  if (markOn) markPhase = 1;

  if (!renderer) renderer = new Renderer(canvas, plane, field, atlas, dpr);
  else renderer.setPlane(plane, field, atlas);
  renderer.hot = null;
  renderer.overlay = overlay;

  runInk = new Float32Array(plane.runCount);
  buildOdometer();

  if (cardMode) {
    // Nothing to uncover: the card is the message, so it simply arrives.
    field.revealAll(hasChar);
    cardAt = 0;
    boot.classList.add('gone');
  } else if (reduced.matches) {
    field.revealAll(hasChar);
    // A static poster: hand over the mark rather than withholding it.
    unlockMark(true);
  }
  hotspots.classList.remove('off');
  placeChrome();
  if (plane.caret) {
    caret.style.left = `${originX + plane.caret.col * cellW}px`;
    caret.style.top = `${plane.caret.row * cellH}px`;
    caret.style.width = `${cellW}px`;
    caret.style.height = `${cellH}px`;
  }
  buildHotspots();
  buildReadPath();
  syncScrollRange();
  syncOrigin();
}

function hasChar(i: number): boolean {
  return plane.chars[i] !== 0;
}

/**
 * Puts the nudge and the coda where the mark is, not where the viewport is.
 *
 * Both belong to the mark: the nudge hangs on the axis it is about to travel
 * down, and the coda is set against it at its final height. Positioning them
 * off the plane rather than off the screen edges is what stops them reading as
 * chrome parked in a corner.
 */
function placeChrome(): void {
  const rest = plane.markRest;
  const aspect = cellH / cellW;

  // Nudge: on the mark's column, a few rows below where it rests.
  const below = rest.row + rest.rows / 2 + 2.5;
  const floorRow = plane.rows - chromeRows - 6;
  nudge.style.left = `${originX + (rest.col + 0.5) * cellW}px`;
  nudge.style.top = `${Math.min(below, floorRow) * cellH}px`;

  // Coda: level with the mark's end position and ranged right against its
  // left edge. Anchoring it to the mark rather than to a left margin is what
  // guarantees it never runs into the rosette, whatever the line lengths and
  // whatever size the type ends up at.
  const top = plane.rows * BLOSSOM_BAND;
  const bottom = plane.rows - chromeRows;
  const room = Math.max(8, bottom - top);
  const extent = Math.min(plane.cols * 0.86, (room - 1) * aspect);
  const markLeft = originX + (plane.cols / 2 - extent / 2 - 4) * cellW;
  coda.style.right = `${Math.max(cellW * 2, innerWidth - markLeft)}px`;
  coda.style.top = `${((top + bottom) / 2) * cellH}px`;

  // Act three's line sits in the column the car leaves free when it settles
  // left, at the height of the car rather than the badge above it.
  const carTop = badgeRow() + (plane.cols * BADGE_WIDTH) / 6.5 / aspect + 2;
  const carBottom = plane.rows - chromeRows - 1;
  drive.style.left = `${originX + (plane.cols * (0.5 + CAR_SHIFT) + carWidth() / 2 + 3) * cellW}px`;
  drive.style.top = `${(carTop + (carBottom - carTop) * 0.44) * cellH}px`;
}

/** The car's final width in cells; the quote is placed off its right edge. */
function carWidth(): number {
  return plane.cols * 0.58;
}

/** One transparent anchor per link run, laid out in plane coordinates. */
function buildHotspots(): void {
  hotspots.textContent = '';
  for (const l of plane.links) {
    const a = document.createElement('a');
    a.href = l.href;
    a.tabIndex = -1; // the accessible document already exposes these links
    a.style.left = `${originX + l.col * cellW}px`;
    a.style.top = `${l.row * cellH}px`;
    a.style.width = `${l.len * cellW}px`;
    a.style.height = `${cellH}px`;
    // Everything except mail/phone opens away from the page, so a recruiter
    // who clicks the PDF doesn't lose the grid.
    if (!/^(mailto|tel):/.test(l.href)) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    a.addEventListener('pointerenter', () => {
      renderer.hot = l;
    });
    a.addEventListener('pointerleave', () => {
      if (renderer.hot === l) renderer.hot = null;
    });
    hotspots.append(a);
  }
}

/** Scrolling exists only while there is a second act to scroll through. */
function journeySpan(): number {
  return markOn && posterFits && !cardMode ? innerHeight * (JOURNEY_SPAN + DRIVE_SPAN) : 0;
}

/**
 * Each act's own 0..1, carved out of the shared scroll parameter.
 *
 * Every threshold in act two was tuned against a progress value that reached
 * 1 at its end, so rather than rescale all of them, act two keeps its own
 * clamped parameter and act three gets a second one that starts where the
 * first finishes.
 */
let act2P = 0;
let act3P = 0;

function splitScroll(): void {
  act2P = Math.min(1, scrollP / ACT_TWO);
  act3P = Math.max(0, (scrollP - ACT_TWO) / (1 - ACT_TWO));
}

function syncScrollRange(): void {
  const span = journeySpan();
  if (!posterFits) {
    // Too small for the poster: the plane itself scrolls, so the composition
    // is readable rather than clipped. There is no second act at this size.
    spacer.style.height = `${plane.rows * cellH}px`;
  } else {
    spacer.style.height = span > 0 ? `${innerHeight + span}px` : '0';
  }
  document.body.style.overflowY = span > 0 || !posterFits ? 'auto' : 'hidden';
}

function syncOrigin(): void {
  // In act one the canvas is fixed and the composition is centred inside a
  // plane that already covers the viewport. Only the fallback for screens too
  // small to fit the poster scrolls the plane itself.
  originY = posterFits ? 0 : -Math.round(scrollY);
  hotspots.style.transform = `translateY(${originY}px)`;

  const span = journeySpan();
  scrollRaw = span > 0 ? Math.min(1, Math.max(0, scrollY / span)) : 0;
}

/** Eases the journey toward the scroll position, and settles in bounded time. */
function followScroll(dt: number): void {
  const gap = scrollRaw - scrollP;
  const far = Math.abs(gap);
  if (far < 0.0005) {
    scrollP = scrollRaw;
    return;
  }
  // Proportional while there is distance to cover, with a floor so the last
  // sliver closes instead of trailing an exponential tail for a full second.
  const step = Math.min(far, Math.max(far * Math.min(1, dt / SCROLL_LAG), dt * 0.4));
  scrollP += Math.sign(gap) * step;
}

function toPlane(clientX: number, clientY: number) {
  return { c: (clientX - originX) / cellW, r: (clientY - originY) / cellH };
}

function noteInput(): void {
  lastInput = performance.now();
  if (!touched) {
    touched = true;
    document.body.classList.add('touched');
    boot.classList.add('gone');
    hint.classList.remove('on');
  }
}

// ── The idle reader ────────────────────────────────────────────────────────
// Rather than wandering, the ghost traces the actual lines of type: left to
// right along a line, then a quick carriage return to the next one. It looks
// like someone invisible is reading the page.

type Seg = { a: { c: number; r: number }; b: { c: number; r: number }; len: number; speed: number };
let readSegs: Seg[] = [];
let readTotal = 0;
let readAt = 0;

function buildReadPath(): void {
  const points: { c: number; r: number }[] = [];
  for (let r = 0; r < plane.rows; r++) {
    let first = -1;
    let last = -1;
    for (let c = 0; c < plane.cols; c++) {
      if (plane.chars[r * plane.cols + c] !== 0) {
        if (first < 0) first = c;
        last = c;
      }
    }
    if (first >= 0) {
      points.push({ c: first, r });
      points.push({ c: last, r });
    }
  }

  readSegs = [];
  readTotal = 0;
  readAt = 0;
  const aspect = cellH / cellW;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b.c - a.c, (b.r - a.r) * aspect) || 0.001;
    // Reading a line is slow; the return sweep between lines is not.
    const speed = b.c < a.c ? 3.2 : 1;
    readSegs.push({ a, b, len, speed });
    readTotal += len / speed;
  }
}

function readerAt(dt: number): { c: number; r: number } | null {
  if (readSegs.length === 0) return null;
  readAt = (readAt + dt * READ_SPEED) % readTotal;
  let acc = readAt;
  for (const s of readSegs) {
    const cost = s.len / s.speed;
    if (acc <= cost) {
      const k = acc / cost;
      return { c: s.a.c + (s.b.c - s.a.c) * k, r: s.a.r + (s.b.r - s.a.r) * k };
    }
    acc -= cost;
  }
  return readSegs[0].a;
}

// ── The mark and the blossom ───────────────────────────────────────────────

function resetMark(): void {
  markOn = false;
  markPhase = 0;
  markComplete = false;
  lanternGain = 1;
  scrollP = 0;
  scrollRaw = 0;
  blossomP = 0;
  document.body.classList.remove('act2', 'act3');
  coda.classList.remove('on');
  drive.classList.remove('on');
  act2P = 0;
  act3P = 0;
  painted.fill(0);
  markMask.fill(0);
  field.floor.fill(0);
  if (overlay) overlay.alpha.fill(0);
  scrollTo(0, 0);
  syncScrollRange();
}

function unlockMark(finished = false): void {
  markOn = true;
  syncScrollRange();
  if (!finished) return;
  markPhase = 1;
  markComplete = true;
}

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/**
 * Places the rings for the current scroll position: small beside the wordmark
 * at rest, large and low by the end. Intensity goes into `field.floor`, which
 * lights the grid without feeding the decay, the burn-in or the counter.
 */
function stepMark(dt: number): void {
  if (!markOn || !markField) return;
  if (markPhase < 1) markPhase = Math.min(1, markPhase + dt / MARK_DRAW_SECONDS);

  const aspect = cellH / cellW;
  // Position leaves the wordmark promptly and settles; scale eases at both
  // ends. Two curves, because "detaching" and "growing" want different feels.
  const move = 1 - (1 - act2P) * (1 - act2P);
  const e = smooth(act2P);
  // Small enough to sit in the band the composition left for it, which is
  // also what makes it read as granular before it grows.
  const rest = plane.markRest;
  const baseR = (rest.rows * aspect) / (2 * (1 + SPREAD));
  // The mark ends up filling exactly the band between the branch and the
  // controls, so it reads as large on a wide desktop and on a tall phone
  // alike. A fixed fraction of the width cannot do both, and the chrome's
  // scrim quietly eats anything that runs under it.
  const top = plane.rows * BLOSSOM_BAND;
  const bottom = plane.rows - chromeRows;
  const room = Math.max(8, bottom - top);
  const endExtent = Math.min(plane.cols * 0.86, (room - 1) * aspect);
  const endR = endExtent / (2 * (1 + SPREAD));
  const actTwoR = baseR + (endR - baseR) * e;

  const cyEnd = (top + bottom) / 2;
  let cx = rest.col + (plane.cols / 2 - rest.col) * move;
  let cy = rest.row + (cyEnd - rest.row) * move;
  // At rest the mark must sit fully on the plane; once it is growing, letting
  // the bottom run off the screen is the composition, not a bug.
  cy = Math.max(cy, (markExtent(actTwoR) / aspect / 2) * (1 - e) + 1);

  // Act three. The diamond unfolds into the Audi row, and the mark stops being
  // the whole page to become a badge over the car. The morph leads the move
  // slightly, so the arrangement has changed by the time it settles: seeing
  // it unfold is the point, and it is lost if it happens while shrinking.
  const formation = smooth((act3P - 0.02) / 0.26);
  const settle = smooth(act3P / 0.34);
  const badgeR = (plane.cols * BADGE_WIDTH) / (2 * (1 + 1.5 * 1.5));
  const r = actTwoR + (badgeR - actTwoR) * settle;
  cy += (badgeRow() - cy) * settle;
  cx +=
    (plane.cols / 2 + plane.cols * CAR_SHIFT * smooth((act3P - 0.80) / 0.16) - cx) * settle;

  markMask.fill(0);
  markField.evaluate({
    out: field.floor,
    mask: markMask,
    cx,
    cy,
    radius: r,
    // The row wants a finer ring than the diamond did: at the badge's radius
    // act two's weight closes the rings up into four blobs.
    thick: (0.75 + 0.4 * e) * (1 - settle) + 0.85 * settle,
    phase: markPhase,
    formation,
    // Feathered while it is in motion, crisp at either end of the journey:
    // a hard ring band pops cells in and out a whole glyph at a time as it
    // grows, and the feather turns each of those pops into a fade.
    soft: Math.max(4 * act2P * (1 - act2P), 4 * settle * (1 - settle)),
    // A generous halo while the mark sits beside the wordmark; hairline gaps
    // while it travels through a page that is still legible; nothing to
    // respect once the resume has gone.
    clearance:
      act2P < 0.06 ? Clearance.Wide : renderer.fade > 0.01 ? Clearance.Tight : Clearance.None,
    painted: act2P < 0.03 ? painted : null,
    // A safelight glow behind the resume, full ink once it is the whole page.
    base: 0.46 + 0.42 * e,
    paintedBase: 0.72 + 0.16 * e,
  });

  // Sweeping the lantern along a ring burns that stretch of it in, but only
  // while the mark is at rest; a growing ring has no fixed cells to paint.
  if (act2P < 0.03) {
    let total = 0;
    let done = 0;
    for (let i = 0; i < markMask.length; i++) {
      if (markMask[i] === 0) continue;
      total++;
      if (painted[i] === 0 && field.light[i] > 0.5) painted[i] = 1;
      if (painted[i]) done++;
    }
    if (!markComplete && total > 0 && done >= total * 0.85) markComplete = true;
  }
  if (markComplete) {
    for (let i = 0; i < markMask.length; i++) {
      if (markMask[i] && field.floor[i] < 0.72) field.floor[i] = 0.72;
    }
  }
}

/** How far the branch has grown; act two's readout counts against it. */
let blossomP = 0;

/** Rows from the top of the plane to the centre of the Audi badge. */
function badgeRow(): number {
  return plane.rows * 0.135;
}

function stepBlossom(): void {
  if (!overlay || !blossom) return;
  blossomP = smooth((scrollP - 0.26 * ACT_TWO) / (0.69 * ACT_TWO));
  overlay.alpha.fill(0);
  overlayPrio.fill(0);
  if (blossomP <= 0) return;
  blossom.render(overlay, blossomP);
  // The branch clears out before the car arrives. Each act takes the page
  // from the last one rather than sharing it; a plum branch over a supercar
  // is two ideas at once, which is none.
  const gone = smooth(act3P / 0.20);
  if (gone > 0) {
    for (let i = 0; i < overlay.alpha.length; i++) overlay.alpha[i] *= 1 - gone;
  }
}

/** Fraction of the plane's width the Audi rings settle at. */
const BADGE_WIDTH = 0.40;
/**
 * How far left the whole group drifts once the flames are lit.
 *
 * The car is centred for the head-on shot and the turn, because that is the
 * hero framing and anything off-centre there looks like a mistake. The quote
 * needs a column of its own, though, and a 34-character line will not fit in
 * the margin a centred car leaves — so at the very end the group settles left
 * and opens one. It is the last move of the page, and it is small.
 */
const CAR_SHIFT = -0.085;

function stepCar(now: number): void {
  if (!overlay || !car || act3P <= 0.22) {
    emitters = [];
    return;
  }
  const aspect = cellH / cellW;
  // Arrive, hold, turn, burn. The hold matters: the brief asked for the car
  // to face the camera *first*, and without a beat of stillness between
  // arriving and turning the two moves read as one continuous slide.
  const arrive = smooth((act3P - 0.24) / 0.20);
  const turn = smooth((act3P - 0.55) / 0.31);
  const heat = smooth((act3P - 0.80) / 0.17);

  const badgeBottom = badgeRow() + (plane.cols * BADGE_WIDTH) / 6.5 / aspect;
  const topRow = badgeBottom + 2;
  const bottomRow = plane.rows - chromeRows - 1;
  // Biased up rather than centred in its box: the plumes need the room below
  // it, and a car sitting dead centre leaves a dead band under the badge.
  const cy = topRow + (bottomRow - topRow) * 0.44;

  const shift = plane.cols * CAR_SHIFT * smooth((act3P - 0.80) / 0.16);
  emitters = car.render({
    azimuth: TURN_TO * turn,
    // Low, and barely rising. Looking down on a mid-engine car flattens its
    // deck into a plate and throws away the silhouette that identifies it.
    elevation: 8 + 4 * turn,
    cx: plane.cols / 2 + shift,
    cy,
    // Grows a little as it arrives, so it reads as coming toward you rather
    // than fading up in place.
    width: carWidth() * (0.90 + 0.10 * arrive),
    height: (bottomRow - topRow) * (0.86 + 0.12 * arrive),
    aspect,
  });
  car.paint(overlay, atlas.ramp, arrive, overlayPrio, 1);
  car.flames(overlay, emitters, heat, reduced.matches ? 0 : now / 1000, overlayPrio, 2, {
    core: Sheet.Display,
    mid: Sheet.Bloom,
    deep: Sheet.BloomDeep,
  });
}

// ── The counter ────────────────────────────────────────────────────────────
// A 90s hit counter, except it counts your excavation rather than visitors,
// so it needs no backend and tracks nobody.

const ODO_DIGITS = 3;
let odoReels: HTMLElement[] = [];
let odoTotal!: HTMLElement;
let odoUnit!: HTMLElement;
let odoShowing = '';
let uncovered = 0;
let runInk = new Float32Array(0);

function buildOdometer(): void {
  pct.textContent = '';
  odoReels = [];
  const box = document.createElement('span');
  box.className = 'odo';
  for (let i = 0; i < ODO_DIGITS; i++) {
    const digit = document.createElement('span');
    digit.className = 'odo-digit';
    const reel = document.createElement('span');
    reel.className = 'odo-reel';
    for (let n = 0; n <= 9; n++) {
      const cell = document.createElement('span');
      cell.textContent = String(n);
      reel.append(cell);
    }
    digit.append(reel);
    box.append(digit);
    odoReels.push(reel);
  }
  // The unit is a separate span because a narrow chrome drops it rather than
  // wrapping onto a second line.
  odoTotal = document.createElement('span');
  odoUnit = document.createElement('span');
  odoUnit.className = 'odo-unit';
  pct.append(box, odoTotal, odoUnit);
  odoShowing = '';
  setReadout(0, plane.wordCount, 'words');
}

/**
 * The counter, for whichever act is running.
 *
 * Act one counts words uncovered; act two counts blossoms open. Same reels,
 * same shape, and in both cases a denominator — a bare number tells you
 * nothing about whether there is more, which is the whole job here.
 */
function setReadout(value: number, total: number, unit: string): void {
  const text = String(Math.min(value, 10 ** ODO_DIGITS - 1)).padStart(ODO_DIGITS, '0');
  for (let i = 0; i < ODO_DIGITS; i++) {
    odoReels[i].style.transform = `translateY(${-Number(text[i])}em)`;
  }
  if (odoShowing === unit) return;
  odoShowing = unit;
  odoTotal.textContent = `/${String(total).padStart(ODO_DIGITS, '0')}`;
  odoUnit.textContent = ` ${unit}`;
}

function updatePct(): void {
  // Words, not cells: a cell is a rendering detail, a word is something the
  // visitor can actually feel progress against.
  runInk.fill(0);
  for (let i = 0; i < field.ink.length; i++) {
    const k = plane.runId[i];
    if (k < 0 || field.ink[i] <= runInk[k]) continue;
    runInk[k] = field.ink[i];
  }
  let seen = 0;
  for (let k = 0; k < plane.runCount; k++) {
    if (plane.isWord[k] && runInk[k] > 0.35) seen++;
  }
  uncovered = seen;
  if (act2P < 0.02) setReadout(seen, plane.wordCount, 'words');

  if (!markOn && plane.wordCount && seen >= plane.wordCount * MARK_AT) {
    unlockMark();
  }
}

// ── Frame ──────────────────────────────────────────────────────────────────

let last = performance.now();
let pctAt = 0;
let hintText = 'move your cursor';

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  syncOrigin();
  followScroll(dt);
  splitScroll();

  if (cardMode) {
    cardAt += dt;
    // The row skew in `fade` turns a plain ramp into a top-down wipe, so the
    // card writes itself on rather than switching on.
    renderer.fade = reduced.matches ? 1 : Math.min(1, cardAt / 1.15);
    field.resolveRuns(plane.runId, dt);
    renderer.draw(originX, originY, bg);
    caret.style.opacity = String(Math.max(0, Math.min(1, cardAt - 0.9)));
    requestAnimationFrame(frame);
    return;
  }

  const idle = now - lastInput;
  const ghostAfter = coarse.matches ? IDLE_GHOST / 2 : IDLE_GHOST;
  // The page also stops reading itself once there is nothing left to read.
  const reading = !reduced.matches && idle > ghostAfter && act2P < 0.02 && !markComplete;
  const want = markComplete ? 0 : 1;
  lanternGain += Math.sign(want - lanternGain) * Math.min(Math.abs(want - lanternGain), dt / 1.5);
  const booting = !touched && !reading && !reduced.matches;
  const aspect = cellH / cellW;

  // `floor` is written fresh each frame by whichever system is active — the
  // boot ring before first input, the ikigai mark after it is earned.
  field.floor.fill(0);

  if (booting) {
    // The resting cursor breathes rings of haze into the field: the mechanic,
    // demonstrated, without giving away a single word. `floor` lights the
    // material but never develops type, so the ring can cross the whole
    // screen as one unbroken line and still give nothing away.
    const t = ((now / 1000) % PULSE_PERIOD) / PULSE_PERIOD;
    const eased = 1 - Math.pow(1 - t, 2.4);
    const reach = (Math.min(innerWidth, innerHeight) / cellW) * 0.3;
    field.ring(
      (innerWidth / 2 - originX) / cellW,
      (innerHeight / 2 - originY) / cellH,
      0.5 + eased * reach,
      4.2,
      aspect,
      0.85,
    );
    typeHint(idle);
  }

  const aim = reading ? readerAt(dt) : target;
  if (aim && !reduced.matches && act2P < 0.5) {
    if (!cursor) cursor = { ...aim };
    const dc = aim.c - cursor.c;
    const dr = aim.r - cursor.r;
    const distPx = Math.hypot(dc * cellW, dr * cellH);

    // Fast sweeps narrow the lantern into a comet; dwelling opens it out.
    const speed = distPx / Math.max(dt, 0.001);
    const want = MAX_RADIUS - (MAX_RADIUS - MIN_RADIUS) * Math.min(1, speed / 2400);
    radius += (want - radius) * Math.min(1, dt * 8);

    // Stamp along the path so a fast flick leaves a continuous trail. The
    // position keeps tracking even after the lantern has faded out, because
    // the chrome still lights when the pointer comes near it.
    if (lanternGain > 0.01) {
      const steps = Math.max(1, Math.ceil(distPx / (radius * cellW * 0.35)));
      for (let s = 1; s <= steps; s++) {
        const k = s / steps;
        field.stamp(cursor.c + dc * k, cursor.r + dr * k, radius, aspect, lanternGain);
      }
    }
    cursor.c += dc;
    cursor.r += dr;
    lanternAt.x = originX + cursor.c * cellW;
    lanternAt.y = originY + cursor.r * cellH;
  }

  // The cold open is a demo, not the visitor's doing: it must not burn in.
  // A short half-life while booting keeps the pulse a travelling ring rather
  // than letting its wake fill in as a disc.
  if (!reduced.matches) field.step(dt, hasChar, !booting, booting ? 0.3 : undefined);
  lightHoveredLink();
  stepMark(dt);
  stepBlossom();
  stepCar(now);
  applyJourney();
  field.resolveRuns(plane.runId, dt);
  renderer.draw(originX, originY, bg);

  if (now - pctAt > 250) {
    pctAt = now;
    updatePct();
  }
  litChrome(now, dt);

  requestAnimationFrame(frame);
}

/** Everything the scroll position drives, in one place. */
function applyJourney(): void {
  // The resume — and with it every amber thing on the page — is gone before
  // the blossom is legible, so the two palettes hand over rather than
  // overlap. The mark keeps growing across the gap, so the beat of near-empty
  // screen between the acts reads as a breath instead of a dead zone.
  renderer.fade = 1 - smooth(act2P / 0.32);
  renderer.tint = smooth((act2P - 0.04) / 0.24);
  // Don't leave invisible links clickable once the resume has faded. The
  // class goes on the container but the rule it enables targets the anchors,
  // because that is the only level at which it actually takes effect.
  hotspots.classList.toggle('off', act2P > 0.25);
  // Wait for the rings to finish drawing themselves before asking for more.
  nudge.classList.toggle('on', journeySpan() > 0 && markPhase > 0.6 && act2P < 0.05);

  // The readout stays through the second act rather than fading out. Without
  // it there is nothing on screen that says how far the journey runs or that
  // it ends, which is the one thing scrolling into it does not tell you.
  const inAct2 = act2P > 0.02;
  document.body.classList.toggle('act2', inAct2 && act3P < 0.12);
  document.body.classList.toggle('act3', act3P >= 0.12);
  if (inAct2 && act3P < 0.24 && blossom) {
    setReadout(blossom.opened(blossomP), blossom.total, 'blossoms');
  } else if (act3P >= 0.24) {
    // Act three counts degrees through the turn. Same reels, same promise:
    // a number with a denominator, so the scroll always says where it ends.
    setReadout(Math.round(TURN_TO * smooth((act3P - 0.55) / 0.31)), TURN_TO, 'degrees');
  }

  // Musashi lands once the branch and the mark have both arrived, and clears
  // before the rings unfold; Andretti lands once the car is lit.
  coda.classList.toggle('on', blossomP >= 1 && act2P > 0.93 && act3P < 0.06);
  drive.classList.toggle('on', act3P > 0.93);
}

/**
 * The controls obey the same physics as the grid: bringing the lantern near
 * the corner lights them. They stay out of the way otherwise, and surface once
 * on their own for anyone who has been here a while and found nothing.
 */
function litChrome(now: number, dt: number): void {
  if (!chromeBox) chromeBox = chrome.getBoundingClientRect();
  const dx = Math.max(chromeBox.left - lanternAt.x, 0, lanternAt.x - chromeBox.right);
  const dy = Math.max(chromeBox.top - lanternAt.y, 0, lanternAt.y - chromeBox.bottom);
  let want = Math.max(0, 1 - Math.hypot(dx, dy) / 320);
  want = want * want * (3 - 2 * want);

  const lost = touched && now - startedAt > 15000 && uncovered < plane.wordCount * 0.06;
  if (lost && surfacedAt === 0) surfacedAt = now;
  if (surfacedAt && now - surfacedAt < 2600) want = Math.max(want, 1);

  chromeLit += (want - chromeLit) * Math.min(1, dt * 6);
  chrome.style.setProperty('--lit', chromeLit.toFixed(3));
}

/** A hovered link lights whole, with a row of haze under it as an underline. */
function lightHoveredLink(): void {
  const h = renderer.hot;
  if (!h || act2P > 0.25) return;
  for (let c = h.col; c < h.col + h.len; c++) {
    field.light[h.row * plane.cols + c] = 1;
    if (h.row + 1 < plane.rows) {
      const below = (h.row + 1) * plane.cols + c;
      if (field.light[below] < 0.62) field.light[below] = 0.62;
    }
  }
}

function typeHint(idle: number): void {
  if (idle < IDLE_HINT) return;
  // The single cursor moves from the middle of the screen to the end of the
  // line it is about to write.
  boot.classList.add('gone');
  hint.classList.add('on');
  const chars = reduced.matches ? hintText.length : Math.floor((idle - IDLE_HINT) / 34);
  hint.textContent = hintText.slice(0, Math.min(chars, hintText.length));
}

// ── Input ──────────────────────────────────────────────────────────────────

addEventListener('pointermove', (e) => {
  if (cardMode) return;
  noteInput();
  target = toPlane(e.clientX, e.clientY);
});

addEventListener('pointerdown', (e) => {
  if (cardMode) return;
  noteInput();
  const p = toPlane(e.clientX, e.clientY);
  target = p;
  if (!cursor) cursor = { ...p };
});

addEventListener('scroll', () => syncOrigin(), { passive: true });

function revealAll(): void {
  noteInput();
  field.revealAll(hasChar);
  updatePct();
}

addEventListener('keydown', (e) => {
  if (cardMode || e.metaKey || e.ctrlKey || e.altKey) return;

  // Space reveals while anything is still hidden; once it is all up, hand the
  // key back to the browser so it pages through the second act.
  if (e.key === ' ' && !(e.target as HTMLElement)?.closest('button')) {
    if (uncovered >= plane.wordCount) return;
    e.preventDefault();
    revealAll();
    return;
  }
  if (e.key === 'r' || e.key === 'R') {
    field.clear();
    resetMark();
    updatePct();
    return;
  }

  // Arrow keys drive the lantern while there is still something to uncover.
  // Once the second act is unlocked they go back to scrolling, which is what
  // a visitor will reach for next.
  if (markOn) return;
  const step = e.shiftKey ? 12 : 4;
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = moves[e.key];
  if (!move) return;
  e.preventDefault();
  noteInput();
  const from = target ?? { c: plane.home.col, r: plane.home.row };
  target = {
    c: Math.max(0, Math.min(plane.cols - 1, from.c + move[0])),
    r: Math.max(0, Math.min(plane.rows - 1, from.r + move[1])),
  };
});

document.getElementById('reveal-toggle')!.addEventListener('click', () => {
  if (!cardMode) revealAll();
});

let resizeAt = 0;
addEventListener('resize', () => {
  chromeBox = null;
  clearTimeout(resizeAt);
  resizeAt = setTimeout(build, 150) as unknown as number;
});
reduced.addEventListener('change', build);

async function start(): Promise<void> {
  try {
    await document.fonts.load('16px "Departure Mono"');
    await document.fonts.ready;
  } catch {
    // Fallback monospace still renders a coherent grid.
  }
  build();
  document.body.classList.add('ready');
  if (coarse.matches) hintText = 'drag to reveal';
  hint.textContent = '';

  // Focus must never land on the visually hidden document; assistive tech
  // reaches it through its own reading cursor, not the tab order.
  document.querySelectorAll<HTMLAnchorElement>('#doc a').forEach((a) => {
    a.tabIndex = -1;
  });

  // Deep link, so a link can skip straight to the readable state.
  if (!cardMode && (new URLSearchParams(location.search).has('reveal') || reduced.matches)) {
    revealAll();
  }

  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

void start();
