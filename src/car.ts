/**
 * Dev-only preview for the slide artwork (src/art.ts). Renders through the real
 * atlas and the real ramp, so what is judged here is what the page will draw.
 * Vite builds index.html only, so this ships nothing.
 *
 *   /car.html               the R8 at a few sizes
 *   /car.html?art=hole      any other slide, by scene id
 *   /car.html?m=tone        raw alpha, no ramp
 *   /car.html?w=90          force a width in cells
 *   /car.html?only=3-9      a slice of the shape list, for bisecting
 */
import './style.css';
import { Atlas, type Palette } from './atlas';
import { fit, Painter } from './art';
import { CELL_ASPECT } from './layout';
import { R8_ART } from './slides/r8';
import { GALLERY } from './slides/gallery';
import type { Art } from './art';
import type { Overlay } from './render';

const q = new URLSearchParams(location.search);
const MODE = q.get('m');
const ART: Art = q.get('art') ? GALLERY[q.get('art')!] : R8_ART;
const WIDTHS = q.get('w') ? [Number(q.get('w'))] : [130, 100, 72];

const css = getComputedStyle(document.documentElement);
const c = (n: string) => css.getPropertyValue(n).trim();
const palette: Palette = {
  display: c('--display'), ink: c('--ink'), dim: c('--ink-dim'), muted: c('--muted'),
  glow: c('--glow'), glowHot: c('--glow-hot'), bark: c('--bark'),
  bloom: c('--bloom'), bloomDeep: c('--bloom-deep'),
};

const CELL_W = 9;
const CELL_H = Math.round(CELL_W * CELL_ASPECT);
const COLS = Number(q.get("cols") || 150);
const charset = [...".,:;-=+*#%@'\"/\\|()[]{}<>~^`o_"].map((s) => s.charCodeAt(0));

await document.fonts.load(`${Math.round(CELL_H * 0.95)}px "Departure Mono"`);
const dpr = 2;
const atlas = new Atlas(CELL_W, CELL_H, dpr, Math.round(CELL_H * 0.95), charset, palette);

const bands = WIDTHS.map((w) => Math.ceil((ART.h / ART.w) * w / CELL_ASPECT) + 6);
const ROWS = bands.reduce((a, b) => a + b, 0);

const canvas = document.getElementById('car') as HTMLCanvasElement;
canvas.width = COLS * CELL_W * dpr;
canvas.height = ROWS * CELL_H * dpr;
canvas.style.width = `${COLS * CELL_W}px`;
canvas.style.height = `${ROWS * CELL_H}px`;
const g = canvas.getContext('2d')!;
g.fillStyle = c('--bg');
g.fillRect(0, 0, canvas.width, canvas.height);

let rowAt = 0;
WIDTHS.forEach((wCells, n) => {
  const rows = bands[n];
  const painter = new Painter(COLS, rows);
  const ov: Overlay = {
    char: new Uint16Array(COLS * rows),
    sheet: new Uint8Array(COLS * rows),
    alpha: new Float32Array(COLS * rows),
  };
  const prio = new Uint8Array(COLS * rows);
  painter.clear();
  const only = q.get('only');
  const art: Art = only
    ? { ...ART, shapes: ART.shapes.slice(Number(only.split('-')[0]), Number(only.split('-')[1])) }
    : ART;
  painter.draw(art, fit(ART, wCells, rows - 2, COLS / 2, rows / 2, CELL_ASPECT));
  painter.paint(ov, 1, prio, 1);

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < COLS; col++) {
      const i = r * COLS + col;
      const y = rowAt + r;
      if (MODE === 'tone') {
        const v = ov.alpha[i];
        if (v < 0.05) continue;
        const s = Math.round(Math.min(1, v) * 255);
        g.fillStyle = `rgb(${s},${s},${s})`;
        g.fillRect(col * CELL_W * dpr, y * CELL_H * dpr, Math.ceil(CELL_W * dpr), Math.ceil(CELL_H * dpr));
        continue;
      }
      if (ov.alpha[i] < 0.05) continue;
      g.globalAlpha = ov.alpha[i];
      g.drawImage(
        atlas.sheets[ov.sheet[i]], atlas.sx(ov.char[i]), 0,
        Math.round(CELL_W * dpr), Math.round(CELL_H * dpr),
        Math.round(col * CELL_W * dpr), Math.round(y * CELL_H * dpr),
        Math.round(CELL_W * dpr), Math.round(CELL_H * dpr),
      );
    }
  }
  g.globalAlpha = 1;
  g.fillStyle = '#ec7225';
  g.font = `${11 * dpr}px ui-monospace, monospace`;
  g.fillText(`${wCells} cells`, 8 * dpr, (rowAt + 1) * CELL_H * dpr);
  rowAt += rows;
});
