import './style.css';
import { Atlas, type Palette } from './atlas';
import { Blossom } from './blossom';
import { Field } from './field';
import { compose, type Plane } from './layout';
import { Clearance, MarkField, markExtent, SPREAD } from './mark';
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
/** Fraction of the plane the plum branch claims; the mark gets the rest. */
const BLOSSOM_BAND = 0.38;

const canvas = document.getElementById('field') as HTMLCanvasElement;
const spacer = document.getElementById('spacer') as HTMLElement;
const hotspots = document.getElementById('hotspots') as HTMLElement;
const boot = document.getElementById('boot') as HTMLElement;
const hint = document.getElementById('hint') as HTMLElement;
const nudge = document.getElementById('nudge') as HTMLElement;
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

let target: { c: number; r: number } | null = null;
let cursor: { c: number; r: number } | null = null;
let radius = MAX_RADIUS;
let lastInput = performance.now();
let touched = false;
/** Where the lantern is, in client pixels, for lighting the chrome. */
const lanternAt = { x: -9999, y: -9999 };
let chromeLit = 0;
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
let scrollP = 0;
let blossom: Blossom | null = null;
let overlay: Overlay | null = null;

function cellMetrics(cw: number) {
  // Block type is 5 cells tall, so the cell aspect *is* the wordmark's
  // proportion; 1.4 puts it at a normal uppercase width-to-height.
  const ch = Math.round(cw * 1.4);
  return { cw, ch, fontPx: Math.round(ch * 0.95) };
}

/**
 * Picks a cell size that fits the whole composition on screen.
 *
 * Act one is a poster and should not scroll, so width sets the first guess and
 * the cell shrinks until the composition also fits the height. Scrolling is
 * reserved for the second act.
 */
function fitMetrics(w: number, h: number) {
  // The fixed controls are not part of the plane, so their height comes off
  // the budget before anything is measured against it.
  h -= chrome.offsetHeight + 6;
  const targetCols = w >= 1280 ? 152 : w >= 1024 ? 128 : w >= 700 ? 92 : 60;
  let cw = Math.min(11, Math.max(4, Math.floor(w / targetCols)));

  for (let attempt = 0; attempt < 6; attempt++) {
    const m = cellMetrics(cw);
    const cols = Math.max(20, Math.floor(w / m.cw));
    const need = compose(cols).rows * m.ch;
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
  const m = fitMetrics(w, h);
  cellW = m.cw;
  cellH = m.ch;
  posterFits = m.fits;

  const previous = field;
  // Pad the plane to the viewport so haze reaches every edge of the screen,
  // but keep the composition clear of the controls.
  chromeRows = Math.ceil((chrome.offsetHeight + 6) / cellH);
  plane = compose(m.cols, Math.ceil(h / cellH), chromeRows);

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

  if (reduced.matches) {
    field.revealAll(hasChar);
    // A static poster: hand over the mark rather than withholding it.
    unlockMark(true);
  }
  buildHotspots();
  buildReadPath();
  syncScrollRange();
  syncOrigin();
}

function hasChar(i: number): boolean {
  return plane.chars[i] !== 0;
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
  return markOn && posterFits ? innerHeight * JOURNEY_SPAN : 0;
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
  scrollP = span > 0 ? Math.min(1, Math.max(0, scrollY / span)) : 0;
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
  scrollP = 0;
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
  const move = 1 - (1 - scrollP) * (1 - scrollP);
  const e = smooth(scrollP);
  const baseR = Math.max(5, plane.cols * 0.034);
  // The mark ends up filling exactly the band between the branch and the
  // controls, so it reads as large on a wide desktop and on a tall phone
  // alike. A fixed fraction of the width cannot do both, and the chrome's
  // scrim quietly eats anything that runs under it.
  const top = plane.rows * BLOSSOM_BAND;
  const bottom = plane.rows - chromeRows;
  const room = Math.max(8, bottom - top);
  const endExtent = Math.min(plane.cols * 0.86, (room - 1) * aspect);
  const endR = endExtent / (2 * (1 + SPREAD));
  const r = baseR + (endR - baseR) * e;

  const anchor = plane.markAnchor;
  const cyEnd = (top + bottom) / 2;
  const cx = anchor.col + (plane.cols / 2 - anchor.col) * move;
  const halfRows = markExtent(r) / aspect / 2;
  let cy = anchor.row + (cyEnd - anchor.row) * move;
  // At rest the mark must sit fully on the plane; once it is growing, letting
  // the bottom run off the screen is the composition, not a bug.
  cy = Math.max(cy, halfRows * (1 - e) + 1);

  markMask.fill(0);
  markField.evaluate({
    out: field.floor,
    mask: markMask,
    cx,
    cy,
    radius: r,
    thick: 0.75 + 0.4 * e,
    phase: markPhase,
    // A generous halo while the mark sits beside the wordmark; hairline gaps
    // while it travels through a page that is still legible; nothing to
    // respect once the resume has gone.
    clearance:
      scrollP < 0.06 ? Clearance.Wide : renderer.fade > 0.01 ? Clearance.Tight : Clearance.None,
    painted: scrollP < 0.03 ? painted : null,
    // A safelight glow behind the resume, full ink once it is the whole page.
    base: 0.46 + 0.42 * e,
    paintedBase: 0.72 + 0.16 * e,
  });

  // Sweeping the lantern along a ring burns that stretch of it in, but only
  // while the mark is at rest; a growing ring has no fixed cells to paint.
  if (scrollP < 0.03) {
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

function stepBlossom(): void {
  if (!overlay || !blossom) return;
  const p = smooth((scrollP - 0.05) / 0.88);
  overlay.alpha.fill(0);
  if (p > 0) blossom.render(overlay, p);
}

// ── The counter ────────────────────────────────────────────────────────────
// A 90s hit counter, except it counts your excavation rather than visitors,
// so it needs no backend and tracks nobody.

const ODO_DIGITS = 3;
let odoReels: HTMLElement[] = [];
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
  // Pad the total to match the reel, so the pair reads as one counter. The
  // unit is a separate span because a narrow chrome drops it rather than
  // wrapping onto a second line.
  const total = document.createElement('span');
  total.textContent = `/${String(plane.wordCount).padStart(ODO_DIGITS, '0')}`;
  const unit = document.createElement('span');
  unit.className = 'odo-unit';
  unit.textContent = ' words';
  pct.append(box, total, unit);
  setOdometer(0);
}

function setOdometer(value: number): void {
  const text = String(Math.min(value, 10 ** ODO_DIGITS - 1)).padStart(ODO_DIGITS, '0');
  for (let i = 0; i < ODO_DIGITS; i++) {
    odoReels[i].style.transform = `translateY(${-Number(text[i])}em)`;
  }
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
  setOdometer(seen);

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

  const idle = now - lastInput;
  const ghostAfter = coarse.matches ? IDLE_GHOST / 2 : IDLE_GHOST;
  const reading = !reduced.matches && idle > ghostAfter && scrollP < 0.02;
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
  if (aim && !reduced.matches && scrollP < 0.5) {
    if (!cursor) cursor = { ...aim };
    const dc = aim.c - cursor.c;
    const dr = aim.r - cursor.r;
    const distPx = Math.hypot(dc * cellW, dr * cellH);

    // Fast sweeps narrow the lantern into a comet; dwelling opens it out.
    const speed = distPx / Math.max(dt, 0.001);
    const want = MAX_RADIUS - (MAX_RADIUS - MIN_RADIUS) * Math.min(1, speed / 2400);
    radius += (want - radius) * Math.min(1, dt * 8);

    // Stamp along the path so a fast flick leaves a continuous trail.
    const steps = Math.max(1, Math.ceil(distPx / (radius * cellW * 0.35)));
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      field.stamp(cursor.c + dc * k, cursor.r + dr * k, radius, aspect);
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
  // The resume is gone well before the mark finishes growing, so the two
  // never fight for attention.
  renderer.fade = 1 - smooth(scrollP / 0.45);
  renderer.tint = smooth((scrollP - 0.06) / 0.3);
  pct.style.opacity = String(1 - Math.min(1, scrollP * 3));
  // Don't leave invisible links clickable once the resume has faded.
  hotspots.style.pointerEvents = scrollP > 0.25 ? 'none' : 'auto';
  // Wait for the rings to finish drawing themselves before asking for more.
  nudge.classList.toggle('on', journeySpan() > 0 && markPhase > 0.8 && scrollP < 0.05);
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
  if (!h || scrollP > 0.25) return;
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
  noteInput();
  target = toPlane(e.clientX, e.clientY);
});

addEventListener('pointerdown', (e) => {
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
  if (e.metaKey || e.ctrlKey || e.altKey) return;

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

document.getElementById('reveal-toggle')!.addEventListener('click', revealAll);

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
  if (new URLSearchParams(location.search).has('reveal') || reduced.matches) revealAll();

  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

void start();
