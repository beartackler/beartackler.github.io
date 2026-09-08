import './style.css';
import { Atlas, type Palette } from './atlas';
import { Field } from './field';
import { compose, type Plane } from './layout';
import { Renderer } from './render';

const IDLE_HINT = 3000;
const IDLE_GHOST = 9000;
const MIN_RADIUS = 7;
const MAX_RADIUS = 17;
/** Cells per second the idle reader travels along a line of type. */
const READ_SPEED = 30;
const PULSE_PERIOD = 2.9;

const canvas = document.getElementById('field') as HTMLCanvasElement;
const spacer = document.getElementById('spacer') as HTMLElement;
const hotspots = document.getElementById('hotspots') as HTMLElement;
const boot = document.getElementById('boot') as HTMLElement;
const hint = document.getElementById('hint') as HTMLElement;
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

/** Cell pitch is derived from a target column count, not the other way round. */
function metrics(w: number) {
  const targetCols = w >= 1280 ? 152 : w >= 1024 ? 128 : w >= 700 ? 92 : 60;
  // Capped so the poster still fits vertically on a large display instead of
  // growing until it scrolls.
  const cw = Math.min(11, Math.max(5, Math.floor(w / targetCols)));
  const ch = Math.round(cw * 1.4);
  // Block type is 5 cells tall, so the cell aspect *is* the wordmark's
  // proportion; 1.4 puts it at a normal uppercase width-to-height.
  return { cw, ch, fontPx: Math.round(ch * 0.95) };
}

function charsetFor(p: Plane): number[] {
  const set = new Set<number>();
  for (const code of p.chars) if (code !== 0) set.add(code);
  // The scramble and haze can only draw glyphs the page already contains, but
  // seed a few punctuation marks so a sparse page still has a full ramp.
  for (const ch of ".,:;-=+*#%@'\"/\\|()[]{}<>~^`") set.add(ch.charCodeAt(0));
  return [...set];
}

function build(): void {
  const w = innerWidth;
  const h = innerHeight;
  const m = metrics(w);
  cellW = m.cw;
  cellH = m.ch;

  const cols = Math.max(20, Math.floor(w / cellW));
  const previous = field;
  // Pad the plane to the viewport so haze reaches every edge of the screen.
  plane = compose(cols, Math.ceil(h / cellH));

  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  atlas = new Atlas(cellW, cellH, dpr, m.fontPx, charsetFor(plane), palette);

  originX = Math.round((w - cols * cellW) / 2);
  spacer.style.height = `${Math.max(plane.rows * cellH, h)}px`;

  field = new Field(plane.cols, plane.rows, plane.runCount);
  if (previous && previous.cols === plane.cols && previous.rows === plane.rows) {
    field.ink.set(previous.ink);
    field.light.set(previous.light);
  }

  if (!renderer) renderer = new Renderer(canvas, plane, field, atlas, dpr);
  else renderer.setPlane(plane, field, atlas);
  renderer.hot = null;

  if (reduced.matches) field.revealAll(hasChar);
  buildHotspots();
  buildReadPath();
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

function syncOrigin(): void {
  // The plane always covers at least the viewport, so it is top-aligned and
  // the composition is centred inside the plane rather than the plane inside
  // the window.
  originY = -Math.round(scrollY);
  hotspots.style.transform = `translateY(${originY}px)`;
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
  const reading = !reduced.matches && idle > ghostAfter;
  const booting = !touched && !reading;
  const aspect = cellH / cellW;

  if (booting) {
    // The resting cursor breathes rings of haze into the field: the mechanic,
    // demonstrated, without giving away a single word.
    const t = ((now / 1000) % PULSE_PERIOD) / PULSE_PERIOD;
    const eased = 1 - Math.pow(1 - t, 2.4);
    // Text cells are excluded, so the ring is free to be bright: the resume
    // reads as negative space inside the haze without a word being legible.
    field.ring(
      (innerWidth / 2 - originX) / cellW,
      (innerHeight / 2 - originY) / cellH,
      0.5 + eased * 24,
      3.0,
      aspect,
      0.72,
      plane.chars,
    );
    typeHint(idle);
  }

  const aim = reading ? readerAt(dt) : target;
  if (aim && !reduced.matches) {
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
  if (!document.body.classList.contains('plain')) {
    field.resolveRuns(plane.runId, dt);
    renderer.draw(originX, originY, bg);
  }

  if (now - pctAt > 250) {
    pctAt = now;
    updatePct();
  }
  litChrome(now, dt);

  requestAnimationFrame(frame);
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

  const lost = touched && now - startedAt > 15000 && uncovered < plane.textCells * 0.06;
  if (lost && surfacedAt === 0) surfacedAt = now;
  if (surfacedAt && now - surfacedAt < 2600) want = Math.max(want, 1);

  chromeLit += (want - chromeLit) * Math.min(1, dt * 6);
  chrome.style.setProperty('--lit', chromeLit.toFixed(3));
}

/** A hovered link lights whole, with a row of haze under it as an underline. */
function lightHoveredLink(): void {
  const h = renderer.hot;
  if (!h) return;
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

// ── The counter ────────────────────────────────────────────────────────────
// A 90s hit counter, except it counts your excavation rather than visitors,
// so it needs no backend and tracks nobody.

const ODO_DIGITS = 7;
let odoReels: HTMLElement[] = [];
let uncovered = 0;

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
  const label = document.createElement('span');
  label.textContent = 'cells';
  pct.append(box, label);
  setOdometer(0);
}

function setOdometer(value: number): void {
  const text = String(Math.min(value, 10 ** ODO_DIGITS - 1)).padStart(ODO_DIGITS, '0');
  for (let i = 0; i < ODO_DIGITS; i++) {
    odoReels[i].style.transform = `translateY(${-Number(text[i])}em)`;
  }
}

function updatePct(): void {
  let seen = 0;
  for (let i = 0; i < field.ink.length; i++) {
    if (plane.chars[i] !== 0 && field.ink[i] > 0.35) seen++;
  }
  uncovered = seen;
  setOdometer(seen);
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

addEventListener(
  'scroll',
  () => {
    noteInput();
    syncOrigin();
  },
  { passive: true },
);

function revealAll(): void {
  noteInput();
  field.revealAll(hasChar);
  updatePct();
}

function togglePlain(force?: boolean): void {
  const on = force ?? !document.body.classList.contains('plain');
  document.body.classList.toggle('plain', on);
  document.getElementById('plain-toggle')!.textContent = on ? 'grid' : 'plain';
  if (on) document.getElementById('doc')!.focus({ preventScroll: true });
}

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === ' ' && !(e.target as HTMLElement)?.closest('button')) {
    e.preventDefault();
    revealAll();
    return;
  }
  if (e.key === 'p' || e.key === 'P') return togglePlain();
  if (e.key === 'r' || e.key === 'R') {
    field.clear();
    updatePct();
    return;
  }
  if (e.key === 'Escape' && document.body.classList.contains('plain')) return togglePlain(false);

  // Arrow keys drive the lantern, so the page works without a pointer.
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

// Tabbing into the (visually hidden) document would put focus somewhere the
// visitor cannot see, so reaching it switches the page to the readable view.
document.getElementById('doc')!.addEventListener('focusin', () => {
  if (!document.body.classList.contains('plain')) togglePlain(true);
});

document.getElementById('reveal-toggle')!.addEventListener('click', revealAll);
document.getElementById('plain-toggle')!.addEventListener('click', () => togglePlain());

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
  buildOdometer();
  build();
  document.body.classList.add('ready');
  if (coarse.matches) hintText = 'drag to reveal';
  hint.textContent = '';

  // Deep links, so a link can skip straight to the readable states.
  const params = new URLSearchParams(location.search);
  if (params.has('plain')) togglePlain(true);
  if (params.has('reveal') || reduced.matches) revealAll();

  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

void start();
