import './style.css';
import { Atlas, type Palette } from './atlas';
import { Field } from './field';
import { compose, type Plane } from './layout';
import { Renderer } from './render';

const IDLE_HINT = 3000;
const IDLE_GHOST = 8000;
const MIN_RADIUS = 7;
const MAX_RADIUS = 17;

const canvas = document.getElementById('field') as HTMLCanvasElement;
const spacer = document.getElementById('spacer') as HTMLElement;
const boot = document.getElementById('boot') as HTMLElement;
const hint = document.getElementById('hint') as HTMLElement;
const pct = document.getElementById('pct') as HTMLElement;
const hotspots = document.getElementById('hotspots') as HTMLElement;

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
let cellH = 14;
let originX = 0;
let originY = 0;

// Pointer state, in fractional plane cells.
let target: { c: number; r: number } | null = null;
let cursor: { c: number; r: number } | null = null;
let radius = MAX_RADIUS;
let lastInput = performance.now();
let touched = false;
let ghostPhase = Math.random() * 1000;

/** Cell pitch is derived from a target column count, not the other way round. */
function metrics(w: number) {
  const targetCols = w >= 1280 ? 152 : w >= 1024 ? 128 : w >= 700 ? 92 : 60;
  const cw = Math.max(5, Math.floor(w / targetCols));
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
  const previous = plane;
  plane = compose(cols);

  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  atlas = new Atlas(cellW, cellH, dpr, m.fontPx, charsetFor(plane), palette);

  const planeH = plane.rows * cellH;
  originX = Math.round((w - cols * cellW) / 2);
  spacer.style.height = `${Math.max(planeH + cellH * 2, h)}px`;

  const carried = previous && field ? field : null;
  field = new Field(plane.cols, plane.rows);
  if (carried && carried.cols === plane.cols && carried.rows === plane.rows) {
    field.ink.set(carried.ink);
    field.light.set(carried.light);
  }

  if (!renderer) renderer = new Renderer(canvas, plane, field, atlas, dpr);
  else renderer.setPlane(plane, field, atlas);

  if (reduced.matches) field.revealAll(hasChar);
  buildHotspots();
  syncOrigin();
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
    hotspots.append(a);
  }
}

function hasChar(i: number): boolean {
  return plane.chars[i] !== 0;
}

function syncOrigin(): void {
  const planeH = plane.rows * cellH;
  const slack = innerHeight - planeH;
  originY = slack > 0 ? Math.round(slack / 2) : -Math.round(scrollY);
  hotspots.style.transform = `translateY(${originY}px)`;
}

function toPlane(clientX: number, clientY: number) {
  return {
    c: (clientX - originX) / cellW,
    r: (clientY - originY) / cellH,
  };
}

function noteInput(): void {
  lastInput = performance.now();
  if (!touched) {
    touched = true;
    document.body.classList.add('touched');
  }
  hint.classList.remove('on');
}

/** A slow Lissajous wander, so the idle demo never retraces the same path. */
function ghostTarget(t: number) {
  const p = ghostPhase + t * 0.00016;
  const c = plane.cols * (0.5 + 0.4 * Math.sin(p * 2.1) * Math.cos(p * 0.7));
  const r = plane.rows * (0.5 + 0.42 * Math.sin(p * 1.3 + 1.1));
  return { c, r };
}

let last = performance.now();
let pctAt = 0;

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  syncOrigin();

  const idle = now - lastInput;
  const ghostAfter = coarse.matches ? IDLE_GHOST / 2 : IDLE_GHOST;
  let aim = target;
  if (!reduced.matches && touched && idle > ghostAfter) aim = ghostTarget(now);
  else if (!touched && idle > ghostAfter) aim = ghostTarget(now);

  if (aim) {
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
      field.stamp(cursor.c + dc * k, cursor.r + dr * k, radius, cellH / cellW);
    }
    cursor.c += dc;
    cursor.r += dr;
  }

  if (!reduced.matches) field.step(dt, hasChar);
  renderer.draw(originX, originY, bg);

  if (!touched && idle > IDLE_HINT) hint.classList.add('on');

  if (now - pctAt > 250) {
    pctAt = now;
    updatePct();
  }

  requestAnimationFrame(frame);
}

function updatePct(): void {
  let seen = 0;
  for (let i = 0; i < field.ink.length; i++) {
    if (plane.chars[i] !== 0 && field.ink[i] > 0.35) seen++;
  }
  const value = plane.textCells ? Math.round((seen / plane.textCells) * 100) : 0;
  pct.textContent = `${value}% uncovered`;
}

addEventListener('pointermove', (e) => {
  noteInput();
  boot.classList.add('gone');
  target = toPlane(e.clientX, e.clientY);
});

addEventListener('pointerdown', (e) => {
  noteInput();
  boot.classList.add('gone');
  const p = toPlane(e.clientX, e.clientY);
  target = p;
  if (!cursor) cursor = { ...p };
});

addEventListener('scroll', () => {
  noteInput();
  syncOrigin();
}, { passive: true });

function revealAll(): void {
  noteInput();
  boot.classList.add('gone');
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
  const editing = (e.target as HTMLElement)?.tagName === 'INPUT';
  if (editing) return;

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
  boot.classList.add('gone');
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
  if (coarse.matches) hint.textContent = 'drag to reveal';

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
