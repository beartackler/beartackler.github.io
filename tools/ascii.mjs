/**
 * Prints a slide's artwork as text, straight from the real renderer.
 *
 *   node --import ./tools/reg.mjs tools/ascii.mjs <name> [cols]
 *
 * The browser preview (car.html) shows the finished thing with colour and the
 * real font; this shows the characters. For drawing work the characters are
 * what matters — "is this a barbell" is answerable from the glyph grid and not
 * really answerable from a 900-pixel screenshot of it.
 */
import { fit, Painter } from '../src/art.ts';
import { R8_ART } from '../src/slides/r8.ts';
import { GALLERY } from '../src/slides/gallery.ts';

const name = process.argv[2] ?? 'r8';
const CELLS = Number(process.argv[3] ?? 120);
const ONLY = process.argv[4];
const ASPECT = 1.4;
const art = name === 'r8' ? R8_ART : GALLERY[name];
if (!art) throw new Error(`no art "${name}" — have ${Object.keys(GALLERY)}`);

const cols = CELLS + 4;
const rows = Math.ceil(((art.h / art.w) * CELLS) / ASPECT) + 4;
const p = new Painter(cols, rows);
const ov = {
  char: new Uint16Array(cols * rows),
  sheet: new Uint8Array(cols * rows),
  alpha: new Float32Array(cols * rows),
};
p.clear();
const shown = ONLY ? { ...art, shapes: art.shapes.slice(...ONLY.split('-').map(Number)) } : art;
p.draw(shown, fit(art, CELLS, rows - 2, cols / 2, rows / 2, ASPECT));
p.paint(ov, 1, new Uint8Array(cols * rows), 1);

const out = [];
for (let r = 0; r < rows; r++) {
  let line = '';
  for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    line += ov.char[i] && ov.alpha[i] > 0.05 ? String.fromCharCode(ov.char[i]) : ' ';
  }
  out.push(line.replace(/\s+$/, ''));
}
console.log(out.join('\n'));
console.log(`\n${name}  ${art.w}x${art.h}  ${cols}x${rows} cells  ${art.shapes.length} shapes`);
