/**
 * Scores a traced silhouette against the drawing it came from.
 *
 * "1:1 with the real car" needs a number, not an opinion. This rasterises the
 * traced polygon and the source drawing's own filled silhouette onto the same
 * grid and reports intersection-over-union, plus where the two disagree, so
 * the loop can be driven by the mismatch rather than by my impression of it.
 *
 *   node tools/fidelity.mjs <image.png> <shell.json> [--grid 240]
 */
import { chromium } from '/opt/homebrew/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const imgFile = process.argv[2];
const shellFile = process.argv[3];
const gi = process.argv.indexOf('--grid');
const GRID = gi < 0 ? 240 : Number(process.argv[gi + 1]);

const shell = JSON.parse(readFileSync(shellFile, 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage();
const src = 'data:image/png;base64,' + readFileSync(imgFile).toString('base64');

const r = await page.evaluate(
  async ({ src, shell, GRID }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const raw = g.getImageData(0, 0, cv.width, cv.height).data;
    const dark = (x, y) => {
      const i = (y * cv.width + x) * 4;
      return (raw[i] + raw[i + 1] + raw[i + 2]) / 3 < 128 && raw[i + 3] > 40;
    };
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < cv.height; y++)
      for (let x = 0; x < cv.width; x++)
        if (dark(x, y)) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
    const PAD = 3;
    const W = x1 - x0 + 1 + PAD * 2;
    const H = y1 - y0 + 1 + PAD * 2;
    const ink = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const sx = x0 - PAD + x, sy = y0 - PAD + y;
        if (sx >= 0 && sy >= 0 && sx < cv.width && sy < cv.height && dark(sx, sy)) ink[y * W + x] = 1;
      }
    const outside = new Uint8Array(W * H);
    const st = [0];
    outside[0] = 1;
    while (st.length) {
      const k = st.pop();
      const x = k % W, y = (k - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (ink[j] || outside[j]) continue;
        outside[j] = 1;
        st.push(j);
      }
    }

    // Sample both onto the same coarse grid.
    const GH = Math.round((GRID * H) / W);
    const truth = new Uint8Array(GRID * GH);
    const mine = new Uint8Array(GRID * GH);
    const inPoly = (px, py) => {
      let hit = false;
      const n = shell.length / 2;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const ax = shell[i * 2], ay = shell[i * 2 + 1];
        const bx = shell[j * 2], by = shell[j * 2 + 1];
        if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) hit = !hit;
      }
      return hit;
    };
    for (let gy = 0; gy < GH; gy++)
      for (let gx = 0; gx < GRID; gx++) {
        const px = ((gx + 0.5) * W) / GRID;
        const py = ((gy + 0.5) * H) / GH;
        const si = Math.floor(py) * W + Math.floor(px);
        truth[gy * GRID + gx] = outside[si] ? 0 : 1;
        mine[gy * GRID + gx] = inPoly(px, py) ? 1 : 0;
      }
    let inter = 0, union = 0, missing = 0, extra = 0;
    for (let i = 0; i < truth.length; i++) {
      if (truth[i] && mine[i]) inter++;
      if (truth[i] || mine[i]) union++;
      if (truth[i] && !mine[i]) missing++;
      if (!truth[i] && mine[i]) extra++;
    }
    // Where the disagreement lives, as an ASCII map: . agree  - missing  + extra
    const rowsOut = [];
    for (let gy = 0; gy < GH; gy += 2) {
      let line = '';
      for (let gx = 0; gx < GRID; gx += 2) {
        const i = gy * GRID + gx;
        line += truth[i] && mine[i] ? '#' : truth[i] ? '-' : mine[i] ? '+' : ' ';
      }
      rowsOut.push(line);
    }
    return { W, H, GRID, GH, inter, union, missing, extra, map: rowsOut };
  },
  { src, shell, GRID },
);

await browser.close();
const iou = r.inter / r.union;
console.log(`grid ${r.GRID}x${r.GH}  source ${r.W}x${r.H}`);
console.log(`IoU ${(iou * 100).toFixed(2)}%   missing ${r.missing}  extra ${r.extra}`);
console.log('# agree   - drawing only (trace lost it)   + trace only (trace invented it)');
for (const line of r.map) console.log(line);
