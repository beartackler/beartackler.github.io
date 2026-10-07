/**
 * The light table.
 *
 * Every frame is covered by a canvas that draws it as an ASCII negative, in
 * the same density ramp and the same amber as the resume. Moving across it
 * erases the canvas where you have been, so the real pixels develop under the
 * cursor and stay developed, the way the resume's words do. A click prints the
 * whole frame.
 *
 * The canvas starts transparent and is only drawn once the font and the image
 * are in, so without JavaScript, or before either loads, the media just shows.
 */

import './work.css';

const RAMP = ' .:-=+*#@';
const CELL_W = 7;
const CELL_H = 12;
const BRUSH = 110;

const css = getComputedStyle(document.documentElement);
const BG = css.getPropertyValue('--bg').trim();
const GLOW = css.getPropertyValue('--glow').trim();

function source(fig: HTMLElement): Promise<HTMLImageElement> {
  const media = fig.querySelector('img, video') as HTMLImageElement | HTMLVideoElement;
  const img = new Image();
  img.src = media instanceof HTMLVideoElement ? media.poster : media.currentSrc || media.src;
  return img.decode().then(() => img);
}

function negative(canvas: HTMLCanvasElement, img: HTMLImageElement): void {
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const cols = Math.ceil(width / CELL_W);
  const rows = Math.ceil(height / CELL_H);
  const probe = document.createElement('canvas');
  probe.width = cols;
  probe.height = rows;
  const p = probe.getContext('2d', { willReadFrequently: true })!;
  p.drawImage(img, 0, 0, cols, rows);
  const px = p.getImageData(0, 0, cols, rows).data;

  const lum = new Float32Array(cols * rows);
  let mean = 0;
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < lum.length; i++) {
    lum[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
    mean += lum[i];
    lo = Math.min(lo, lum[i]);
    hi = Math.max(hi, lum[i]);
  }
  // Stretch to the frame's own range: at this cell size a line of body type
  // averages out to pale grey, and on a white page that is nearly nothing.
  const span = Math.max(hi - lo, 0.05);
  for (let i = 0; i < lum.length; i++) lum[i] = (lum[i] - lo) / span;
  // A light UI is mostly white page with dark type on it. Drawn straight, the
  // page is a wall of @ and the type is the gaps. Inverting it — a negative,
  // literally — puts the characters where the content is, which is the part
  // worth looking at. Dark UIs already read the right way round.
  const invert = mean / lum.length > lo + span / 2;

  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${CELL_H - 1}px 'Departure Mono', monospace`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = GLOW;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const raw = invert ? 1 - lum[y * cols + x] : lum[y * cols + x];
      // Near-background stays empty, or an off-white page becomes a field of dots.
      const v = Math.max(0, (raw - 0.15) / 0.85);
      const k = Math.min(RAMP.length - 1, Math.floor(Math.pow(v, 0.8) * RAMP.length));
      if (!k) continue;
      ctx.globalAlpha = 0.35 + 0.65 * v;
      ctx.fillText(RAMP[k], x * CELL_W, y * CELL_H);
    }
  }
  ctx.globalAlpha = 1;
}

function print(fig: HTMLElement, play = false): void {
  fig.classList.add('printed');
  const video = fig.querySelector('video');
  // The one video with sound waits to be asked; clicking it is the asking.
  if (video && !video.loop && !video.controls) {
    video.controls = true;
    if (play) video.play().catch(() => {});
  }
}

const figures = [...document.querySelectorAll<HTMLElement>('figure.neg')];

document.fonts.load(`${CELL_H}px 'Departure Mono'`).then(() => {
  for (const fig of figures) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    fig.append(canvas);
    fig.tabIndex = 0;

    const ready = source(fig);
    const draw = () => ready.then((img) => fig.classList.contains('printed') || negative(canvas, img));
    // ponytail: a resize redraws the whole negative and forgets what was developed; fine for a gallery.
    new ResizeObserver(draw).observe(fig);

    fig.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || fig.classList.contains('printed')) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const ctx = canvas.getContext('2d')!;
      ctx.globalCompositeOperation = 'destination-out';
      const g = ctx.createRadialGradient(x, y, 0, x, y, BRUSH);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - BRUSH, y - BRUSH, BRUSH * 2, BRUSH * 2);
    });
    fig.addEventListener('click', () => print(fig, true));
    fig.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        print(fig, true);
      }
    });
  }
});

document.getElementById('develop-all')!.addEventListener('click', (e) => {
  figures.forEach((f) => print(f));
  (e.currentTarget as HTMLButtonElement).hidden = true;
});
