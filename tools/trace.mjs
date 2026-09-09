/**
 * Traces a line drawing into polygon data for src/art.ts. Dev-only, run by hand.
 *
 * The page is otherwise entirely computed geometry, so the car is shipped as
 * paths rather than as a baked bitmap: paths scale to any cell size, stay small
 * (~5 kB against ~11 kB for a bitmap at the resolution this needs), and render
 * through the same coverage-to-ramp path as everything else on the page.
 *
 *   node tools/trace.mjs <image.png> [--min 300] [--eps 1.1]
 *
 * Decoding is done in headless Chromium, which is already installed for the
 * verification harness, so this adds no dependency to the repo.
 */
import { chromium } from '/opt/homebrew/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i < 0 ? d : Number(process.argv[i + 1]);
};
const MIN_AREA = arg('--min', 300);
const EPS = arg('--eps', 1.1);
const CLOSE = arg('--close', 0);
const SHELL_EPS = arg('--shelleps', 0);

const browser = await chromium.launch();
const page = await browser.newPage();
const src = 'data:image/png;base64,' + readFileSync(file).toString('base64');

const out = await page.evaluate(
  async ({ src, MIN_AREA, EPS, CLOSE, SHELL_EPS }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const raw = g.getImageData(0, 0, cv.width, cv.height).data;

    // ── crop to the ink, with a margin so the outside stays one region ──
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    const dark = (x, y) => {
      const i = (y * cv.width + x) * 4;
      return (raw[i] + raw[i + 1] + raw[i + 2]) / 3 < 128 && raw[i + 3] > 40;
    };
    for (let y = 0; y < cv.height; y++)
      for (let x = 0; x < cv.width; x++)
        if (dark(x, y)) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    const PAD = 3;
    const W = x1 - x0 + 1 + PAD * 2;
    const H = y1 - y0 + 1 + PAD * 2;
    const ink = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const sx = x0 - PAD + x;
        const sy = y0 - PAD + y;
        if (sx < 0 || sy < 0 || sx >= cv.width || sy >= cv.height) continue;
        ink[y * W + x] = dark(sx, sy) ? 1 : 0;
      }

    // ── flood the outside, so everything else is car ──
    const outside = new Uint8Array(W * H);
    const stack = [0];
    outside[0] = 1;
    while (stack.length) {
      const k = stack.pop();
      const x = k % W;
      const y = (k - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (ink[j] || outside[j]) continue;
        outside[j] = 1;
        stack.push(j);
      }
    }

    // ── marching squares, then chain the segments into closed loops ──
    // Directed edges over midpoints [T=0, R=1, B=2, L=3], wound so the inside
    // is always on the right. Consistent winding is the whole game: with half
    // the cases reversed the segments still look correct drawn individually,
    // but chaining them into loops breaks after two or three steps.
    const TABLE = [
      [], [[3, 2]], [[2, 1]], [[3, 1]],
      [[1, 0]], [[3, 0], [1, 2]], [[2, 0]], [[3, 0]],
      [[0, 3]], [[0, 2]], [[0, 1], [2, 3]], [[0, 1]],
      [[1, 3]], [[1, 2]], [[2, 3]], [],
    ];
    function contours(inside) {
      const segs = new Map();
      const key = (p) => `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;
      const push = (a, b) => {
        if (!segs.has(key(a))) segs.set(key(a), []);
        segs.get(key(a)).push([a, b]);
      };
      for (let j = 0; j < H - 1; j++)
        for (let i = 0; i < W - 1; i++) {
          const tl = inside(i, j), tr = inside(i + 1, j);
          const br = inside(i + 1, j + 1), bl = inside(i, j + 1);
          const c = tl * 8 + tr * 4 + br * 2 + bl;
          const pt = [[i + 0.5, j], [i + 1, j + 0.5], [i + 0.5, j + 1], [i, j + 0.5]];
          for (const [a, b] of TABLE[c]) push(pt[a], pt[b]);
        }
      const loops = [];
      const used = new Set();
      for (const [k, list] of segs)
        for (let n = 0; n < list.length; n++) {
          const id = k + '#' + n;
          if (used.has(id)) continue;
          used.add(id);
          const loop = [list[n][0]];
          let cur = list[n][1];
          for (let guard = 0; guard < W * H * 4; guard++) {
            loop.push(cur);
            const nk = key(cur);
            const next = segs.get(nk);
            if (!next) break;
            let took = false;
            for (let m = 0; m < next.length; m++) {
              const nid = nk + '#' + m;
              if (used.has(nid)) continue;
              used.add(nid);
              cur = next[m][1];
              took = true;
              break;
            }
            if (!took) break;
            if (key(cur) === k) break;
          }
          if (loop.length > 8) loops.push(loop);
        }
      return loops;
    }

    // ── Douglas–Peucker ──
    function simplify(pts, eps) {
      if (pts.length < 3) return pts;
      const keep = new Uint8Array(pts.length);
      keep[0] = keep[pts.length - 1] = 1;
      const work = [[0, pts.length - 1]];
      while (work.length) {
        const [a, b] = work.pop();
        if (b - a < 2) continue;
        const [ax, ay] = pts[a];
        const [bx, by] = pts[b];
        const dx = bx - ax, dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        let worst = -1, at = -1;
        for (let i = a + 1; i < b; i++) {
          const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
          if (d > worst) { worst = d; at = i; }
        }
        if (worst > eps) { keep[at] = 1; work.push([a, at], [at, b]); }
      }
      return pts.filter((_, i) => keep[i]);
    }

    const area = (pts) => {
      let a = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x1c, y1c] = pts[i];
        const [x2c, y2c] = pts[(i + 1) % pts.length];
        a += x1c * y2c - x2c * y1c;
      }
      return Math.abs(a) / 2;
    };

    // The silhouette: everything the flood could not reach, morphologically
    // closed first. A line drawing's thin strokes leave one-pixel fingers all
    // over the outline — grille slats, badge text, panel gaps — and the
    // contour dutifully walks in and out of every one of them. None of that
    // survives being resampled to a character cell, so it is removed before
    // tracing rather than simplified away afterwards.
    let solidMask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) solidMask[i] = outside[i] ? 0 : 1;
    const morph = (src2, grow) => {
      const dst = new Uint8Array(W * H);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          let hit = grow ? 0 : 1;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              const v = nx < 0 || ny < 0 || nx >= W || ny >= H ? 0 : src2[ny * W + nx];
              if (grow) hit |= v;
              else hit &= v;
            }
          dst[y * W + x] = hit;
        }
      return dst;
    };
    for (let n = 0; n < CLOSE; n++) solidMask = morph(solidMask, true);
    for (let n = 0; n < CLOSE; n++) solidMask = morph(solidMask, false);
    const solid = (x, y) =>
      x < 0 || y < 0 || x >= W || y >= H ? 0 : solidMask[y * W + x];
    const shell = contours(solid)
      .map((l) => simplify(l, SHELL_EPS || EPS))
      .filter((l) => area(l) > MIN_AREA)
      .sort((a, b) => area(b) - area(a));

    // Enclosed panels: white regions the flood could not reach either.
    const lab = new Int32Array(W * H).fill(-1);
    const panels = [];
    for (let s = 0; s < W * H; s++) {
      if (ink[s] || outside[s] || lab[s] >= 0) continue;
      const q = [s];
      lab[s] = panels.length;
      let n = 0;
      const bb = [1e9, -1, 1e9, -1];
      while (q.length) {
        const k = q.pop();
        n++;
        const x = k % W, y = (k - x) / W;
        if (x < bb[0]) bb[0] = x;
        if (x > bb[1]) bb[1] = x;
        if (y < bb[2]) bb[2] = y;
        if (y > bb[3]) bb[3] = y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (ink[j] || outside[j] || lab[j] >= 0) continue;
          lab[j] = panels.length;
          q.push(j);
        }
      }
      panels.push({ id: panels.length, n, bb });
    }
    const big = panels.filter((p) => p.n >= MIN_AREA).sort((a, b) => b.n - a.n);
    const traced = big.map((p) => {
      const isIn = (x, y) =>
        x < 0 || y < 0 || x >= W || y >= H ? 0 : lab[y * W + x] === p.id ? 1 : 0;
      const loops = contours(isIn).map((l) => simplify(l, EPS)).sort((a, b) => area(b) - area(a));
      return { px: p.n, bb: p.bb, pts: loops[0] || [] };
    });

    return { W, H, shell, panels: traced };
  },
  { src, MIN_AREA, EPS, CLOSE, SHELL_EPS },
);

await browser.close();

const enc = (pts) => pts.map((p) => `${Math.round(p[0])},${Math.round(p[1])}`).join(' ');
console.log(`// source ${file}  ${out.W}x${out.H}  aspect ${(out.W / out.H).toFixed(3)}`);
console.log(`SHELL loops: ${out.shell.length}`);
out.shell.forEach((l, i) => console.log(`  shell[${i}] pts=${l.length}`));
console.log(`PANELS: ${out.panels.length}`);
out.panels.forEach((p, i) =>
  console.log(
    `  panel[${i}] px=${p.px} pts=${p.pts.length} bb=x${p.bb[0]}-${p.bb[1]} y${p.bb[2]}-${p.bb[3]}`,
  ),
);
console.log('\n---DATA---');
console.log(JSON.stringify({
  w: out.W, h: out.H,
  shell: out.shell.slice(0, 3).map(enc),
  panels: out.panels.map((p) => ({ px: p.px, bb: p.bb, d: enc(p.pts) })),
}));
