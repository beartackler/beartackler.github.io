/**
 * Dev-only preview for the R8 (src/r8.ts). Renders a contact sheet of poses
 * through the real atlas and the real ramp, so what is judged here is exactly
 * what act three will draw. Vite builds index.html only, so this ships nothing.
 */
import './style.css';
import { Atlas, type Palette } from './atlas';
import { CELL_ASPECT } from './layout';
import { R8 } from './r8';
import type { Overlay } from './render';

const ANGLES = Number(new URLSearchParams(location.search).get('a') ?? 0);
const POSES = ANGLES ? [ANGLES] : [0, 25, 55, 90, 125, 155, 200, 215];

const css = getComputedStyle(document.documentElement);
const c = (n: string) => css.getPropertyValue(n).trim();
const palette: Palette = {
  display: c('--display'), ink: c('--ink'), dim: c('--ink-dim'), muted: c('--muted'),
  glow: c('--glow'), glowHot: c('--glow-hot'), bark: c('--bark'),
  bloom: c('--bloom'), bloomDeep: c('--bloom-deep'),
};

const CELL_W = 8;
const CELL_H = Math.round(CELL_W * CELL_ASPECT);
const COLS = 128;
const ROWS = 40;
const charset = [...".,:;-=+*#%@'\"/\\|()[]{}<>~^`o_"].map((s) => s.charCodeAt(0));

await document.fonts.load(`${Math.round(CELL_H * 0.95)}px "Departure Mono"`);
const dpr = 2;
const atlas = new Atlas(CELL_W, CELL_H, dpr, Math.round(CELL_H * 0.95), charset, palette);

const canvas = document.getElementById('car') as HTMLCanvasElement;
canvas.width = COLS * CELL_W * dpr;
canvas.height = POSES.length * ROWS * CELL_H * dpr;
canvas.style.width = `${COLS * CELL_W}px`;
canvas.style.height = `${POSES.length * ROWS * CELL_H}px`;
const g = canvas.getContext('2d')!;
g.fillStyle = c('--bg');
g.fillRect(0, 0, canvas.width, canvas.height);

const car = new R8(COLS, ROWS);
const prio = new Uint8Array(COLS * ROWS);

POSES.forEach((az, n) => {
  const ov: Overlay = {
    char: new Uint16Array(COLS * ROWS),
    sheet: new Uint8Array(COLS * ROWS),
    alpha: new Float32Array(COLS * ROWS),
  };
  prio.fill(0);
  car.render({
    azimuth: az, elevation: 11,
    cx: COLS / 2, cy: ROWS / 2,
    width: COLS * 0.78, height: ROWS * 0.72, aspect: CELL_ASPECT,
  });
  car.paint(ov, atlas.ramp, 1, prio, 1);

  const yOff = n * ROWS * CELL_H;
  const mode = new URLSearchParams(location.search).get('m');
  if (mode) {
    // Straight to pixels: greyscale luminance, or one colour per material.
    const MATC = ['#dddddd', '#3aa0ff', '#ff3b30', '#ffd60a', '#ffffff', '#ff9f0a', '#8e8e93', '#30d158'];
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const i = r * COLS + col;
        const l = car.luma[i];
        if (l <= 0.02) continue;
        g.fillStyle = mode === 'mat'
          ? MATC[car.material[i]]
          : `rgb(${Array(3).fill(Math.round(Math.min(1, l) * 255)).join(',')})`;
        g.globalAlpha = mode === 'mat' ? Math.min(1, 0.35 + l) : 1;
        g.fillRect(
          Math.round(col * CELL_W * dpr), Math.round((yOff + r * CELL_H) * dpr),
          Math.ceil(CELL_W * dpr), Math.ceil(CELL_H * dpr),
        );
      }
    }
    g.globalAlpha = 1;
    g.fillStyle = '#ec7225';
    g.font = `${11 * dpr}px ui-monospace, monospace`;
    g.fillText(`${az}°`, 8 * dpr, (yOff + 16) * dpr);
    return;
  }

  for (let r = 0; r < ROWS; r++) {
    for (let col = 0; col < COLS; col++) {
      const i = r * COLS + col;
      if (ov.alpha[i] < 0.05) continue;
      g.globalAlpha = ov.alpha[i];
      g.drawImage(
        atlas.sheets[ov.sheet[i]], atlas.sx(ov.char[i]), 0,
        Math.round(CELL_W * dpr), Math.round(CELL_H * dpr),
        Math.round(col * CELL_W * dpr), Math.round((yOff + r * CELL_H) * dpr),
        Math.round(CELL_W * dpr), Math.round(CELL_H * dpr),
      );
    }
  }
  g.globalAlpha = 1;
  g.fillStyle = '#ec7225';
  g.font = `${11 * dpr}px ui-monospace, monospace`;
  g.fillText(`${az}°`, 8 * dpr, (yOff + 16) * dpr);
});
